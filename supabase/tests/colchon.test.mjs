import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearIngesta } from '../functions/ingesta/handler.ts'

const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }

const COLCHON = 'cuna-colchon-01'
const OTRO_COLCHON = 'cuna-colchon-02'
const AMBIENTE = 'cuna-ambiente-01'
const TOKEN_COLCHON = 'c'.repeat(64)
const TOKEN_OTRO = 'd'.repeat(64)
const TOKEN_AMBIENTE = 'a'.repeat(64)

const armado = { referencia_g: 1000, duracion_s: 300, tolerancia_pct: 10, alarma_s: 60 }
const alarma = { referencia_g: 1000, ultimo_peso_g: 890 }

test('Colchón: configuración, eventos de alarma y parada, estado (fase 6)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [ana, beto, carla, picoColchon] = Array.from({ length: 4 }, () => randomUUID())
  const bebe = randomUUID()

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create schema realtime;
    create table realtime.messages (
      id uuid primary key default gen_random_uuid(),
      topic text not null,
      extension text not null,
      payload jsonb,
      event text,
      private boolean default false,
      inserted_at timestamptz not null default now()
    );
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$
      select nullif(current_setting('realtime.topic', true), '')
    $$;
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language sql as $$
      insert into realtime.messages (topic, extension, payload, event, private)
      values (topic, 'broadcast', payload, event, private)
    $$;
    grant usage on schema realtime to authenticated, anon;
    grant select, insert on realtime.messages to authenticated;
  `)
  for (const archivo of [
    '20261111000100_lecturas_ambiente.sql',
    '20261111000200_comandos_lampara.sql',
    '20261111000300_entrega_lampara.sql',
    '20261111000400_eventos_movimiento.sql',
    '20261118000100_cuentas_propiedad.sql',
    '20261118000200_avisos_telegram.sql',
    '20261118000400_ordenes_modulo.sql',
    '20261118000500_colchon.sql',
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }

  for (const id of [ana, beto, carla, picoColchon]) {
    await db.query('insert into auth.users values ($1, $2)', [id, `${id}@example.com`])
  }
  await db.query("insert into cuna_private.bebes (id, nombre) values ($1, 'Luna')", [bebe])
  const modulos = [
    [COLCHON, TOKEN_COLCHON, 'colchon', 'colchon-01'],
    [OTRO_COLCHON, TOKEN_OTRO, 'colchon', 'colchon-02'],
    [AMBIENTE, TOKEN_AMBIENTE, 'cuna', 'cuna-01'],
  ]
  for (const [id, token, tipo, producto] of modulos) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, token, tipo, producto])
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, ana])
  }
  await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [COLCHON, beto])
  await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-01-01T00:00:00Z', $2)", [COLCHON, bebe])
  await db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)', [picoColchon, COLCHON])
  await db.query(
    "insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001)",
    [COLCHON])

  async function como(rol, usuario, consultar) {
    await db.exec(`set role ${rol}`)
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ''])
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }
  const web = async (usuario, sql, params = []) =>
    (await como('authenticated', usuario, () => db.query(`select ${sql} as r`, params))).rows[0].r
  const servicio = async (sql, params = []) =>
    (await como('service_role', null, () => db.query(`select ${sql} as r`, params))).rows[0].r
  const contar = async (tabla, donde = 'true', params = []) =>
    (await db.query(`select count(*)::int as n from ${tabla} where ${donde}`, params)).rows[0].n

  const guardar = (usuario, dispositivo, duracion, tolerancia, alarmaS) =>
    web(usuario, 'public.guardar_config_colchon($1, $2, $3, $4)', [dispositivo, duracion, tolerancia, alarmaS])
  const config = (usuario, dispositivo) => web(usuario, 'public.mi_config_colchon($1)', [dispositivo])
  const estado = (usuario, dispositivo) => web(usuario, 'public.estado_de_modulo($1)', [dispositivo])
  const ingestar = (id, dispositivo, token, tipo, ts, datos) =>
    servicio('public.ingestar_colchon($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [id, dispositivo, token, tipo, ts, '2026-11-18T15:00:00Z', JSON.stringify(datos)])
  const avisos = () => contar('cuna_private.avisos')
  const eventos = (tipo) => contar('public.eventos', 'device_id = $1 and tipo = $2', [COLCHON, tipo])

  await t.test('configuración: solo dueños, valores válidos, un rechazo conserva lo anterior', async () => {
    assert.equal(await config(ana, COLCHON), null, 'sin configuración guardada no hay valores por defecto')

    await assert.rejects(guardar(carla, COLCHON, 300, 10, 60), sinPermiso)
    await assert.rejects(guardar(null, COLCHON, 300, 10, 60), sinPermiso)
    await assert.rejects(config(carla, COLCHON), sinPermiso)
    // Ana es dueña del ambiente, pero la configuración es del colchón.
    await assert.rejects(guardar(ana, AMBIENTE, 300, 10, 60), invalido)

    const guardada = await guardar(ana, COLCHON, 300, 10, 60)
    assert.deepEqual(guardada, { duracion_s: 300, tolerancia_pct: 10, alarma_s: 60 })
    assert.deepEqual(await config(beto, COLCHON), guardada, 'los dos dueños ven la misma configuración')

    for (const [d, tol, al] of [
      [0, 10, 60], [-5, 10, 60], [86401, 10, 60], [1.5, 10, 60], [null, 10, 60],
      [300, 0, 60], [300, 100, 60], [300, -1, 60], [300, null, 60],
      [300, 10, 0], [300, 10, 61], [300, 10, 0.5], [300, 10, null],
    ]) {
      await assert.rejects(guardar(ana, COLCHON, d, tol, al), invalido, JSON.stringify([d, tol, al]))
    }
    for (const mala of ['NaN', 'Infinity', '-Infinity']) {
      await assert.rejects(web(ana, `public.guardar_config_colchon($1, $2::double precision, 10, 60)`, [COLCHON, mala]), invalido, mala)
      await assert.rejects(web(ana, `public.guardar_config_colchon($1, 300, $2::double precision, 60)`, [COLCHON, mala]), invalido, mala)
      await assert.rejects(web(ana, `public.guardar_config_colchon($1, 300, 10, $2::double precision)`, [COLCHON, mala]), invalido, mala)
    }
    assert.deepEqual(await config(ana, COLCHON), guardada, 'ningún rechazo cambió la configuración')

    assert.deepEqual(await guardar(beto, COLCHON, 86400, 99.5, 1), { duracion_s: 86400, tolerancia_pct: 99.5, alarma_s: 1 })
    assert.deepEqual(await guardar(ana, COLCHON, 300, 10, 60), guardada)
    assert.equal(await contar('cuna_private.config_colchon'), 1)
  })

  await t.test('ningún rol de API lee ni escribe la tabla de configuración ni ejecuta la ingesta', async () => {
    await assert.rejects(como('authenticated', ana, () => db.query('select * from cuna_private.config_colchon')), /permission denied/)
    await assert.rejects(como('anon', null, () => db.query("select public.mi_config_colchon('cuna-colchon-01')")), /permission denied/)
    await assert.rejects(como('authenticated', ana, () => db.query(
      "select public.ingestar_colchon($1, $2, $3, 'colchon_armado', now(), now(), $4::jsonb)",
      [randomUUID(), COLCHON, TOKEN_COLCHON, JSON.stringify(armado)])), /permission denied/)
  })

  await t.test('sin eventos el estado está vacío: ni una orden confirmada lo inventa', async () => {
    assert.deepEqual(await estado(ana, COLCHON), { estado: {}, actualizado_en: null })

    const id = randomUUID()
    await web(ana, 'public.solicitar_orden($1, $2, $3, $4::jsonb)',
      [id, COLCHON, 'mattress_arm', JSON.stringify({ duration_s: 300, tolerance_pct: 10, alarm_s: 60 })])
    const orden = await web(picoColchon, 'public.tomar_orden_modulo()')
    assert.equal(orden.command, 'mattress_arm')
    assert.deepEqual(orden.params, { duration_s: 300, tolerance_pct: 10, alarm_s: 60 })
    await web(picoColchon, 'public.confirmar_orden_modulo($1, true, $2::jsonb, null)',
      [id, JSON.stringify({ pendiente: true, accion: 'armar' })])
    assert.deepEqual((await estado(ana, COLCHON)).estado, {}, 'la Pico acepta medir; el estado llega con el evento')
  })

  await t.test('colchon_armado: queda registrado, fija el estado y no avisa', async () => {
    assert.equal(await ingestar(randomUUID(), COLCHON, 'e'.repeat(64), 'colchon_armado', '2026-11-18T14:00:00Z', armado), 'no_autorizado')
    assert.equal(await ingestar(randomUUID(), OTRO_COLCHON, TOKEN_COLCHON, 'colchon_armado', '2026-11-18T14:00:00Z', armado), 'no_autorizado')
    assert.equal(await ingestar(randomUUID(), AMBIENTE, TOKEN_AMBIENTE, 'colchon_armado', '2026-11-18T14:00:00Z', armado), 'no_autorizado')
    assert.equal(await eventos('colchon_armado'), 0)

    const id = randomUUID()
    assert.equal(await ingestar(id, COLCHON, TOKEN_COLCHON, 'colchon_armado', '2026-11-18T14:00:00Z', armado), 'creado')
    assert.equal(await eventos('colchon_armado'), 1)
    assert.equal(await avisos(), 0)

    const actual = await estado(ana, COLCHON)
    assert.deepEqual(actual.estado, {
      colchon: 'activo', referencia_g: 1000, duracion_s: 300, tolerancia_pct: 10, alarma_s: 60,
      motivo: null, colchon_ts: actual.estado.colchon_ts,
    })
    assert.equal(new Date(actual.estado.colchon_ts).toISOString(), '2026-11-18T14:00:00.000Z')
    assert.equal(new Date(actual.actualizado_en).toISOString(), '2026-11-18T14:00:00.000Z')
    assert.deepEqual(await estado(beto, COLCHON), actual)
    await assert.rejects(estado(carla, COLCHON), sinPermiso)

    assert.equal(await ingestar(id, COLCHON, TOKEN_COLCHON, 'colchon_armado', '2026-11-18T14:00:00Z', armado), 'duplicado')
    assert.equal(await ingestar(id, COLCHON, TOKEN_COLCHON, 'colchon_armado', '2026-11-18T14:00:00Z', { ...armado, referencia_g: 999 }), 'id_reutilizado')
    assert.equal(await eventos('colchon_armado'), 1)
  })

  await t.test('alarma_colchon: avisa una vez, cambia el estado y no guarda lecturas de peso', async () => {
    const id = randomUUID()
    assert.equal(await ingestar(id, COLCHON, TOKEN_COLCHON, 'alarma_colchon', '2026-11-18T14:05:00Z', alarma), 'creado')
    assert.equal(await avisos(), 1)
    assert.equal(await ingestar(id, COLCHON, TOKEN_COLCHON, 'alarma_colchon', '2026-11-18T14:05:00Z', alarma), 'duplicado')
    assert.equal(await avisos(), 1, 'un reenvío no duplica el aviso')

    const { estado: e } = await estado(ana, COLCHON)
    assert.equal(e.colchon, 'alarma')
    assert.equal(e.referencia_g, 1000)
    assert.equal(e.duracion_s, 300, 'conserva la configuración del armado')
    assert.equal(e.ultimo_peso_g, undefined, 'el estado no expone pesos')

    const fila = (await db.query(
      "select descripcion, datos from public.eventos where tipo = 'alarma_colchon'")).rows[0]
    assert.equal(fila.descripcion, 'Alarma del colchón: el peso bajó más que la tolerancia')
    assert.deepEqual(fila.datos, alarma)

    const columnas = (await db.query(`
      select table_name, column_name from information_schema.columns
      where table_schema in ('public', 'cuna_private')
        and (column_name ilike '%peso%' or table_name ilike '%peso%' or table_name ilike '%lectura%colchon%')
        and column_name <> 'ultimo_peso_g'`)).rows
    assert.deepEqual(columnas, [], 'no existe ninguna tabla ni columna de lecturas de peso')
  })

  await t.test('colchon_detenido: cada motivo se acepta, avisa y fija el estado', async () => {
    const hora = (minuto) => `2026-11-18T14:${String(minuto).padStart(2, '0')}:00Z`
    const motivos = ['app', 'boton', 'temporizador', 'duracion', 'wifi']
    const antes = await avisos()
    for (const [i, motivo] of motivos.entries()) {
      assert.equal(
        await ingestar(randomUUID(), COLCHON, TOKEN_COLCHON, 'colchon_detenido', hora(10 + i), { motivo }),
        'creado', motivo)
      const { estado: e } = await estado(ana, COLCHON)
      assert.deepEqual([e.colchon, e.motivo], ['detenido', motivo])
    }
    assert.equal(await avisos(), antes + motivos.length)
    const textos = (await db.query(
      "select descripcion from public.eventos where tipo = 'colchon_detenido' order by ts")).rows.map((f) => f.descripcion)
    assert.deepEqual(textos, [
      'Monitoreo del colchón detenido desde la app',
      'Monitoreo del colchón detenido con el botón',
      'Monitoreo del colchón detenido al terminar el tiempo de la alarma',
      'Monitoreo del colchón detenido al terminar la duración',
      'Monitoreo del colchón detenido por pérdida de WiFi',
    ])
  })

  await t.test('un evento más antiguo que el estado guardado no lo cambia', async () => {
    const antes = await estado(ana, COLCHON)
    assert.equal(await ingestar(randomUUID(), COLCHON, TOKEN_COLCHON, 'colchon_armado', '2026-11-18T13:00:00Z', armado), 'creado')
    assert.deepEqual(await estado(ana, COLCHON), antes)
    assert.equal(await eventos('colchon_armado'), 2, 'el evento sí queda en el historial')
  })

  await t.test('sin bebé asignado a esa hora no se registra ni cambia el estado', async () => {
    const antes = await estado(ana, COLCHON)
    assert.equal(await ingestar(randomUUID(), COLCHON, TOKEN_COLCHON, 'colchon_detenido', '2025-06-01T00:00:00Z', { motivo: 'app' }), 'sin_asignacion')
    assert.deepEqual(await estado(ana, COLCHON), antes)
  })

  await t.test('datos con forma o rango inválidos se rechazan sin tocar nada', async () => {
    const eventosAntes = await contar('public.eventos')
    const avisosAntes = await avisos()
    const estadoAntes = await estado(ana, COLCHON)
    const casos = [
      ['colchon_armado', { ...armado, extra: 1 }],
      ['colchon_armado', { referencia_g: 1000, duracion_s: 300, tolerancia_pct: 10 }],
      ['colchon_armado', { ...armado, referencia_g: 0 }],
      ['colchon_armado', { ...armado, referencia_g: '1000' }],
      ['colchon_armado', { ...armado, duracion_s: 86401 }],
      ['colchon_armado', { ...armado, tolerancia_pct: 100 }],
      ['colchon_armado', { ...armado, tolerancia_pct: 0 }],
      ['colchon_armado', { ...armado, alarma_s: 61 }],
      ['colchon_armado', {}],
      ['alarma_colchon', { referencia_g: 1000 }],
      ['alarma_colchon', { ...alarma, lecturas: [1, 2, 3] }],
      ['alarma_colchon', { ...alarma, ultimo_peso_g: null }],
      ['alarma_colchon', { ...alarma, ultimo_peso_g: 200000 }],
      ['colchon_detenido', { motivo: 'otro' }],
      ['colchon_detenido', { motivo: 'app', extra: true }],
      ['colchon_detenido', { motivo: 5 }],
      ['colchon_detenido', {}],
      ['peso_colchon', { peso_g: 900 }],
      ['movimiento', {}],
    ]
    for (const [tipo, datos] of casos) {
      assert.equal(
        await ingestar(randomUUID(), COLCHON, TOKEN_COLCHON, tipo, '2026-11-18T16:00:00Z', datos),
        'evento_invalido', `${tipo} ${JSON.stringify(datos)}`)
    }
    assert.equal(await contar('public.eventos'), eventosAntes)
    assert.equal(await avisos(), avisosAntes)
    assert.deepEqual(await estado(ana, COLCHON), estadoAntes)
  })

  await t.test('un destinatario retirado no recibe avisos de alarma', async () => {
    await db.query("update cuna_private.destinatarios_telegram set activo = false where dispositivo_id = $1", [COLCHON])
    const antes = await avisos()
    assert.equal(await ingestar(randomUUID(), COLCHON, TOKEN_COLCHON, 'alarma_colchon', '2026-11-18T17:00:00Z', alarma), 'creado')
    assert.equal(await avisos(), antes)
  })
})

test('La ingesta acepta los eventos del colchón y los valida antes de la base', async (t) => {
  const recibidos = []
  const recibir = crearIngesta(
    async () => 'creado',
    async () => 'creado',
    async (evento) => {
      recibidos.push(evento)
      return 'creado'
    },
  )
  const pedir = (cuerpo, manejador = recibir) => manejador(new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${'34'.repeat(32)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }))
  const evento = (tipo, datos, extra = {}) => ({
    event_id: randomUUID(), device_id: COLCHON, tipo, ts: '2026-11-18T12:00:00Z', datos, ...extra,
  })

  await t.test('los tres tipos válidos llegan al guardado con su forma exacta', async () => {
    for (const [tipo, datos] of [
      ['colchon_armado', armado], ['alarma_colchon', alarma], ['colchon_detenido', { motivo: 'wifi' }],
    ]) {
      const cuerpo = evento(tipo, datos)
      const respuesta = await pedir(cuerpo)
      assert.equal(respuesta.status, 201, tipo)
      assert.deepEqual(await respuesta.json(), { event_id: cuerpo.event_id, estado: 'recibido' })
    }
    assert.deepEqual(recibidos.map((e) => e.tipo), ['colchon_armado', 'alarma_colchon', 'colchon_detenido'])
    assert.deepEqual(recibidos[1].datos, alarma)
  })

  await t.test('datos inválidos responden 400 sin llamar al guardado', async () => {
    const antes = recibidos.length
    for (const cuerpo of [
      evento('colchon_armado', { ...armado, tolerancia_pct: 100 }),
      evento('colchon_armado', { ...armado, alarma_s: 61 }),
      evento('colchon_armado', { ...armado, extra: 1 }),
      evento('alarma_colchon', { referencia_g: 1000, ultimo_peso_g: 'mucho' }),
      evento('alarma_colchon', { ...alarma, lecturas: [] }),
      evento('colchon_detenido', { motivo: 'otro' }),
      evento('colchon_detenido', { motivo: 'app' }, { device_id: 'cuna-movimiento-01' }),
      evento('colchon_detenido', { motivo: 'app' }, { device_id: 'cuna-colchon-1' }),
      evento('colchon_detenido', { motivo: 'app' }, { event_id: 'no-es-uuid' }),
      evento('colchon_detenido', { motivo: 'app' }, { ts: '2026-11-18 12:00:00' }),
      evento('colchon_detenido', [], {}),
    ]) {
      const respuesta = await pedir(cuerpo)
      assert.equal(respuesta.status, 400, JSON.stringify(cuerpo))
      assert.equal((await respuesta.json()).codigo, 'evento_invalido')
    }
    assert.equal(recibidos.length, antes)
  })

  await t.test('sin guardado de colchón configurado, el evento se rechaza', async () => {
    const sinColchon = crearIngesta(async () => 'creado', async () => 'creado')
    const respuesta = await pedir(evento('colchon_detenido', { motivo: 'app' }), sinColchon)
    assert.equal(respuesta.status, 400)
  })

  await t.test('una lectura de ambiente con la credencial del colchón se rechaza sin tocar la base', async () => {
    let llamado = false
    const manejador = crearIngesta(async () => { llamado = true; return 'creado' })
    const respuesta = await pedir({
      event_id: randomUUID(), device_id: COLCHON, tipo: 'ambiente',
      ts: '2026-11-18T12:00:00Z', datos: { temperatura_c: 22, humedad_pct: 50 },
    }, manejador)
    assert.equal(respuesta.status, 401)
    assert.equal(llamado, false)
  })

  await t.test('los resultados de la base se traducen a estados HTTP', async () => {
    const esperados = {
      duplicado: [409, 'evento_duplicado'],
      no_autorizado: [401, 'no_autorizado'],
      id_reutilizado: [400, 'id_reutilizado'],
      sin_asignacion: [422, 'sin_asignacion'],
      evento_invalido: [400, 'evento_invalido'],
    }
    for (const [resultado, [estado, codigo]] of Object.entries(esperados)) {
      const manejador = crearIngesta(async () => 'creado', undefined, async () => resultado)
      const respuesta = await pedir(evento('colchon_detenido', { motivo: 'app' }), manejador)
      assert.equal(respuesta.status, estado, resultado)
      assert.equal((await respuesta.json()).codigo, codigo)
    }
    const caido = crearIngesta(async () => 'creado', undefined, async () => { throw new Error('base caída') })
    const respuesta = await pedir(evento('colchon_detenido', { motivo: 'app' }), caido)
    assert.equal(respuesta.status, 503)
    assert.equal((await respuesta.json()).reintentable, true)
  })
})
