import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearIngesta } from '../functions/ingesta/handler.ts'

const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }
const yaResuelta = { code: '55000' }

const HABITACION = 'cuna-habitacion-01'
const COLCHON = 'cuna-colchon-01'
const TOKEN_HABITACION = 'b'.repeat(64)
const TOKEN_COLCHON = 'c'.repeat(64)

test('Habitación: monitoreo, eventos, horarios y fotos privadas (fase 7)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [ana, beto, carla, picoHabitacion] = Array.from({ length: 4 }, () => randomUUID())
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
    -- Esquema mínimo de Storage (lo real lo crea Supabase).
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
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }

  for (const id of [ana, beto, carla, picoHabitacion]) {
    await db.query('insert into auth.users values ($1, $2)', [id, `${id}@example.com`])
  }
  await db.query("insert into cuna_private.bebes (id, nombre) values ($1, 'Luna')", [bebe])
  for (const [id, token, tipo, producto] of [
    [HABITACION, TOKEN_HABITACION, 'habitacion', 'habitacion-01'],
    [COLCHON, TOKEN_COLCHON, 'colchon', 'colchon-01'],
  ]) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, token, tipo, producto])
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, ana])
  }
  await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-01-01T00:00:00Z', $2)", [HABITACION, bebe])
  await db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)', [picoHabitacion, HABITACION])
  await db.query(
    "insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001), ($1, 'Papá', 5002)",
    [HABITACION])

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

  const ingestar = (id, tipo, ts, { dispositivo = HABITACION, token = TOKEN_HABITACION, datos = {} } = {}) =>
    servicio('public.ingestar_habitacion($1, $2, $3, $4, $5, $6, $7::jsonb)',
      [id, dispositivo, token, tipo, ts, '2026-11-18T15:00:00Z', JSON.stringify(datos)])
  const orden = async (usuario, dispositivo, comando, params) => {
    const id = randomUUID()
    await web(usuario, 'public.solicitar_orden($1, $2, $3, $4::jsonb)', [id, dispositivo, comando, JSON.stringify(params)])
    return id
  }
  const confirmar = async (id, resultado = {}) => {
    const entregada = await web(picoHabitacion, 'public.tomar_orden_modulo()')
    assert.equal(entregada.command_id, id)
    await web(picoHabitacion, 'public.confirmar_orden_modulo($1, true, $2::jsonb, null)', [id, JSON.stringify(resultado)])
  }
  const estado = (usuario) => web(usuario, 'public.estado_de_modulo($1)', [HABITACION])
  const eventos = (tipo) => contar('public.eventos', 'device_id = $1 and tipo = $2', [HABITACION, tipo])
  const avisos = () => contar('cuna_private.avisos')
  const objeto = (usuario, nombre) => como('authenticated', usuario, () => db.query(
    "insert into storage.objects (bucket_id, name) values ('fotos-habitacion', $1)", [nombre]))
  const ruta = (id, ext = 'jpg') => `${HABITACION}/${id}.${ext}`

  await t.test('las órdenes de la habitación: solo el dueño, solo sus parámetros, solo su módulo', async () => {
    await assert.rejects(orden(carla, HABITACION, 'room_monitor_set', { sensor: 'puerta', enabled: true }), sinPermiso)
    await assert.rejects(orden(beto, HABITACION, 'room_monitor_set', { sensor: 'puerta', enabled: true }), sinPermiso)
    for (const params of [
      {}, { sensor: 'puerta' }, { enabled: true }, { sensor: 'camara', enabled: true },
      { sensor: 'puerta', enabled: 1 }, { sensor: 'puerta', enabled: 'true' },
      { sensor: 'puerta', enabled: true, extra: 1 }, { sensor: 3, enabled: true },
    ]) {
      await assert.rejects(orden(ana, HABITACION, 'room_monitor_set', params), invalido, JSON.stringify(params))
    }
    // Una orden de otro módulo no vale aquí, ni la de habitación en el colchón.
    await assert.rejects(orden(ana, HABITACION, 'motion_set', { enabled: true }), invalido)
    await assert.rejects(orden(ana, HABITACION, 'mattress_stop', {}), invalido)
    await assert.rejects(orden(ana, COLCHON, 'room_monitor_set', { sensor: 'puerta', enabled: true }), invalido)
    assert.equal(await contar('public.ordenes_modulo', 'device_id = $1', [HABITACION]), 0)
  })

  await t.test('la tabla también rechaza órdenes de habitación mal formadas', async () => {
    for (const [dispositivo, comando, params] of [
      [COLCHON, 'room_monitor_set', { sensor: 'puerta', enabled: true }],
      [HABITACION, 'room_monitor_set', { sensor: 'camara', enabled: true }],
      [HABITACION, 'led_stop', {}],
    ]) {
      await assert.rejects(db.query(
        `insert into public.ordenes_modulo (command_id, device_id, command, params, solicitante_id, creado_en, vence_en)
         values ($1, $2, $3, $4::jsonb, $5, '2026-11-18T14:00:00Z', '2026-11-18T14:00:15Z')`,
        [randomUUID(), dispositivo, comando, JSON.stringify(params), ana]), { code: '23514' }, comando)
    }
  })

  await t.test('sin confirmación el estado está vacío; cada sensor se confirma por separado', async () => {
    assert.deepEqual((await estado(ana)).estado, {})
    const id = await orden(ana, HABITACION, 'room_monitor_set', { sensor: 'puerta', enabled: true })
    assert.deepEqual((await estado(ana)).estado, {}, 'la solicitud no cambia el estado')
    await confirmar(id, { sensor: 'puerta', enabled: true })
    assert.deepEqual((await estado(ana)).estado, { monitoreo_puerta: true })
    await assert.rejects(estado(carla), sinPermiso)
  })

  await t.test('ingesta: credenciales y forma exacta', async () => {
    const f = '2026-11-18T14:00:00Z'
    assert.equal(await ingestar(randomUUID(), 'puerta', f, { token: 'e'.repeat(64) }), 'no_autorizado')
    assert.equal(await ingestar(randomUUID(), 'puerta', f, { dispositivo: COLCHON, token: TOKEN_COLCHON }), 'no_autorizado')
    assert.equal(await ingestar(randomUUID(), 'puerta', f, { datos: { direccion: 'entra' } }), 'evento_invalido')
    assert.equal(await ingestar(randomUUID(), 'camara', f), 'evento_invalido')
    assert.equal(await ingestar(randomUUID(), 'movimiento', f), 'evento_invalido')
    assert.equal(await eventos('puerta'), 0)
    assert.equal(await contar('public.fotos'), 0)
    await assert.rejects(como('authenticated', ana, () => db.query(
      "select public.ingestar_habitacion($1, $2, $3, 'puerta', now(), now(), '{}'::jsonb)",
      [randomUUID(), HABITACION, TOKEN_HABITACION])), /permission denied/)
  })

  const puerta1 = randomUUID()
  const puerta2 = randomUUID()
  const mov1 = randomUUID()

  await t.test('puerta y movimiento: un evento, un aviso por destinatario y una solicitud de foto cada uno', async () => {
    assert.equal(await ingestar(puerta1, 'puerta', '2026-11-18T14:00:00Z'), 'creado')
    assert.equal(await eventos('puerta'), 1)
    assert.equal(await avisos(), 2, 'dos destinatarios, un aviso cada uno')
    const foto = (await db.query('select * from public.fotos where event_id = $1', [puerta1])).rows[0]
    assert.equal(foto.estado, 'pendiente')
    assert.equal(foto.bebe_id, bebe)
    assert.equal(foto.device_id, HABITACION)
    assert.equal(foto.ruta, null)

    // Puerta y movimiento con la misma hora: dos eventos y dos solicitudes (CA-17.5).
    assert.equal(await ingestar(puerta2, 'puerta', '2026-11-18T14:00:00Z'), 'creado')
    assert.equal(await ingestar(mov1, 'movimiento_habitacion', '2026-11-18T14:00:00Z'), 'creado')
    assert.equal(await eventos('puerta'), 2)
    assert.equal(await eventos('movimiento_habitacion'), 1)
    assert.equal(await contar('public.fotos'), 3)
    assert.equal(await avisos(), 6)
  })

  await t.test('un reenvío no duplica evento, aviso ni foto; reutilizar el id con otros datos se rechaza', async () => {
    assert.equal(await ingestar(puerta1, 'puerta', '2026-11-18T14:00:00Z'), 'duplicado')
    assert.equal(await ingestar(puerta1, 'puerta', '2026-11-18T14:05:00Z'), 'id_reutilizado')
    assert.equal(await ingestar(puerta1, 'movimiento_habitacion', '2026-11-18T14:00:00Z'), 'id_reutilizado')
    assert.equal(await eventos('puerta'), 2)
    assert.equal(await contar('public.fotos'), 3)
    assert.equal(await avisos(), 6)
  })

  await t.test('sin bebé asignado en ese instante no se guarda nada', async () => {
    assert.equal(await ingestar(randomUUID(), 'puerta', '2025-12-31T23:00:00Z'), 'sin_asignacion')
    assert.equal(await contar('public.fotos'), 3)
  })

  await t.test('con el monitoreo de un sensor apagado se rechaza solo ese sensor', async () => {
    const id = await orden(ana, HABITACION, 'room_monitor_set', { sensor: 'puerta', enabled: false })
    await confirmar(id)
    assert.deepEqual((await estado(ana)).estado, { monitoreo_puerta: false })
    const antes = [await eventos('puerta'), await contar('public.fotos'), await avisos()]
    assert.equal(await ingestar(randomUUID(), 'puerta', '2026-11-18T16:00:00Z'), 'monitoreo_inactivo')
    assert.deepEqual([await eventos('puerta'), await contar('public.fotos'), await avisos()], antes)
    assert.equal(await ingestar(randomUUID(), 'movimiento_habitacion', '2026-11-18T16:00:00Z'), 'creado',
      'el movimiento no tiene estado confirmado: se acepta')

    const id2 = await orden(ana, HABITACION, 'room_monitor_set', { sensor: 'movimiento', enabled: false })
    await confirmar(id2)
    assert.deepEqual((await estado(ana)).estado, { monitoreo_puerta: false, monitoreo_movimiento: false })
    assert.equal(await ingestar(randomUUID(), 'movimiento_habitacion', '2026-11-18T16:05:00Z'), 'monitoreo_inactivo')

    const id3 = await orden(ana, HABITACION, 'room_monitor_set', { sensor: 'puerta', enabled: true })
    await confirmar(id3)
    assert.equal(await ingestar(randomUUID(), 'puerta', '2026-11-18T16:10:00Z'), 'creado')
  })

  await t.test('horarios: activar y desactivar cada sensor genera su orden en el minuto exacto', async () => {
    for (const tipo of ['habitacion_puerta_activar', 'habitacion_puerta_desactivar',
      'habitacion_movimiento_activar', 'habitacion_movimiento_desactivar']) {
      await assert.rejects(web(carla, 'public.reemplazar_horarios($1, $2, $3::time[])', [HABITACION, tipo, ['21:00']]), sinPermiso)
    }
    assert.deepEqual(await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])',
      [HABITACION, 'habitacion_puerta_desactivar', ['06:00']]), ['06:00'])
    await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])', [HABITACION, 'habitacion_puerta_activar', ['21:00']])
    await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])', [HABITACION, 'habitacion_movimiento_activar', ['21:00']])

    const procesar = (iso) => servicio('public.procesar_horarios($1::timestamptz)', [iso])
    const ordenes = () => contar('public.ordenes_modulo', "device_id = $1 and origen = 'horario'", [HABITACION])
    assert.equal((await procesar('2026-11-19T02:59:00Z')).ordenes, 0, 'un minuto antes no hay nada')
    // 21:00 en Costa Rica (UTC-6) = 03:00 UTC.
    assert.equal((await procesar('2026-11-19T03:00:00Z')).ordenes, 2)
    assert.equal((await procesar('2026-11-19T03:00:30Z')).ordenes, 0, 'el mismo horario no corre dos veces')
    assert.equal(await ordenes(), 2)
    const comandos = (await db.query(
      "select params from public.ordenes_modulo where device_id = $1 and origen = 'horario' order by params::text", [HABITACION])).rows
    assert.deepEqual(comandos.map((c) => c.params), [
      { sensor: 'movimiento', enabled: true }, { sensor: 'puerta', enabled: true }])
    assert.equal((await procesar('2026-11-19T12:00:00Z')).ordenes, 1, '06:00 hora de Costa Rica desactiva la puerta')
    assert.equal((await db.query(
      "select params from public.ordenes_modulo where device_id = $1 and origen = 'horario' order by creado_en desc limit 1", [HABITACION])).rows[0].params.enabled, false)
  })

  await t.test('las fotos solo las ve su dueño y no se escriben directamente', async () => {
    assert.equal((await como('authenticated', ana, () => db.query('select * from public.fotos'))).rows.length, 3 + 2)
    assert.equal((await como('authenticated', beto, () => db.query('select * from public.fotos'))).rows.length, 0)
    await assert.rejects(como('authenticated', ana, () => db.query("update public.fotos set estado = 'guardada'")), /permission denied/)
    await assert.rejects(como('authenticated', ana, () => db.query('delete from public.fotos')), /permission denied/)
    await assert.rejects(como('anon', null, () => db.query('select * from public.fotos')), /permission denied/)
  })

  await t.test('almacén privado: solo el dueño sube y lee, solo a la ruta de una foto pendiente', async () => {
    const bucket = (await db.query("select * from storage.buckets where id = 'fotos-habitacion'")).rows[0]
    assert.equal(bucket.public, false)
    assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png'])
    assert.equal(Number(bucket.file_size_limit), 5242880)

    await assert.rejects(objeto(beto, ruta(puerta1)), /row-level security/)
    await assert.rejects(objeto(carla, ruta(puerta1)), /row-level security/)
    await assert.rejects(objeto(ana, ruta(randomUUID())), /row-level security/, 'sin solicitud de foto')
    await assert.rejects(objeto(ana, `${HABITACION}/${puerta1}.gif`), /row-level security/)
    await assert.rejects(objeto(ana, `${HABITACION}/otra/${puerta1}.jpg`), /row-level security/)
    await assert.rejects(objeto(ana, `cuna-habitacion-02/${puerta1}.jpg`), /row-level security/)
    await assert.rejects(objeto(ana, `${puerta1}.jpg`), /row-level security/)
    assert.equal(await contar('storage.objects'), 0)

    await objeto(ana, ruta(puerta1))
    assert.equal(await contar('storage.objects'), 1)
    assert.equal((await como('authenticated', ana, () => db.query('select name from storage.objects'))).rows.length, 1)
    assert.equal((await como('authenticated', beto, () => db.query('select name from storage.objects'))).rows.length, 0)
    await assert.rejects(como('authenticated', ana, () => db.query('delete from storage.objects')), /permission denied/)
    await assert.rejects(como('authenticated', ana, () => db.query("update storage.objects set name = 'x'")), /permission denied/)
  })

  await t.test('registrar_foto: valida dueño, ruta y objeto; avisa solo con texto fijo', async () => {
    const avisosAntes = await avisos()
    await assert.rejects(web(beto, 'public.registrar_foto($1, $2)', [puerta1, ruta(puerta1)]), sinPermiso)
    await assert.rejects(web(null, 'public.registrar_foto($1, $2)', [puerta1, ruta(puerta1)]), sinPermiso)
    await assert.rejects(web(ana, 'public.registrar_foto($1, $2)', [randomUUID(), ruta(puerta1)]), sinPermiso)
    await assert.rejects(web(ana, 'public.registrar_foto($1, $2)', [puerta1, ruta(puerta2)]), invalido)
    await assert.rejects(web(ana, 'public.registrar_foto($1, $2)', [puerta1, `${HABITACION}/${puerta1}.gif`]), invalido)
    // Sin objeto subido no hay foto, aunque la ruta sea correcta.
    await assert.rejects(web(ana, 'public.registrar_foto($1, $2)', [puerta2, ruta(puerta2)]), invalido)
    assert.equal((await db.query('select estado from public.fotos where event_id = $1', [puerta2])).rows[0].estado, 'pendiente')
    assert.equal(await eventos('foto_tomada'), 0)

    assert.deepEqual(await web(ana, 'public.registrar_foto($1, $2)', [puerta1, ruta(puerta1)]),
      { estado: 'guardada', resultado: 'creado' })
    const foto = (await db.query('select * from public.fotos where event_id = $1', [puerta1])).rows[0]
    assert.equal(foto.estado, 'guardada')
    assert.equal(foto.ruta, ruta(puerta1))
    assert.notEqual(foto.resuelta_en, null)

    assert.equal(await eventos('foto_tomada'), 1)
    assert.equal(await avisos(), avisosAntes + 2, 'un aviso por destinatario')
    const aviso = (await db.query("select descripcion, datos from public.eventos where tipo = 'foto_tomada'")).rows[0]
    assert.equal(aviso.descripcion, 'Se tomó una fotografía')
    assert.deepEqual(aviso.datos, { evento_id: puerta1 })
    assert.equal(JSON.stringify(aviso).includes('jpg'), false, 'ni la imagen ni su ruta viajan en el aviso')

    // Reintento idéntico: sin segundo evento ni aviso.
    assert.deepEqual(await web(ana, 'public.registrar_foto($1, $2)', [puerta1, ruta(puerta1)]),
      { estado: 'guardada', resultado: 'duplicado' })
    assert.equal(await eventos('foto_tomada'), 1)
    assert.equal(await avisos(), avisosAntes + 2)
    await assert.rejects(web(ana, 'public.registrar_foto($1, $2)', [puerta1, ruta(puerta1, 'png')]), yaResuelta)
  })

  await t.test('una foto guardada ya no admite otra subida', async () => {
    await assert.rejects(objeto(ana, ruta(puerta1, 'png')), /row-level security/)
    await assert.rejects(objeto(ana, ruta(puerta1)), /row-level security/)
  })

  await t.test('si la captura falla, el estado visible lo dice y se puede reintentar', async () => {
    await assert.rejects(web(beto, 'public.marcar_foto_fallida($1, $2)', [puerta2, 'carga_fallida']), sinPermiso)
    await assert.rejects(web(ana, 'public.marcar_foto_fallida($1, $2)', [puerta2, 'otro']), invalido)
    await assert.rejects(web(ana, 'public.marcar_foto_fallida($1, $2)', [puerta2, null]), invalido)
    await assert.rejects(web(ana, 'public.marcar_foto_fallida($1, $2)', [puerta1, 'carga_fallida']), yaResuelta)

    assert.deepEqual(await web(ana, 'public.marcar_foto_fallida($1, $2)', [puerta2, 'camara_no_disponible']),
      { estado: 'fallida', motivo: 'camara_no_disponible' })
    const fila = (await db.query('select estado, motivo, ruta from public.fotos where event_id = $1', [puerta2])).rows[0]
    assert.deepEqual(fila, { estado: 'fallida', motivo: 'camara_no_disponible', ruta: null })
    assert.equal(await eventos('foto_tomada'), 1, 'un fallo no avisa por Telegram')

    // El teléfono reintenta: sube y registra; el motivo se borra.
    await objeto(ana, ruta(puerta2))
    await web(ana, 'public.registrar_foto($1, $2)', [puerta2, ruta(puerta2)])
    assert.deepEqual((await db.query('select estado, motivo from public.fotos where event_id = $1', [puerta2])).rows[0],
      { estado: 'guardada', motivo: null })
    assert.equal(await eventos('foto_tomada'), 2)
  })

  await t.test('ninguna foto ni evento se borra al retirar a un dueño', async () => {
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [HABITACION, beto])
    assert.equal((await como('authenticated', beto, () => db.query('select * from public.fotos'))).rows.length > 0, true)
    await db.query('update cuna_private.duenos_dispositivo set activo = false where dispositivo_id = $1 and usuario_id = $2', [HABITACION, beto])
    assert.equal((await como('authenticated', beto, () => db.query('select * from public.fotos'))).rows.length, 0)
    await assert.rejects(objeto(beto, ruta(puerta1)), /row-level security/)
    assert.equal(await contar('public.fotos'), 3 + 2, 'el historial sigue completo')
  })

  await t.test('no existe tabla ni columna de video ni de imagen en la base', async () => {
    const columnas = (await db.query(`
      select table_name, column_name from information_schema.columns
      where table_schema in ('public', 'cuna_private')
        and (column_name ~* '(video|imagen|blob|bytes|contenido)' or data_type = 'bytea')`)).rows
    assert.deepEqual(columnas, [])
  })
})

test('La ingesta acepta los eventos de la habitación y los valida antes de la base', async (t) => {
  const recibidos = []
  const recibir = crearIngesta(
    async () => 'creado',
    async () => 'creado',
    async () => 'creado',
    async (evento) => {
      recibidos.push(evento)
      return 'creado'
    },
  )
  const pedir = (cuerpo, manejador = recibir) => manejador(new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${'56'.repeat(32)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  }))
  const evento = (tipo, datos = {}, extra = {}) => ({
    event_id: randomUUID(), device_id: HABITACION, tipo, ts: '2026-11-18T12:00:00Z', datos, ...extra,
  })

  await t.test('los dos tipos válidos llegan al guardado', async () => {
    for (const tipo of ['puerta', 'movimiento_habitacion']) {
      const cuerpo = evento(tipo)
      const respuesta = await pedir(cuerpo)
      assert.equal(respuesta.status, 201, tipo)
      assert.deepEqual(await respuesta.json(), { event_id: cuerpo.event_id, estado: 'recibido' })
    }
    assert.deepEqual(recibidos.map((e) => e.tipo), ['puerta', 'movimiento_habitacion'])
    assert.deepEqual(recibidos[0].datos, {})
  })

  await t.test('forma inválida responde 400 sin llamar al guardado', async () => {
    const antes = recibidos.length
    for (const cuerpo of [
      evento('puerta', { direccion: 'entra' }),
      evento('puerta', { foto: 'x' }),
      evento('puerta', []),
      evento('puerta', {}, { device_id: COLCHON }),
      evento('puerta', {}, { device_id: 'cuna-habitacion-1' }),
      evento('puerta', {}, { event_id: 'no-es-uuid' }),
      evento('puerta', {}, { ts: '2026-11-18 12:00:00' }),
    ]) {
      const respuesta = await pedir(cuerpo)
      assert.equal(respuesta.status, 400, JSON.stringify(cuerpo))
      assert.equal((await respuesta.json()).codigo, 'evento_invalido')
    }
    assert.equal(recibidos.length, antes)
  })

  await t.test('sin guardado de habitación configurado el evento se rechaza', async () => {
    const sinHabitacion = crearIngesta(async () => 'creado', async () => 'creado', async () => 'creado')
    assert.equal((await pedir(evento('puerta'), sinHabitacion)).status, 400)
  })

  await t.test('una lectura de ambiente con la credencial de la habitación se rechaza sin tocar la base', async () => {
    let llamado = false
    const manejador = crearIngesta(async () => { llamado = true; return 'creado' })
    const respuesta = await pedir({
      event_id: randomUUID(), device_id: HABITACION, tipo: 'ambiente',
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
      monitoreo_inactivo: [409, 'monitoreo_inactivo'],
    }
    for (const [resultado, [estado, codigo]] of Object.entries(esperados)) {
      const manejador = crearIngesta(async () => 'creado', undefined, undefined, async () => resultado)
      const respuesta = await pedir(evento('puerta'), manejador)
      assert.equal(respuesta.status, estado, resultado)
      assert.equal((await respuesta.json()).codigo, codigo)
    }
    const caido = crearIngesta(async () => 'creado', undefined, undefined, async () => { throw new Error('x') })
    assert.equal((await pedir(evento('puerta'), caido)).status, 503)
  })
})
