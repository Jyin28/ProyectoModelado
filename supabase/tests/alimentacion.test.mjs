import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearIngesta } from '../functions/ingesta/handler.ts'

const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }
const estadoInvalido = { code: '55000' }

const ALI = 'cuna-alimentacion-01'
const ALI2 = 'cuna-alimentacion-02'
const COLCHON = 'cuna-colchon-01'
const TOKEN_ALI = 'a'.repeat(64)
const TOKEN_ALI2 = 'd'.repeat(64)
const TOKEN_COLCHON = 'c'.repeat(64)

test('Alimentación: tomas, correcciones, temperatura y recordatorios (fase 9)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [ana, beto, carla, picoAli] = Array.from({ length: 4 }, () => randomUUID())
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
    -- Esquema mínimo de Storage: la migración de la habitación lo usa.
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text,
      owner uuid default auth.uid(),
      created_at timestamptz default now(),
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, anon;
    grant select, insert on storage.objects to authenticated;
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
    '20261118000600_habitacion.sql',
    '20261118000700_alimentacion.sql',
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }

  for (const id of [ana, beto, carla, picoAli]) {
    await db.query('insert into auth.users values ($1, $2)', [id, `${id}@example.com`])
  }
  await db.query("insert into cuna_private.bebes (id, nombre) values ($1, 'Luna')", [bebe])
  for (const [id, token, tipo, producto] of [
    [ALI, TOKEN_ALI, 'alimentacion', 'alimentacion-01'],
    [ALI2, TOKEN_ALI2, 'alimentacion', 'alimentacion-02'],
    [COLCHON, TOKEN_COLCHON, 'colchon', 'colchon-01'],
  ]) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, token, tipo, producto])
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, ana])
  }
  // Beto también es dueño del módulo principal; Carla no es dueña de nada.
  await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [ALI, beto])
  for (const id of [ALI, ALI2]) {
    await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-01-01T00:00:00Z', $2)", [id, bebe])
  }
  await db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)', [picoAli, ALI])
  await db.query(
    "insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001), ($1, 'Papá', 5002)",
    [ALI])

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

  const ingestar = (id, tipo, datos, { dispositivo = ALI, token = TOKEN_ALI, ts = '2026-11-18T14:00:00Z' } = {}) =>
    servicio('public.ingestar_alimentacion($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [id, dispositivo, token, tipo, ts, '2026-11-18T15:00:00Z', JSON.stringify(datos)])
  const peso = (toma, momento, gramos, extra) =>
    ingestar(randomUUID(), 'peso_alimentacion', { toma_id: toma, momento, gramos }, extra)
  const temperatura = (grados, ts = '2026-11-18T14:00:00Z') =>
    ingestar(randomUUID(), 'temperatura_biberon', { temperatura_c: grados }, { ts })

  const crear = async (usuario = ana, dispositivo = ALI) => {
    const id = randomUUID()
    const toma = await web(usuario, 'public.crear_toma($1, $2)', [id, dispositivo])
    assert.equal(toma.id, id)
    return id
  }
  const toma = (usuario, id, funcion, ...extra) =>
    web(usuario, `public.${funcion}($1${extra.map((_, i) => `, $${i + 2}`).join('')})`, [id, ...extra])
  const leer = async (id) => (await db.query('select * from public.tomas where id = $1', [id])).rows[0]
  const eventos = (tipo, donde = 'true') =>
    contar('public.eventos', `device_id = $1 and tipo = $2 and ${donde}`, [ALI, tipo])
  const avisos = () => contar('cuna_private.avisos')

  await t.test('feeding_weigh no se pide como una orden suelta ni a otro módulo', async () => {
    const params = { toma_id: randomUUID(), momento: 'inicial' }
    await assert.rejects(web(ana, 'public.solicitar_orden($1, $2, $3, $4::jsonb)',
      [randomUUID(), ALI, 'feeding_weigh', JSON.stringify(params)]), invalido)
    for (const [dispositivo, malos] of [
      [COLCHON, params],
      [ALI, { toma_id: 'x', momento: 'inicial' }],
      [ALI, { toma_id: params.toma_id, momento: 'otro' }],
      [ALI, { toma_id: params.toma_id }],
      [ALI, { toma_id: params.toma_id, momento: 'final', extra: 1 }],
    ]) {
      await assert.rejects(db.query(
        `insert into public.ordenes_modulo (command_id, device_id, command, params, solicitante_id, creado_en, vence_en)
         values ($1, $2, 'feeding_weigh', $3::jsonb, $4, '2026-11-18T14:00:00Z', '2026-11-18T14:00:15Z')`,
        [randomUUID(), dispositivo, JSON.stringify(malos), ana]), { code: '23514' }, JSON.stringify(malos))
    }
    await assert.rejects(db.query(
      `insert into public.ordenes_modulo (command_id, device_id, command, params, solicitante_id, creado_en, vence_en)
       values ($1, $2, 'led_stop', '{}'::jsonb, $3, '2026-11-18T14:00:00Z', '2026-11-18T14:00:15Z')`,
      [randomUUID(), ALI, ana]), { code: '23514' })
    assert.equal(await contar('public.ordenes_modulo'), 0)
  })

  const t1 = await crear()

  await t.test('crear la toma: solo el dueño, ligada al bebé y al módulo; una abierta por módulo', async () => {
    const fila = await leer(t1)
    assert.equal(fila.estado, 'preparando')
    assert.equal(fila.bebe_id, bebe)
    assert.equal(fila.device_id, ALI)
    assert.equal(fila.peso_inicial_g, null)

    await assert.rejects(web(carla, 'public.crear_toma($1, $2)', [randomUUID(), ALI]), sinPermiso)
    await assert.rejects(web(null, 'public.crear_toma($1, $2)', [randomUUID(), ALI]), sinPermiso)
    await assert.rejects(web(ana, 'public.crear_toma($1, $2)', [randomUUID(), COLCHON]), sinPermiso)
    await assert.rejects(web(ana, 'public.crear_toma($1, $2)', [randomUUID(), 'cuna-alimentacion-9']), sinPermiso)
    await assert.rejects(web(ana, 'public.crear_toma($1, $2)', [randomUUID(), ALI]), estadoInvalido,
      'ya hay una toma abierta')
    // El mismo reenvío devuelve la misma toma; el id de otra toma se rechaza.
    assert.equal((await web(ana, 'public.crear_toma($1, $2)', [t1, ALI])).id, t1)
    await assert.rejects(web(beto, 'public.crear_toma($1, $2)', [t1, ALI]), { code: '23505' })
    assert.equal(await contar('public.tomas', 'device_id = $1', [ALI]), 1)
  })

  await t.test('sin bebé asignado no se puede crear una toma', async () => {
    await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-12-01T00:00:00Z', null)", [ALI2])
    // La asignación se cierra en el futuro: ahora todavía hay bebé.
    assert.ok(await crear(ana, ALI2).then(async (id) => { await toma(ana, id, 'cancelar_toma'); return id }))
    await db.query("delete from cuna_private.asignaciones_bebe where dispositivo_id = $1", [ALI2])
    await assert.rejects(web(ana, 'public.crear_toma($1, $2)', [randomUUID(), ALI2]), invalido)
    await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-01-01T00:00:00Z', $2)", [ALI2, bebe])
  })

  await t.test('sin peso inicial no se inicia la toma (CA-20.4)', async () => {
    await assert.rejects(toma(ana, t1, 'iniciar_toma'), invalido)
    assert.equal((await leer(t1)).estado, 'preparando')
    await assert.rejects(toma(carla, t1, 'iniciar_toma'), sinPermiso)
    // Pausar, finalizar o cerrar antes de empezar no tiene sentido.
    for (const f of ['pausar_toma', 'reanudar_toma', 'finalizar_toma', 'cerrar_toma']) {
      await assert.rejects(toma(ana, t1, f), estadoInvalido, f)
    }
  })

  await t.test('pedir el peso: orden ligada a la toma, con su ciclo y sin repetirse', async () => {
    const cmd = randomUUID()
    const orden = await web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'inicial', cmd])
    assert.equal(orden.command, 'feeding_weigh')
    assert.equal(orden.device_id, ALI)
    assert.equal(orden.estado, 'pendiente')
    const fila = (await db.query('select * from public.ordenes_modulo where command_id = $1', [cmd])).rows[0]
    assert.deepEqual(fila.params, { toma_id: t1, momento: 'inicial' })
    assert.equal(fila.solicitante_id, ana)

    // Mismo reenvío: la misma orden, sin crear otra. Otro contenido con el mismo id se rechaza.
    assert.equal((await web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'inicial', cmd])).command_id, cmd)
    assert.equal(await contar('public.ordenes_modulo'), 1)
    await assert.rejects(web(beto, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'inicial', cmd]), { code: '23505' })

    // Momentos que no corresponden al estado, momentos desconocidos y quien no es dueño.
    for (const momento of ['control', 'final']) {
      await assert.rejects(web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, momento, randomUUID()]), estadoInvalido, momento)
    }
    await assert.rejects(web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'otro', randomUUID()]), invalido)
    await assert.rejects(web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, null, randomUUID()]), invalido)
    await assert.rejects(web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'inicial', null]), invalido)
    await assert.rejects(web(carla, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'inicial', randomUUID()]), sinPermiso)
    await assert.rejects(web(ana, 'public.pedir_peso_toma($1, $2, $3)', [randomUUID(), 'inicial', randomUUID()]), sinPermiso)

    // La Pico toma la orden y la confirma; la confirmación no fija ningún peso.
    const entregada = await web(picoAli, 'public.tomar_orden_modulo()')
    assert.equal(entregada.command_id, cmd)
    assert.deepEqual(entregada.params, { toma_id: t1, momento: 'inicial' })
    await web(picoAli, 'public.confirmar_orden_modulo($1, true, $2::jsonb, null)', [cmd, '{}'])
    assert.equal((await leer(t1)).peso_inicial_g, null)
  })

  await t.test('ingesta de pesos: credenciales, forma exacta y toma del mismo módulo', async () => {
    assert.equal(await peso(t1, 'inicial', 200, { token: 'e'.repeat(64) }), 'no_autorizado')
    assert.equal(await peso(t1, 'inicial', 200, { dispositivo: COLCHON, token: TOKEN_COLCHON }), 'no_autorizado')
    const malos = [
      ['peso_alimentacion', { toma_id: t1, momento: 'inicial' }],
      ['peso_alimentacion', { toma_id: t1, momento: 'inicial', gramos: 200, extra: 1 }],
      ['peso_alimentacion', { toma_id: t1, momento: 'inicial', gramos: '200' }],
      ['peso_alimentacion', { toma_id: t1, momento: 'inicial', gramos: 0 }],
      ['peso_alimentacion', { toma_id: t1, momento: 'inicial', gramos: -5 }],
      ['peso_alimentacion', { toma_id: t1, momento: 'inicial', gramos: 5001 }],
      ['peso_alimentacion', { toma_id: t1, momento: 'otro', gramos: 200 }],
      ['peso_alimentacion', { toma_id: 'x', momento: 'inicial', gramos: 200 }],
      ['peso_alimentacion', { toma_id: randomUUID(), momento: 'inicial', gramos: 200 }],
      ['peso_alimentacion', { toma_id: t1, momento: 'final', gramos: 150 }],
      ['peso_alimentacion_fallido', { toma_id: t1, momento: 'inicial', motivo: 'inventado' }],
      ['peso_alimentacion_fallido', { toma_id: t1, momento: 'inicial' }],
      ['temperatura_biberon', { temperatura_c: 200 }],
      ['temperatura_biberon', { temperatura_c: -60 }],
      ['temperatura_biberon', { temperatura_c: '37' }],
      ['temperatura_biberon', { temperatura_c: 37, extra: 1 }],
      ['temperatura_biberon', {}],
      ['peso_inventado', {}],
    ]
    for (const [tipo, datos] of malos) {
      assert.equal(await ingestar(randomUUID(), tipo, datos), 'evento_invalido', `${tipo} ${JSON.stringify(datos)}`)
    }
    // Una toma de otro módulo no se puede pesar con esta credencial.
    assert.equal(await peso(t1, 'inicial', 200, { dispositivo: ALI2, token: TOKEN_ALI2 }), 'evento_invalido')
    assert.equal(await contar('public.eventos', "tipo like 'peso%' or tipo like 'temperatura%'"), 0)
    assert.equal((await leer(t1)).peso_inicial_g, null)
    await assert.rejects(como('authenticated', ana, () => db.query(
      "select public.ingestar_alimentacion($1, $2, $3, 'temperatura_biberon', now(), now(), '{\"temperatura_c\": 30}'::jsonb)",
      [randomUUID(), ALI, TOKEN_ALI])), /permission denied/)
  })

  await t.test('un fallo de pesaje queda visible y se limpia al pedir otra vez o al recibir el peso', async () => {
    const f1 = randomUUID()
    assert.equal(await ingestar(f1, 'peso_alimentacion_fallido',
      { toma_id: t1, momento: 'inicial', motivo: 'sin_calibracion' }), 'creado')
    assert.equal((await leer(t1)).peso_error, 'sin_calibracion')
    assert.equal(await ingestar(f1, 'peso_alimentacion_fallido',
      { toma_id: t1, momento: 'inicial', motivo: 'sin_calibracion' }), 'duplicado')
    await assert.rejects(toma(ana, t1, 'iniciar_toma'), invalido, 'un fallo no es un peso')
    assert.equal((await web(ana, 'public.mis_tomas($1, 5)', [ALI])).tomas[0].peso_error, 'sin_calibracion')

    await web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'inicial', randomUUID()])
    assert.equal((await leer(t1)).peso_error, null)
  })

  await t.test('el peso inicial llega como evento, es idempotente y el aviso no lo incluye', async () => {
    const id = randomUUID()
    const datos = { toma_id: t1, momento: 'inicial', gramos: 200 }
    assert.equal(await ingestar(id, 'peso_alimentacion', datos), 'creado')
    const fila = await leer(t1)
    assert.equal(fila.peso_inicial_g, 200)
    assert.equal(fila.estado, 'preparando')
    assert.equal(await ingestar(id, 'peso_alimentacion', datos), 'duplicado')
    assert.equal(await ingestar(id, 'peso_alimentacion', { ...datos, gramos: 210 }), 'id_reutilizado')
    assert.equal((await leer(t1)).peso_inicial_g, 200)
    assert.equal(await avisos(), 0, 'un peso no avisa por Telegram')
    const ev = (await db.query("select valor, unidad, datos from public.eventos where event_id = $1", [id])).rows[0]
    assert.equal(ev.valor, 200)
    assert.equal(ev.unidad, 'g')
    assert.deepEqual(ev.datos, { toma_id: t1, momento: 'inicial' })
    // Un segundo pesaje inicial antes de empezar reemplaza al anterior.
    assert.equal(await peso(t1, 'inicial', 205), 'creado')
    assert.equal((await leer(t1)).peso_inicial_g, 205)
    assert.equal(await peso(t1, 'inicial', 200), 'creado')
  })

  await t.test('iniciar registra la hora y empieza el temporizador; la toma queda ligada al bebé y al módulo', async () => {
    const r = await toma(ana, t1, 'iniciar_toma')
    assert.equal(r.estado, 'en_curso')
    assert.ok(r.inicio)
    assert.equal(r.bebe_id, bebe)
    assert.equal(r.device_id, ALI)
    assert.equal(r.peso_inicial_g, 200)
    assert.equal(r.pausas.length, 0)
    await assert.rejects(toma(ana, t1, 'iniciar_toma'), estadoInvalido)
    assert.equal(await eventos('toma_iniciada'), 1)
    // El peso inicial ya no se reemplaza por un pesaje: solo por corrección.
    assert.equal(await peso(t1, 'inicial', 190), 'evento_invalido')
    assert.equal((await leer(t1)).peso_inicial_g, 200)
  })

  await t.test('devolver el biberón permite pesar pero no cierra ni cambia la toma (CA-21.5)', async () => {
    await web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'control', randomUUID()])
    assert.equal(await peso(t1, 'control', 180), 'creado')
    assert.equal(await peso(t1, 'control', 0), 'creado', 'el control sin recipiente se guarda tal cual')
    const fila = await leer(t1)
    assert.equal(fila.estado, 'en_curso')
    assert.equal(fila.peso_final_g, null)
    assert.equal(fila.ingerido_g, null)
    assert.equal(fila.fin, null)
    assert.equal(await contar('public.eventos', "tipo = 'peso_alimentacion' and datos ->> 'momento' = 'control'"), 2)
    // El peso final no se acepta hasta finalizar.
    assert.equal(await peso(t1, 'final', 150), 'evento_invalido')
    await assert.rejects(web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'final', randomUUID()]), estadoInvalido)
  })

  await t.test('pausar y reanudar continúan la misma toma', async () => {
    assert.equal((await toma(ana, t1, 'pausar_toma')).estado, 'pausada')
    await assert.rejects(toma(ana, t1, 'pausar_toma'), estadoInvalido)
    assert.equal(await peso(t1, 'control', 170), 'creado', 'también se puede pesar durante la pausa')
    const reanudada = await toma(beto, t1, 'reanudar_toma')
    assert.equal(reanudada.estado, 'en_curso')
    assert.equal(reanudada.id, t1)
    assert.equal(reanudada.pausas.length, 1)
    assert.ok(reanudada.pausas[0].fin)
    await assert.rejects(toma(ana, t1, 'reanudar_toma'), estadoInvalido)
    assert.equal(await contar('public.tomas'), 2, 'sigue siendo la misma toma (la otra es la cancelada del módulo 02)')
  })

  await t.test('finalizar fija el fin, cierra la pausa abierta y queda por cerrar sin cierre automático', async () => {
    await toma(ana, t1, 'pausar_toma')
    const r = await toma(ana, t1, 'finalizar_toma')
    assert.equal(r.estado, 'por_cerrar')
    assert.ok(r.fin)
    assert.equal(r.pausas.length, 2)
    assert.ok(r.pausas.every((p) => p.fin), 'ninguna pausa queda abierta')
    assert.equal(await contar('public.pausas_toma', 'toma_id = $1 and fin is null', [t1]), 0)
    await assert.rejects(toma(ana, t1, 'finalizar_toma'), estadoInvalido)
    // Pasar el tiempo no la cierra: sigue por cerrar.
    assert.equal((await leer(t1)).estado, 'por_cerrar')
  })

  await t.test('sin peso final o con un final mayor que el inicial no se cierra como completa (CA-21.6)', async () => {
    await assert.rejects(toma(ana, t1, 'cerrar_toma'), invalido, 'falta el peso final')
    assert.equal((await leer(t1)).estado, 'por_cerrar')

    assert.equal(await ingestar(randomUUID(), 'peso_alimentacion_fallido',
      { toma_id: t1, momento: 'final', motivo: 'sin_lectura' }), 'creado')
    await assert.rejects(toma(ana, t1, 'cerrar_toma'), invalido, 'lectura faltante')

    await web(ana, 'public.pedir_peso_toma($1, $2, $3)', [t1, 'final', randomUUID()])
    assert.equal(await peso(t1, 'final', 250), 'creado')
    assert.equal((await leer(t1)).peso_final_g, 250)
    await assert.rejects(toma(ana, t1, 'cerrar_toma'), invalido, 'final mayor que el inicial')
    const fila = await leer(t1)
    assert.equal(fila.estado, 'por_cerrar')
    assert.equal(fila.ingerido_g, null, 'nunca un consumo negativo')
    assert.equal(await eventos('toma_completa'), 0)
  })

  await t.test('corregir: conserva anterior, nuevo, autor, fecha y motivo; valida todo', async () => {
    await assert.rejects(toma(carla, t1, 'corregir_toma', 'peso_final_g', 150, 'el peso estaba mal'), sinPermiso)
    for (const [campo, valor, motivo, codigo] of [
      ['peso_final_g', 150, '', invalido],
      ['peso_final_g', 150, '   ', invalido],
      ['peso_final_g', 150, null, invalido],
      ['peso_final_g', 150, 'x'.repeat(201), invalido],
      ['peso_final_g', 0, 'motivo', invalido],
      ['peso_final_g', -3, 'motivo', invalido],
      ['peso_final_g', 5001, 'motivo', invalido],
      ['peso_final_g', null, 'motivo', invalido],
      ['peso_final_g', 250, 'sin cambio', invalido],
      ['peso_total', 150, 'motivo', invalido],
      [null, 150, 'motivo', invalido],
    ]) {
      await assert.rejects(toma(ana, t1, 'corregir_toma', campo, valor, motivo), codigo, `${campo} ${valor} ${motivo}`)
    }
    assert.equal(await contar('public.correcciones_toma'), 0, 'un rechazo no deja rastro')
    assert.equal((await leer(t1)).peso_final_g, 250)

    const r = await toma(ana, t1, 'corregir_toma', 'peso_final_g', 150, '  La balanza se movió  ')
    assert.equal(r.peso_final_g, 150)
    assert.equal(r.correcciones.length, 1)
    assert.equal(r.correcciones[0].campo, 'peso_final_g')
    assert.equal(r.correcciones[0].valor_anterior, 250)
    assert.equal(r.correcciones[0].valor_nuevo, 150)
    assert.equal(r.correcciones[0].motivo, 'La balanza se movió')
    assert.equal(r.correcciones[0].propia, true)
    assert.ok(r.correcciones[0].creada_en)
    const fila = (await db.query('select * from public.correcciones_toma')).rows[0]
    assert.equal(fila.autor_id, ana)
    assert.equal(fila.toma_id, t1)
    // Beto, otro dueño, ve la misma corrección como ajena.
    const vista = (await web(beto, 'public.mis_tomas($1, 5)', [ALI])).tomas[0]
    assert.equal(vista.correcciones[0].propia, false)
    assert.equal(vista.correcciones[0].motivo, 'La balanza se movió')
    assert.equal(JSON.stringify(vista).includes(ana), false, 'no se expone quién es el autor')
  })

  await t.test('cerrar la toma completa: gramos ingeridos = inicial − final (CA-21.4)', async () => {
    const r = await toma(ana, t1, 'cerrar_toma')
    assert.equal(r.estado, 'completa')
    assert.equal(r.peso_inicial_g, 200)
    assert.equal(r.peso_final_g, 150)
    assert.equal(r.ingerido_g, 50)
    assert.ok(r.inicio && r.fin)
    assert.ok(r.duracion_activa_s >= 0)
    assert.equal(await eventos('toma_completa'), 1)
    assert.equal((await db.query("select valor, unidad from public.eventos where tipo = 'toma_completa'")).rows[0].valor, 50)
    await assert.rejects(toma(ana, t1, 'cerrar_toma'), estadoInvalido)
    await assert.rejects(toma(ana, t1, 'cancelar_toma'), estadoInvalido)
    // La toma cerrada ya no bloquea una nueva.
    const siguiente = await crear()
    await toma(ana, siguiente, 'cancelar_toma')
    assert.equal((await leer(siguiente)).estado, 'cancelada')
    assert.equal((await leer(siguiente)).inicio, null)
  })

  await t.test('corregir una toma completa recalcula lo ingerido y rechaza un consumo negativo', async () => {
    const r = await toma(ana, t1, 'corregir_toma', 'peso_inicial_g', 220, 'Se pesó con la tapa')
    assert.equal(r.ingerido_g, 70)
    assert.equal(r.correcciones.length, 2)
    assert.deepEqual(r.correcciones.map((c) => [c.campo, c.valor_anterior, c.valor_nuevo]),
      [['peso_final_g', 250, 150], ['peso_inicial_g', 200, 220]])
    await assert.rejects(toma(ana, t1, 'corregir_toma', 'peso_final_g', 230, 'Dejaría un consumo negativo'), invalido)
    await assert.rejects(toma(ana, t1, 'corregir_toma', 'peso_inicial_g', 100, 'Dejaría un consumo negativo'), invalido)
    const fila = await leer(t1)
    assert.equal(fila.peso_inicial_g, 220)
    assert.equal(fila.peso_final_g, 150)
    assert.equal(fila.ingerido_g, 70)
    assert.equal(await contar('public.correcciones_toma'), 2, 'los rechazos no dejan rastro')
    const r2 = await toma(ana, t1, 'corregir_toma', 'peso_final_g', 140, 'Segunda lectura')
    assert.equal(r2.ingerido_g, 80)
    assert.equal(r2.correcciones.length, 3)
  })

  await t.test('las correcciones y las tomas no se borran ni se reescriben desde la web', async () => {
    for (const tabla of ['tomas', 'pausas_toma', 'correcciones_toma']) {
      await assert.rejects(como('authenticated', ana, () => db.query(`select * from public.${tabla}`)), /permission denied/, tabla)
      await assert.rejects(como('authenticated', ana, () => db.query(`delete from public.${tabla}`)), /permission denied/, tabla)
      await assert.rejects(como('authenticated', ana, () => db.query(`update public.${tabla} set id = id`)), /permission denied/, tabla)
      await assert.rejects(como('anon', null, () => db.query(`select * from public.${tabla}`)), /permission denied/, tabla)
    }
    // La base tampoco admite un peso final mayor que el inicial en una toma completa.
    await assert.rejects(db.query("update public.tomas set peso_final_g = 999 where id = $1", [t1]), { code: '23514' })
    await assert.rejects(db.query("update public.tomas set ingerido_g = 1 where id = $1", [t1]), { code: '23514' })
  })

  await t.test('mis_tomas: solo dueños, con límite válido y la hora del servidor', async () => {
    await assert.rejects(web(carla, 'public.mis_tomas($1, 5)', [ALI]), sinPermiso)
    await assert.rejects(web(ana, 'public.mis_tomas($1, 5)', [COLCHON]), sinPermiso)
    for (const limite of [0, 101, -1, null]) {
      await assert.rejects(web(ana, 'public.mis_tomas($1, $2)', [ALI, limite]), invalido, String(limite))
    }
    const r = await web(ana, 'public.mis_tomas($1, 20)', [ALI])
    assert.ok(r.ahora)
    assert.equal(r.tomas.length, 2)
    assert.equal(r.tomas[0].estado, 'cancelada', 'la más reciente primero')
    assert.equal(r.tomas[1].id, t1)
    assert.equal((await web(ana, 'public.mis_tomas($1, 1)', [ALI])).tomas.length, 1)
    assert.equal((await web(ana, 'public.mis_tomas($1, 5)', [ALI2])).tomas.length, 1)
    assert.deepEqual((await web(ana, 'public.mis_tomas($1, 5)', [ALI2])).tomas[0].estado, 'cancelada')
  })

  await t.test('CA-21.4: 08:00 a 08:15 con pausa de 08:05 a 08:07 conserva 13 minutos activos', async () => {
    const id = randomUUID()
    await db.query(
      `insert into public.tomas (id, device_id, bebe_id, estado, peso_inicial_g, peso_final_g, ingerido_g,
                                 creada_por, creada_en, inicio, fin)
       values ($1, $2, $3, 'completa', 200, 150, 50, $4, '2026-11-18T13:50:00Z',
               '2026-11-18T14:00:00Z', '2026-11-18T14:15:00Z')`, [id, ALI2, bebe, ana])
    await db.query("insert into public.pausas_toma (toma_id, inicio, fin) values ($1, '2026-11-18T14:05:00Z', '2026-11-18T14:07:00Z')", [id])
    const duracion = async (ahora) =>
      (await db.query('select cuna_private.duracion_activa_s($1, $2::timestamptz) as d', [id, ahora])).rows[0].d
    assert.equal(await duracion('2026-11-18T20:00:00Z'), 13 * 60, 'ya finalizada: no depende de la hora actual')

    // En curso con una pausa cerrada, y pausada con la pausa abierta (el tiempo no corre).
    const vivo = randomUUID()
    await db.query("update public.tomas set estado = 'cancelada', inicio = null, fin = null, ingerido_g = null, peso_final_g = null, peso_inicial_g = null where id = $1", [id])
    await db.query('delete from public.pausas_toma where toma_id = $1', [id])
    await db.query(
      `insert into public.tomas (id, device_id, bebe_id, estado, peso_inicial_g, creada_por, creada_en, inicio)
       values ($1, $2, $3, 'pausada', 200, $4, '2026-11-18T13:50:00Z', '2026-11-18T14:00:00Z')`, [vivo, ALI2, bebe, ana])
    await db.query("insert into public.pausas_toma (toma_id, inicio, fin) values ($1, '2026-11-18T14:02:00Z', '2026-11-18T14:03:00Z')", [vivo])
    await db.query("insert into public.pausas_toma (toma_id, inicio) values ($1, '2026-11-18T14:05:00Z')", [vivo])
    const duracionVivo = async (ahora) =>
      (await db.query('select cuna_private.duracion_activa_s($1, $2::timestamptz) as d', [vivo, ahora])).rows[0].d
    assert.equal(await duracionVivo('2026-11-18T14:10:00Z'), 4 * 60, 'cuenta 14:00-14:02 y 14:03-14:05')
    assert.equal(await duracionVivo('2026-11-18T15:00:00Z'), 4 * 60, 'en pausa no avanza')
    await db.query("update public.pausas_toma set fin = '2026-11-18T14:07:00Z' where toma_id = $1 and fin is null", [vivo])
    await db.query("update public.tomas set estado = 'en_curso' where id = $1", [vivo])
    assert.equal(await duracionVivo('2026-11-18T14:10:00Z'), 7 * 60, 'reanudada: 10 min menos 3 de pausa')
    await db.query("update public.tomas set estado = 'cancelada', inicio = null, peso_inicial_g = null where id = $1", [vivo])
    assert.equal(await duracionVivo('2026-11-18T14:10:00Z'), null, 'sin inicio no hay duración')
  })

  const LIMITES = [ALI, 5, 60]

  await t.test('los límites de frío y calor los define el dueño y un rechazo conserva los anteriores (CA-23.2)', async () => {
    assert.equal(await web(ana, 'public.mis_limites_biberon($1)', [ALI]), null)
    await assert.rejects(web(carla, 'public.guardar_limites_biberon($1, 5, 60)', [ALI]), sinPermiso)
    await assert.rejects(web(carla, 'public.mis_limites_biberon($1)', [ALI]), sinPermiso)
    await assert.rejects(web(ana, 'public.guardar_limites_biberon($1, 5, 60)', [COLCHON]), invalido, 'solo para módulos de alimentación')
    assert.deepEqual(await web(ana, 'public.guardar_limites_biberon($1, $2, $3)', LIMITES), { temp_min: 5, temp_max: 60 })
    for (const [min, max] of [[60, 5], [20, 20], [-11, 30], [20, 101], [null, 30], [20, null], ['NaN', 30], [20, 'Infinity']]) {
      await assert.rejects(web(ana, 'public.guardar_limites_biberon($1, $2::float8, $3::float8)', [ALI, min, max]), invalido, `${min} ${max}`)
    }
    assert.deepEqual(await web(beto, 'public.mis_limites_biberon($1)', [ALI]), { temp_min: 5, temp_max: 60 })
    await web(ana, 'public.guardar_limites_biberon($1, 5, 60)', [ALI])
  })

  await t.test('CA-23.1 y CA-23.3: la lectura se guarda y cada extremo avisa una vez por episodio y destinatario', async () => {
    const antes = await avisos()
    const aviso = (descripcion) => contar('cuna_private.avisos a join public.eventos e on e.event_id = a.event_id',
      'e.descripcion = $1', [descripcion])

    assert.equal(await temperatura(30, '2026-11-18T14:00:00Z'), 'creado')
    const lectura = (await db.query("select valor, unidad, descripcion from public.eventos where tipo = 'temperatura_biberon'")).rows[0]
    assert.deepEqual([lectura.valor, lectura.unidad], [30, '°C'])
    assert.equal(await avisos(), antes, 'dentro de límites no avisa')

    // Frío: avisa una sola vez mientras siga fuera.
    assert.equal(await temperatura(3, '2026-11-18T14:01:00Z'), 'creado')
    assert.equal(await aviso('Biberón por debajo del límite'), 2, 'un aviso por destinatario')
    assert.equal(await temperatura(2, '2026-11-18T14:02:00Z'), 'creado')
    assert.equal(await aviso('Biberón por debajo del límite'), 2, 'el mismo episodio no repite')
    // Pasar directo al calor es otro episodio y avisa de nuevo (ambos extremos).
    assert.equal(await temperatura(70, '2026-11-18T14:03:00Z'), 'creado')
    assert.equal(await aviso('Biberón por encima del límite'), 2)
    assert.equal(await aviso('Biberón por debajo del límite'), 2)
    // Volver al rango cierra los episodios; salir de nuevo avisa otra vez.
    assert.equal(await temperatura(40, '2026-11-18T14:04:00Z'), 'creado')
    assert.equal(await contar('cuna_private.episodios', "dispositivo_id = $1 and cerrado_en is null", [ALI]), 0)
    assert.equal(await temperatura(65, '2026-11-18T14:05:00Z'), 'creado')
    assert.equal(await aviso('Biberón por encima del límite'), 4)

    const fuera = (await db.query("select valor, unidad, datos from public.eventos where tipo = 'biberon_fuera_rango' order by ts limit 1")).rows[0]
    assert.deepEqual([fuera.valor, fuera.unidad], [3, '°C'])
    assert.deepEqual(fuera.datos, { variable: 'frio', minimo: 5, maximo: 60 })
  })

  await t.test('un reenvío de temperatura no repite ni la lectura ni el aviso; sin límites no hay aviso', async () => {
    const id = randomUUID()
    const datos = { temperatura_c: 1 }
    const antes = [await avisos(), await eventos('temperatura_biberon')]
    // Cerrar el episodio de frío abierto desde antes para observar un episodio nuevo.
    assert.equal(await temperatura(30, '2026-11-18T14:10:00Z'), 'creado')
    assert.equal(await temperatura(65, '2026-11-18T14:10:30Z'), 'creado') // abre calor
    assert.equal(await temperatura(30, '2026-11-18T14:11:00Z'), 'creado')
    const despuesDeAbrir = await avisos()
    assert.equal(await ingestar(id, 'temperatura_biberon', datos, { ts: '2026-11-18T14:12:00Z' }), 'creado')
    const conAviso = await avisos()
    assert.equal(conAviso, despuesDeAbrir + 2)
    assert.equal(await ingestar(id, 'temperatura_biberon', datos, { ts: '2026-11-18T14:12:00Z' }), 'duplicado')
    assert.equal(await ingestar(id, 'temperatura_biberon', { temperatura_c: 2 }, { ts: '2026-11-18T14:12:00Z' }), 'id_reutilizado')
    assert.equal(await avisos(), conAviso)
    assert.ok(await eventos('temperatura_biberon') > antes[1])

    // Otro módulo sin límites guardados: la lectura se guarda y no avisa.
    const sinLimites = await ingestar(randomUUID(), 'temperatura_biberon', { temperatura_c: 99 },
      { dispositivo: ALI2, token: TOKEN_ALI2 })
    assert.equal(sinLimites, 'creado')
    assert.equal(await avisos(), conAviso)
    assert.equal(await ingestar(randomUUID(), 'temperatura_biberon', { temperatura_c: 30 }, { ts: '2025-12-31T00:00:00Z' }),
      'sin_asignacion')
  })

  await t.test('el dispositivo no actúa: no hay órdenes ni columnas de calefacción, enfriamiento o suministro (CA-23.4)', async () => {
    const columnas = (await db.query(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public' and table_name in ('tomas', 'pausas_toma', 'correcciones_toma')`)).rows
    assert.ok(columnas.length > 10)
    for (const { column_name: c } of columnas) {
      assert.doesNotMatch(c, /calent|calor|enfri|calefac|suministr|dispens|motor|bomba|valvula/, c)
    }
    const comandos = (await db.query(
      "select c from unnest(array['feeding_weigh', 'feeding_heat', 'feeding_cool', 'feeding_dispense']) as c where cuna_private.comando_conocido(c)")).rows
    assert.deepEqual(comandos, [{ c: 'feeding_weigh' }], 'la única orden de alimentación es pesar')
    assert.equal((await db.query("select cuna_private.comando_solicitable('feeding_weigh') as s")).rows[0].s, false)
  })

  await t.test('CA-22: dos horas diarias generan un recordatorio cada una en America/Costa_Rica, sin horas intermedias', async () => {
    await assert.rejects(web(carla, 'public.reemplazar_horarios($1, $2, $3::time[])', [ALI, 'recordatorio_alimentacion', ['08:00']]), sinPermiso)
    assert.deepEqual(await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])',
      [ALI, 'recordatorio_alimentacion', ['11:00', '08:00']]), ['08:00', '11:00'])
    const procesar = (iso) => servicio('public.procesar_horarios($1::timestamptz)', [iso])
    const recordatorios = () => eventos('recordatorio_alimentacion')
    assert.equal((await procesar('2026-11-18T14:00:00Z')).ejecutados, 1, '08:00 CR = 14:00 UTC')
    assert.equal((await procesar('2026-11-18T17:00:00Z')).ejecutados, 1, '11:00 CR = 17:00 UTC')
    assert.equal((await procesar('2026-11-18T15:00:00Z')).ejecutados, 0, '09:00 CR no genera nada')
    assert.equal((await procesar('2026-11-18T16:00:00Z')).ejecutados, 0, '10:00 CR no genera nada')
    assert.equal(await recordatorios(), 2)
    assert.equal((await procesar('2026-11-19T14:00:00Z')).ejecutados, 1, 'todos los días')
    assert.equal(await recordatorios(), 3)
    const porDestinatario = await contar(
      'cuna_private.avisos a join public.eventos e on e.event_id = a.event_id', "e.tipo = 'recordatorio_alimentacion'")
    assert.equal(porDestinatario, 6, 'un aviso por recordatorio y destinatario')
    assert.deepEqual(await web(beto, 'public.mis_horarios($1, $2)', [ALI, 'recordatorio_alimentacion']), ['08:00', '11:00'])
    await assert.rejects(web(carla, 'public.mis_horarios($1, $2)', [ALI, 'recordatorio_alimentacion']), sinPermiso)
  })
})

test('La ingesta acepta y valida los eventos de alimentación', async (t) => {
  const recibidos = []
  const recibir = crearIngesta(
    async () => 'creado', undefined, undefined, undefined,
    async (evento) => { recibidos.push(evento); return 'creado' },
  )
  const pedir = (cuerpo, manejador = recibir) => manejador(new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${'56'.repeat(32)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }))
  const toma = randomUUID()
  const evento = (tipo, datos, extra = {}) => ({
    event_id: randomUUID(), device_id: ALI, tipo, ts: '2026-11-18T12:00:00Z', datos, ...extra,
  })

  await t.test('los tres tipos válidos llegan al guardado', async () => {
    for (const [tipo, datos] of [
      ['peso_alimentacion', { toma_id: toma, momento: 'inicial', gramos: 200.5 }],
      ['peso_alimentacion', { toma_id: toma, momento: 'control', gramos: 0 }],
      ['peso_alimentacion_fallido', { toma_id: toma, momento: 'final', motivo: 'sin_lectura' }],
      ['temperatura_biberon', { temperatura_c: 37.25 }],
      ['temperatura_biberon', { temperatura_c: -5 }],
    ]) {
      const cuerpo = evento(tipo, datos)
      const respuesta = await pedir(cuerpo)
      assert.equal(respuesta.status, 201, `${tipo} ${JSON.stringify(datos)}`)
      assert.deepEqual(await respuesta.json(), { event_id: cuerpo.event_id, estado: 'recibido' })
    }
    assert.equal(recibidos.length, 5)
    assert.deepEqual(recibidos[0].datos, { toma_id: toma, momento: 'inicial', gramos: 200.5 })
  })

  await t.test('forma inválida responde 400 sin llamar al guardado', async () => {
    const antes = recibidos.length
    for (const cuerpo of [
      evento('peso_alimentacion', { toma_id: toma, momento: 'inicial' }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'inicial', gramos: 0 }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'final', gramos: 0 }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'inicial', gramos: -1 }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'inicial', gramos: 5001 }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'inicial', gramos: '200' }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'inicial', gramos: 200, foto: 'x' }),
      evento('peso_alimentacion', { toma_id: toma, momento: 'otro', gramos: 200 }),
      evento('peso_alimentacion', { toma_id: 'x', momento: 'inicial', gramos: 200 }),
      evento('peso_alimentacion', [], {}),
      evento('peso_alimentacion_fallido', { toma_id: toma, momento: 'inicial', motivo: 'inventado' }),
      evento('peso_alimentacion_fallido', { toma_id: toma, momento: 'inicial' }),
      evento('temperatura_biberon', { temperatura_c: 126 }),
      evento('temperatura_biberon', { temperatura_c: -56 }),
      evento('temperatura_biberon', { temperatura_c: '37' }),
      evento('temperatura_biberon', { temperatura_c: 37, humedad_pct: 50 }),
      evento('temperatura_biberon', {}),
      evento('temperatura_biberon', { temperatura_c: 37 }, { device_id: COLCHON }),
      evento('temperatura_biberon', { temperatura_c: 37 }, { device_id: 'cuna-alimentacion-1' }),
      evento('temperatura_biberon', { temperatura_c: 37 }, { event_id: 'no-es-uuid' }),
      evento('temperatura_biberon', { temperatura_c: 37 }, { ts: '2026-11-18 12:00:00' }),
    ]) {
      const respuesta = await pedir(cuerpo)
      assert.equal(respuesta.status, 400, JSON.stringify(cuerpo))
      assert.equal((await respuesta.json()).codigo, 'evento_invalido')
    }
    assert.equal(recibidos.length, antes)
  })

  await t.test('sin guardado de alimentación configurado el evento se rechaza', async () => {
    const sin = crearIngesta(async () => 'creado', async () => 'creado', async () => 'creado', async () => 'creado')
    assert.equal((await pedir(evento('temperatura_biberon', { temperatura_c: 30 }), sin)).status, 400)
  })

  await t.test('una lectura de ambiente con la credencial de alimentación se rechaza sin tocar la base', async () => {
    let llamado = false
    const manejador = crearIngesta(async () => { llamado = true; return 'creado' })
    const respuesta = await pedir({
      event_id: randomUUID(), device_id: ALI, tipo: 'ambiente',
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
      const manejador = crearIngesta(async () => 'creado', undefined, undefined, undefined, async () => resultado)
      const respuesta = await pedir(evento('temperatura_biberon', { temperatura_c: 30 }), manejador)
      assert.equal(respuesta.status, estado, resultado)
      assert.equal((await respuesta.json()).codigo, codigo)
    }
    const caido = crearIngesta(async () => 'creado', undefined, undefined, undefined, async () => { throw new Error('x') })
    assert.equal((await pedir(evento('temperatura_biberon', { temperatura_c: 30 }), caido)).status, 503)
  })
})
