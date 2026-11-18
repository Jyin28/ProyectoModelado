import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearIngesta } from '../functions/ingesta/handler.ts'

const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }
const enUso = { code: '23505' }
const noVigente = { code: '55000' }

const AMBIENTE = 'cuna-ambiente-01'
const AUDIO = 'cuna-audio-01'
const MOVIMIENTO = 'cuna-movimiento-01'
const LAMPARA = 'cuna-lampara-01'
const FIGURAS = 'cuna-figuras-01'
const COLCHON = 'cuna-colchon-01'
const TOKEN_AMBIENTE = 'a'.repeat(64)
const TOKEN_MOVIMIENTO = 'b'.repeat(64)

test('Órdenes por módulo, límites, monitoreo, horarios y voz (fase 5)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [ana, beto, carla, picoCuna, picoFiguras] = Array.from({ length: 5 }, () => randomUUID())
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
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }

  for (const id of [ana, beto, carla, picoCuna, picoFiguras]) {
    await db.query('insert into auth.users values ($1, $2)', [id, `${id}@example.com`])
  }
  await db.query("insert into cuna_private.bebes (id, nombre) values ($1, 'Luna')", [bebe])
  const modulos = [
    [AMBIENTE, TOKEN_AMBIENTE, 'cuna', 'cuna-01'],
    [AUDIO, '1'.repeat(64), 'cuna', 'cuna-01'],
    [MOVIMIENTO, TOKEN_MOVIMIENTO, 'cuna', 'cuna-01'],
    [LAMPARA, '2'.repeat(64), 'cuna', 'cuna-01'],
    [FIGURAS, '3'.repeat(64), 'figuras', 'figuras-01'],
    [COLCHON, '4'.repeat(64), 'colchon', 'colchon-01'],
  ]
  for (const [id, token, tipo, producto] of modulos) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, token, tipo, producto])
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, ana])
    await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-01-01T00:00:00Z', $2)", [id, bebe])
  }
  await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [AUDIO, beto])
  await db.query(
    'insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2), ($3, $4)',
    [picoCuna, LAMPARA, picoFiguras, FIGURAS])
  for (const dispositivo of [AMBIENTE, MOVIMIENTO]) {
    await db.query(
      "insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001)",
      [dispositivo])
  }

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

  const solicitar = (usuario, id, dispositivo, comando, params = {}) =>
    web(usuario, 'public.solicitar_orden($1, $2, $3, $4::jsonb)', [id, dispositivo, comando, JSON.stringify(params)])
  const tomar = (usuario) => web(usuario, 'public.tomar_orden_modulo()')
  const confirmar = (usuario, id, ok, resultado, error) =>
    web(usuario, 'public.confirmar_orden_modulo($1, $2, $3::jsonb, $4)',
      [id, ok, resultado === null ? null : JSON.stringify(resultado), error])
  const estado = (usuario, dispositivo) => web(usuario, 'public.estado_de_modulo($1)', [dispositivo])
  const senales = async (topico) =>
    (await db.query("select * from realtime.messages where event = 'orden_disponible' and topic = $1", [topico])).rows
  const veCanal = (rol, usuario, topico) => como(rol, usuario, async () => {
    await db.query("select set_config('realtime.topic', $1, false)", [topico])
    try {
      return (await db.query('select * from realtime.messages')).rows
    } finally {
      await db.query("select set_config('realtime.topic', '', false)")
    }
  })

  await t.test('solicitar_orden: autorización, comando por módulo y parámetros', async () => {
    const id = randomUUID()
    await assert.rejects(solicitar(carla, id, FIGURAS, 'led_all', { on: true }), sinPermiso)
    await assert.rejects(solicitar(null, id, FIGURAS, 'led_all', { on: true }), sinPermiso)
    await assert.rejects(solicitar(ana, id, 'cuna-figuras-99', 'led_all', { on: true }), sinPermiso)
    await assert.rejects(solicitar(ana, id, LAMPARA, 'led_all', { on: true }), sinPermiso)
    // Beto es dueño solo del audio.
    await assert.rejects(solicitar(beto, id, FIGURAS, 'led_all', { on: true }), sinPermiso)

    await assert.rejects(solicitar(ana, id, FIGURAS, 'inventado', {}), invalido)
    await assert.rejects(solicitar(ana, id, AUDIO, 'led_all', { on: true }), invalido)
    await assert.rejects(solicitar(ana, id, FIGURAS, 'audio_play', { sound: 'tono_suave' }), invalido)
    for (const [comando, params] of [
      ['led_set', { index: 6, on: true }],
      ['led_set', { index: -1, on: true }],
      ['led_set', { index: 1.5, on: true }],
      ['led_set', { index: 1, on: 'true' }],
      ['led_set', { index: 1 }],
      ['led_all', { on: true, extra: 1 }],
      ['led_sequence', { name: 'chase', step_s: 1 }],
      ['led_sequence', { name: 'chase', step_s: 3601 }],
      ['led_sequence', { name: 'otra', step_s: 5 }],
      ['led_sequence', { name: 'chase' }],
      ['led_stop', { on: false }],
    ]) {
      await assert.rejects(solicitar(ana, id, FIGURAS, comando, params), invalido, `${comando} ${JSON.stringify(params)}`)
    }
    await assert.rejects(solicitar(ana, id, AUDIO, 'audio_play', { sound: 'Tono Suave' }), invalido)
    await assert.rejects(solicitar(ana, id, AUDIO, 'audio_play', {}), invalido)
    await assert.rejects(solicitar(ana, id, MOVIMIENTO, 'motion_set', { enabled: 1 }), invalido)
    await assert.rejects(solicitar(ana, id, COLCHON, 'mattress_arm', { tolerance_pct: 100 }), invalido)
    await assert.rejects(solicitar(ana, id, COLCHON, 'mattress_arm', { alarm_s: 61 }), invalido)
    await assert.rejects(solicitar(ana, id, COLCHON, 'mattress_arm', { duration_s: 0 }), invalido)
    assert.equal(await contar('public.ordenes_modulo'), 0)
  })

  await t.test('una solicitud válida queda pendiente, con una señal sin datos y reenvío idempotente', async () => {
    const id = randomUUID()
    const orden = await solicitar(ana, id, FIGURAS, 'led_sequence', { name: 'chase', step_s: 2 })
    assert.equal(orden.estado, 'pendiente')
    assert.equal(new Date(orden.vence_en) - new Date(orden.creado_en), 15000)

    const lista = await senales('modulo:figuras-01')
    assert.equal(lista.length, 1)
    assert.deepEqual(lista[0].payload, { command_id: id })

    assert.deepEqual(await solicitar(ana, id, FIGURAS, 'led_sequence', { name: 'chase', step_s: 2 }), orden)
    assert.equal((await senales('modulo:figuras-01')).length, 1)
    await assert.rejects(solicitar(ana, id, FIGURAS, 'led_sequence', { name: 'chase', step_s: 3 }), enUso)
    await assert.rejects(solicitar(ana, id, FIGURAS, 'led_stop', {}), enUso)
    assert.equal(await contar('public.ordenes_modulo'), 1)
    // Ningún rol de API escribe directamente.
    await assert.rejects(como('authenticated', ana, () => db.query(
      "delete from public.ordenes_modulo")), /permission denied/)
  })

  await t.test('entrega solo a la cuenta del producto; una sola vez; confirmación real cambia el estado', async () => {
    // Estado antes de toda confirmación: vacío, no inventado.
    assert.deepEqual(await estado(ana, FIGURAS), { estado: {}, actualizado_en: null })

    await assert.rejects(tomar(ana), sinPermiso)
    await assert.rejects(tomar(null), sinPermiso)
    assert.equal(await tomar(picoCuna), null, 'otra cuna no recibe órdenes de las figuras')

    const orden = await tomar(picoFiguras)
    assert.equal(orden.device_id, FIGURAS)
    assert.equal(orden.command, 'led_sequence')
    assert.deepEqual(orden.params, { name: 'chase', step_s: 2 })
    assert.equal(await tomar(picoFiguras), null, 'una orden se entrega una sola vez')
    // Enviada pero sin confirmar: el estado sigue vacío.
    assert.deepEqual((await estado(ana, FIGURAS)).estado, {})

    await assert.rejects(confirmar(picoCuna, orden.command_id, true, {}, null), sinPermiso)
    await assert.rejects(confirmar(ana, orden.command_id, true, {}, null), sinPermiso)
    await assert.rejects(confirmar(picoFiguras, orden.command_id, true, {}, 'x'), invalido)
    await assert.rejects(confirmar(picoFiguras, orden.command_id, false, null, 'Mal Error!'), invalido)
    await assert.rejects(confirmar(picoFiguras, orden.command_id, null, null, null), invalido)

    const hecha = await confirmar(picoFiguras, orden.command_id, true, { sequence: 'chase' }, null)
    assert.equal(hecha.estado, 'confirmado')
    assert.deepEqual((await estado(ana, FIGURAS)).estado, { secuencia: 'chase' })
    assert.deepEqual(await confirmar(picoFiguras, orden.command_id, true, { sequence: 'chase' }, null), hecha)
    await assert.rejects(confirmar(picoFiguras, orden.command_id, true, { sequence: 'blink_all' }, null), enUso)
    await assert.rejects(confirmar(picoFiguras, orden.command_id, false, null, 'fallo'), enUso)

    // Un dueño ajeno al módulo no ve su estado.
    await assert.rejects(estado(carla, FIGURAS), sinPermiso)
  })

  await t.test('una orden con error no cambia el estado; una vencida no se entrega ni se confirma', async () => {
    const falla = randomUUID()
    await solicitar(ana, falla, FIGURAS, 'led_stop', {})
    const tomada = await tomar(picoFiguras)
    assert.equal(tomada.command_id, falla)
    const r = await confirmar(picoFiguras, falla, false, null, 'comando_de_otro_modulo:cuna')
    assert.equal(r.estado, 'error')
    assert.deepEqual((await estado(ana, FIGURAS)).estado, { secuencia: 'chase' })

    const vieja = randomUUID()
    await solicitar(ana, vieja, FIGURAS, 'led_all', { on: true })
    await db.query(`update public.ordenes_modulo set
      creado_en = creado_en - interval '20 seconds', vence_en = vence_en - interval '20 seconds'
      where command_id = $1`, [vieja])
    assert.equal(await tomar(picoFiguras), null)

    const casi = randomUUID()
    await solicitar(ana, casi, FIGURAS, 'led_all', { on: false })
    const tomadaCasi = await tomar(picoFiguras)
    assert.equal(tomadaCasi.command_id, casi)
    await db.query(`update public.ordenes_modulo set
      creado_en = creado_en - interval '20 seconds', vence_en = vence_en - interval '20 seconds',
      entregado_en = entregado_en - interval '20 seconds' where command_id = $1`, [casi])
    await assert.rejects(confirmar(picoFiguras, casi, true, {}, null), noVigente)
  })

  await t.test('canal Realtime: solo la cuenta del producto recibe su señal', async () => {
    const id = randomUUID()
    await solicitar(ana, id, FIGURAS, 'led_stop', {})
    assert.equal((await veCanal('authenticated', picoFiguras, 'modulo:figuras-01')).length > 0, true)
    assert.equal((await veCanal('authenticated', picoCuna, 'modulo:figuras-01')).length, 0)
    assert.equal((await veCanal('authenticated', ana, 'modulo:figuras-01')).length, 0)
    assert.equal((await veCanal('authenticated', carla, 'modulo:figuras-01')).length, 0)
    await assert.rejects(veCanal('anon', null, 'modulo:figuras-01'), /permission denied/)
  })

  await t.test('CA-11.3: audio_play confirmado registra actividad; con error no registra', async () => {
    const reproducir = randomUUID()
    await solicitar(beto, reproducir, AUDIO, 'audio_play', { sound: 'tono_suave' })
    const orden = await tomar(picoCuna)
    assert.equal(orden.command, 'audio_play')
    assert.equal(await contar('public.eventos', "tipo = 'audio'"), 0, 'la solicitud no es actividad')
    await confirmar(picoCuna, reproducir, true, { sound: 'tono_suave' }, null)
    assert.equal(await contar('public.eventos', "tipo = 'audio' and device_id = $1", [AUDIO]), 1)
    const evento = (await db.query("select * from public.eventos where tipo = 'audio'")).rows[0]
    assert.equal(evento.event_id, reproducir)
    assert.deepEqual(evento.datos, { sound: 'tono_suave' })
    assert.equal(evento.bebe_id, bebe)

    const falla = randomUUID()
    await solicitar(ana, falla, AUDIO, 'audio_play', { sound: 'tono_suave' })
    await tomar(picoCuna)
    await confirmar(picoCuna, falla, false, null, 'audio_en_curso')
    assert.equal(await contar('public.eventos', "tipo = 'audio'"), 1)
  })

  await t.test('CA-08.1 a CA-08.3: el monitoreo cambia solo con confirmación y filtra los eventos', async () => {
    const ingresar = (id = randomUUID()) => servicio(
      'public.ingestar_movimiento($1, $2, $3, $4::timestamptz, $5::timestamptz)',
      [id, MOVIMIENTO, TOKEN_MOVIMIENTO, '2026-11-18T12:00:00Z', '2026-11-18T12:00:01Z'])

    // Sin estado confirmado se conserva el comportamiento anterior.
    assert.equal(await ingresar(), 'creado')
    assert.equal(await contar('public.eventos', "tipo = 'movimiento'"), 1)
    assert.equal(await contar('cuna_private.avisos', "event_id in (select event_id from public.eventos where tipo = 'movimiento')"), 1)

    const activar = randomUUID()
    await solicitar(ana, activar, MOVIMIENTO, 'motion_set', { enabled: true })
    assert.equal(await tomar(picoCuna).then((o) => o.command), 'motion_set')
    assert.equal((await estado(ana, MOVIMIENTO)).estado.monitoreo, undefined)
    await confirmar(picoCuna, activar, true, {}, null)
    assert.equal((await estado(ana, MOVIMIENTO)).estado.monitoreo, true)
    const activo = randomUUID()
    assert.equal(await ingresar(activo), 'creado')
    assert.equal(await ingresar(activo), 'duplicado')
    assert.equal(await contar('public.eventos', "tipo = 'movimiento'"), 2)
    assert.equal(await contar('cuna_private.avisos', "event_id = $1", [activo]), 1, 'un aviso por evento y destinatario')

    const apagar = randomUUID()
    await solicitar(ana, apagar, MOVIMIENTO, 'motion_set', { enabled: false })
    await tomar(picoCuna)
    await confirmar(picoCuna, apagar, true, {}, null)
    assert.equal((await estado(ana, MOVIMIENTO)).estado.monitoreo, false)
    const antes = await contar('public.eventos', "tipo = 'movimiento'")
    assert.equal(await ingresar(), 'monitoreo_inactivo')
    assert.equal(await contar('public.eventos', "tipo = 'movimiento'"), antes)
    assert.equal(await contar('public.eventos_movimiento'), 2)
  })

  await t.test('CA-10.1 y CA-10.4: los límites exigen mínimo menor que máximo y un rechazo conserva el anterior', async () => {
    const guardar = (usuario, a, b, c, d, dispositivo = AMBIENTE) => web(usuario,
      'public.guardar_limites($1, $2::double precision, $3::double precision, $4::double precision, $5::double precision)',
      [dispositivo, a, b, c, d])
    await assert.rejects(guardar(carla, 20, 26, 40, 60), sinPermiso)
    await assert.rejects(guardar(ana, 20, 26, 40, 60, AUDIO), invalido)
    assert.equal(await web(ana, 'public.mis_limites($1)', [AMBIENTE]), null)

    const bien = await guardar(ana, 20, 26, 40, 60)
    assert.deepEqual(bien, { temp_min: 20, temp_max: 26, hum_min: 40, hum_max: 60 })
    for (const mal of [
      [26, 26, 40, 60], [27, 26, 40, 60], [20, 26, 60, 40], [20, 26, 40, 40],
      [-41, 26, 40, 60], [20, 86, 40, 60], [20, 26, -1, 60], [20, 26, 40, 101],
      [null, 26, 40, 60], [20, 26, 40, null], ['NaN', 26, 40, 60], [20, 'Infinity', 40, 60],
    ]) {
      await assert.rejects(guardar(ana, ...mal), invalido, JSON.stringify(mal))
    }
    await assert.rejects(web(carla, 'public.mis_limites($1)', [AMBIENTE]), sinPermiso)
    assert.deepEqual(await web(ana, 'public.mis_limites($1)', [AMBIENTE]), bien)
  })

  await t.test('CA-07.5 y CA-10.2: salir de rango abre un episodio con un aviso; volver y salir abre otro', async () => {
    const lectura = (ts, temperatura, humedad, id = randomUUID()) => servicio(
      'public.ingestar_ambiente($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::double precision, $7::double precision)',
      [id, AMBIENTE, TOKEN_AMBIENTE, ts, ts, temperatura, humedad])
    const fuera = () => contar('public.eventos', "tipo = 'ambiente_fuera_rango'")
    const avisos = () => contar('cuna_private.avisos', "event_id in (select event_id from public.eventos where tipo = 'ambiente_fuera_rango')")

    assert.equal(await lectura('2026-11-18T13:00:00Z', 23, 50), 'creado')
    assert.equal(await fuera(), 0)

    assert.equal(await lectura('2026-11-18T13:00:10Z', 28, 50), 'creado')
    assert.equal(await fuera(), 1)
    assert.equal(await avisos(), 1)
    const evento = (await db.query("select * from public.eventos where tipo = 'ambiente_fuera_rango'")).rows[0]
    assert.equal(evento.valor, 28)
    assert.equal(evento.unidad, '°C')
    assert.equal(evento.datos.variable, 'temperatura')

    // Continúa fuera de rango: mismo episodio, sin otro aviso.
    assert.equal(await lectura('2026-11-18T13:00:20Z', 29, 50), 'creado')
    assert.equal(await lectura('2026-11-18T13:00:30Z', 30, 50), 'creado')
    assert.equal(await fuera(), 1)

    // Un reenvío no vuelve a evaluar.
    const repetida = randomUUID()
    assert.equal(await lectura('2026-11-18T13:00:40Z', 22, 50, repetida), 'creado')
    assert.equal(await lectura('2026-11-18T13:00:40Z', 22, 50, repetida), 'duplicado')

    // Humedad: episodio independiente.
    assert.equal(await lectura('2026-11-18T13:00:50Z', 22, 70), 'creado')
    assert.equal(await fuera(), 2)
    assert.equal(await lectura('2026-11-18T13:01:00Z', 22, 71), 'creado')
    assert.equal(await fuera(), 2)

    // Vuelve al rango y vuelve a salir: episodio nuevo y aviso nuevo.
    assert.equal(await lectura('2026-11-18T13:01:10Z', 22, 50), 'creado')
    assert.equal(await lectura('2026-11-18T13:01:20Z', 27, 50), 'creado')
    assert.equal(await fuera(), 3)
    assert.equal(await avisos(), 3)
    assert.equal(await contar('cuna_private.episodios', 'cerrado_en is null'), 1)
  })

  await t.test('horarios de figuras y de monitoreo generan una orden por hora local, sin recuperar vencidos', async () => {
    const horario = (usuario, dispositivo, tipo, horas) =>
      web(usuario, 'public.reemplazar_horarios($1, $2, $3::time[])', [dispositivo, tipo, horas])
    await assert.rejects(horario(carla, FIGURAS, 'figuras_encender', ['20:00']), sinPermiso)
    assert.deepEqual(await horario(ana, FIGURAS, 'figuras_encender', ['20:00']), ['20:00'])
    assert.deepEqual(await horario(ana, FIGURAS, 'figuras_apagar', ['06:30']), ['06:30'])
    assert.deepEqual(await horario(ana, MOVIMIENTO, 'movimiento_activar', ['20:00']), ['20:00'])
    // Un tipo desconocido no genera nada.
    await horario(ana, FIGURAS, 'tipo_raro', ['20:00'])

    const antes = await contar('public.ordenes_modulo')
    // 20:00 en Costa Rica = 02:00 UTC del día siguiente.
    const r = await servicio('public.procesar_horarios($1::timestamptz)', ['2026-11-19T02:00:00Z'])
    assert.equal(r.ordenes, 2)
    assert.equal(await contar('public.ordenes_modulo', "origen = 'horario'"), 2)
    assert.equal(await contar('public.ordenes_modulo'), antes + 2)
    const orden = (await db.query(
      "select * from public.ordenes_modulo where origen = 'horario' and device_id = $1", [FIGURAS])).rows[0]
    assert.equal(orden.command, 'led_all')
    assert.deepEqual(orden.params, { on: true })
    assert.equal(orden.solicitante_id, null)

    // Mismo minuto otra vez, o un minuto después: nada nuevo.
    assert.equal((await servicio('public.procesar_horarios($1::timestamptz)', ['2026-11-19T02:00:30Z'])).ordenes, 0)
    assert.equal((await servicio('public.procesar_horarios($1::timestamptz)', ['2026-11-19T02:01:00Z'])).ordenes, 0)
    assert.equal(await contar('public.ordenes_modulo'), antes + 2)

    // La orden del horario llega a la Pico de las figuras.
    // Las órdenes se entregan en orden de creación; la del horario está entre ellas.
    const entregadas = []
    for (let i = 0; i < 6; i += 1) {
      const tomada = await tomar(picoFiguras)
      if (tomada === null) break
      entregadas.push(tomada)
    }
    assert.ok(entregadas.some((o) => o.command === 'led_all' && o.params.on === true && o.device_id === FIGURAS))
    assert.equal(entregadas.some((o) => o.device_id === MOVIMIENTO), false, 'las órdenes de la cuna no llegan a las figuras')
  })

  await t.test('CA-12: la voz viaja por un canal privado que usan solo los dueños y la Pico de la cuna', async () => {
    const insertar = (usuario, topico) => como('authenticated', usuario, async () => {
      await db.query("select set_config('realtime.topic', $1, false)", [topico])
      try {
        return await db.query(
          "insert into realtime.messages (topic, extension, payload, event, private) values ($1, 'broadcast', '{\"pcm\":\"AAA=\"}', 'voz', true)",
          [topico])
      } finally {
        await db.query("select set_config('realtime.topic', '', false)")
      }
    })

    await assert.rejects(insertar(carla, 'voz:cuna-01'), /row-level security/)
    await assert.rejects(insertar(picoCuna, 'voz:cuna-01'), /row-level security/)
    await assert.rejects(insertar(picoFiguras, 'voz:cuna-01'), /row-level security/)
    await assert.rejects(insertar(ana, 'voz:figuras-01'), /row-level security/)
    await assert.rejects(insertar(ana, 'voz:colchon-01'), /row-level security/)
    await insertar(beto, 'voz:cuna-01')
    await insertar(ana, 'voz:cuna-01')

    assert.equal((await veCanal('authenticated', picoCuna, 'voz:cuna-01')).length, 2)
    assert.equal((await veCanal('authenticated', picoFiguras, 'voz:cuna-01')).length, 0)
    assert.equal((await veCanal('authenticated', carla, 'voz:cuna-01')).length, 0)
    await assert.rejects(veCanal('anon', null, 'voz:cuna-01'), /permission denied/)
    await db.exec("delete from realtime.messages where event = 'voz'")
  })

  await t.test('CA-12.3: la actividad de voz queda como evento sin audio', async () => {
    const registrar = (usuario, id, dispositivo, fase) =>
      web(usuario, 'public.registrar_actividad_voz($1, $2, $3)', [id, dispositivo, fase])
    const id = randomUUID()
    assert.deepEqual(await registrar(ana, id, AUDIO, 'inicio'), { resultado: 'creado' })
    assert.deepEqual(await registrar(ana, id, AUDIO, 'inicio'), { resultado: 'duplicado' })
    assert.deepEqual(await registrar(ana, randomUUID(), AUDIO, 'fin'), { resultado: 'creado' })
    await assert.rejects(registrar(carla, randomUUID(), AUDIO, 'inicio'), sinPermiso)
    await assert.rejects(registrar(ana, randomUUID(), AUDIO, 'grabar'), invalido)
    await assert.rejects(registrar(ana, randomUUID(), AMBIENTE, 'inicio'), invalido)
    const filas = (await db.query("select tipo, datos from public.eventos where tipo like 'voz\\_%' order by tipo")).rows
    assert.deepEqual(filas.map((f) => f.tipo), ['voz_fin', 'voz_inicio'])
    for (const fila of filas) assert.deepEqual(fila.datos, {})
  })
})

test('La ingesta responde 409 sin reintento cuando el monitoreo está apagado', async () => {
  const recibir = crearIngesta(
    async () => 'creado',
    async () => 'monitoreo_inactivo',
  )
  const respuesta = await recibir(new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${'34'.repeat(32)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: randomUUID(), device_id: MOVIMIENTO, tipo: 'movimiento',
      ts: '2026-11-18T12:00:00Z', datos: {},
    }),
  }))
  assert.equal(respuesta.status, 409)
  assert.deepEqual(await respuesta.json(), {
    codigo: 'monitoreo_inactivo',
    mensaje: 'El monitoreo de movimiento está desactivado.',
    reintentable: false,
  })
})
