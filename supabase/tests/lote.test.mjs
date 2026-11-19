// Ingesta por lotes: el formato de la Pico del colchon y de la Pico 2 W contra la base
// completa (PGlite). Demuestra que conviven el colchon de Kevin (eventos_colchon,
// ordenes_colchon) y el backend de development (ambiente con limites, avisos de
// Telegram y movimiento), y que el enrutador acepta el lote y el evento unico.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearBase } from './_base.mjs'
import { crearEnrutador } from '../functions/ingesta/enrutador.ts'
import { crearIngesta } from '../functions/ingesta/handler.ts'
import { crearGuardarLote, crearIngestaLote } from '../functions/ingesta/lote.ts'

const AMBIENTE = 'cuna-ambiente-01'
const MOVIMIENTO = 'cuna-movimiento-01'
const COLCHON = 'pico-figuras-colchon-01'
const TOKEN = { [AMBIENTE]: 'a'.repeat(64), [MOVIMIENTO]: 'b'.repeat(64), [COLCHON]: 'c'.repeat(64) }
const hash = (valor) => createHash('sha256').update(valor).digest('hex')

test('Ingesta por lotes: colchon de Kevin, ambiente con avisos, movimiento y enrutador', async (t) => {
  const base = await crearBase()
  const { db, como, servicio, contar, usuario, bebe, asignar, web } = base
  t.after(() => db.close())

  const ana = await usuario('ana@example.com')
  const luna = await bebe('Luna')
  for (const [id, tipo, producto] of [[AMBIENTE, 'cuna', 'cuna-01'], [MOVIMIENTO, 'cuna', 'cuna-01'],
    [COLCHON, 'colchon', 'colchon-01']]) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, hash(TOKEN[id]), tipo, producto])
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, ana])
    await asignar(id, '2026-01-01T00:00:00Z', luna)
  }
  // Dos destinatarias de Telegram por modulo de aviso.
  for (const id of [AMBIENTE, MOVIMIENTO]) {
    for (const [nombre, chat] of [['Mamá', 1001], ['Papá', 1002]]) {
      await db.query(
        'insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, $2, $3)',
        [id, nombre, chat])
    }
  }

  // RPC como service_role (lo que hace la Edge Function), con argumentos con nombre.
  const rpc = async (nombre, cuerpo) => {
    const claves = Object.keys(cuerpo)
    const args = claves.map((k, i) => `${k} => $${i + 1}`).join(', ')
    const valores = claves.map((k) => (typeof cuerpo[k] === 'object' && cuerpo[k] !== null
      ? JSON.stringify(cuerpo[k]) : cuerpo[k]))
    const r = await como('service_role', null, () => db.query(`select public.${nombre}(${args}) as r`, valores))
    return r.rows[0].r
  }
  const lote = crearIngestaLote(crearGuardarLote(rpc))

  const enviar = (manejador, dispositivo, cuerpo, token = TOKEN[dispositivo]) => manejador(new Request(
    'http://localhost/functions/v1/ingesta', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }))
  const evento = (type, at, data = {}, event_id = randomUUID()) => ({ event_id, type, at, data })
  const ambiente = (at, temperatura, humedad, id) =>
    evento('ambiente', at, { temperatura_c: temperatura, humedad_pct: humedad }, id)

  await t.test('colchon de Kevin: los cuatro eventos del lote se guardan y el reenvio no duplica', async () => {
    const e1 = evento('monitoring_started', '2026-11-19T01:00:00Z', { reference_g: 200, tolerance_pct: 10, duration_s: 60, alarm_s: 30 })
    const e2 = evento('alarm_started', '2026-11-19T01:00:30Z', { weight_g: 150 })
    const e3 = evento('alarm_stopped', '2026-11-19T01:00:45Z', { reason: 'button' })
    const e4 = evento('monitoring_stopped', '2026-11-19T01:01:00Z', { reason: 'button' })
    const cuerpo = { device_id: COLCHON, events: [e1, e2, e3, e4] }

    const r = await enviar(lote, COLCHON, cuerpo)
    assert.equal(r.status, 200)
    assert.deepEqual((await r.json()).resultados.map((x) => x.estado), ['creado', 'creado', 'creado', 'creado'])
    assert.equal(await contar('public.eventos_colchon', 'device_id = $1', [COLCHON]), 4)

    const otra = await enviar(lote, COLCHON, cuerpo)
    assert.equal(otra.status, 200)
    assert.deepEqual((await otra.json()).resultados.map((x) => x.estado), ['duplicado', 'duplicado', 'duplicado', 'duplicado'])
    assert.equal(await contar('public.eventos_colchon', 'device_id = $1', [COLCHON]), 4)

    // Mismo event_id con otros datos: se rechaza sin tocar el registro original.
    const reutilizado = await enviar(lote, COLCHON, { device_id: COLCHON, events: [{ ...e2, data: { weight_g: 1 } }] })
    assert.equal(reutilizado.status, 409)
    assert.equal((await db.query('select datos from public.eventos_colchon where event_id = $1', [e2.event_id])).rows[0].datos.weight_g, 150)
  })

  await t.test('colchon de Kevin: ciclo de ordenes web -> Pico -> confirmacion', async () => {
    const id = randomUUID()
    await web(ana, 'public.solicitar_comando_colchon($1, $2, $3, $4::jsonb)',
      [id, COLCHON, 'mattress_start', '{"duration_s":60}'])
    assert.equal((await db.query('select estado from public.ordenes_colchon where command_id = $1', [id])).rows[0].estado,
      'pendiente')

    const tomadas = await como('anon', null, () => db.query(
      'select * from public.tomar_ordenes_colchon($1, $2)', [COLCHON, hash(TOKEN[COLCHON])]))
    assert.deepEqual(tomadas.rows.map((x) => [x.command_id, x.command]), [[id, 'mattress_start']])
    const otraVez = await como('anon', null, () => db.query(
      'select * from public.tomar_ordenes_colchon($1, $2)', [COLCHON, hash(TOKEN[COLCHON])]))
    assert.equal(otraVez.rows.length, 0, 'una orden se entrega una sola vez')

    const mala = await como('anon', null, () => db.query(
      'select * from public.tomar_ordenes_colchon($1, $2)', [COLCHON, hash('otro')]))
    assert.equal(mala.rows.length, 0, 'con otro token no se entrega nada')

    assert.equal(await servicio('public.confirmar_orden_colchon($1, $2, $3, true, null)',
      [id, COLCHON, hash(TOKEN[COLCHON])]), true)
    assert.equal((await db.query('select estado from public.ordenes_colchon where command_id = $1', [id])).rows[0].estado, 'confirmado')

    // Una persona ajena no puede pedir ordenes para el colchon.
    const ajena = await usuario('ajena@example.com')
    await assert.rejects(web(ajena, 'public.solicitar_comando_colchon($1, $2, $3, $4::jsonb)',
      [randomUUID(), COLCHON, 'mattress_stop', '{}']), { code: '42501' })
  })

  await t.test('HU-10: la dueña configura los limites del ambiente', async () => {
    const limites = await web(ana,
      'public.guardar_limites($1, $2::double precision, $3::double precision, $4::double precision, $5::double precision)',
      [AMBIENTE, 18, 26, 30, 65])
    assert.ok(limites, 'devuelve los limites guardados')
    await assert.rejects(web(ana,
      'public.guardar_limites($1, $2::double precision, $3::double precision, $4::double precision, $5::double precision)',
      [AMBIENTE, 30, 20, 30, 65]), { code: '22023' }, 'minimo mayor o igual que el maximo se rechaza')
  })

  await t.test('ambiente en lote: guarda la lectura y un aviso por destinataria y por episodio fuera de rango', async () => {
    const lectura = async (at, temp, hum, id) => {
      const r = await enviar(lote, AMBIENTE, { device_id: AMBIENTE, events: [ambiente(at, temp, hum, id)] })
      assert.equal(r.status, 200, await r.clone().text())
      return (await r.json()).resultados[0].estado
    }
    const episodios = () => contar('public.eventos', "tipo = 'ambiente_fuera_rango' and device_id = $1", [AMBIENTE])
    const avisos = () => contar('cuna_private.avisos',
      "event_id in (select event_id from public.eventos where tipo = 'ambiente_fuera_rango' and device_id = $1)", [AMBIENTE])

    assert.equal(await lectura('2026-11-19T02:00:00Z', 23, 50), 'creado')
    assert.equal(await episodios(), 0)

    assert.equal(await lectura('2026-11-19T02:00:15Z', 28, 50), 'creado')   // sale de rango
    assert.equal(await episodios(), 1)
    assert.equal(await avisos(), 2, 'un aviso por cada destinataria')

    await lectura('2026-11-19T02:00:30Z', 29, 50)                             // sigue fuera: mismo episodio
    await lectura('2026-11-19T02:00:45Z', 30, 50)
    assert.equal(await episodios(), 1)
    assert.equal(await avisos(), 2, 'varias lecturas del mismo episodio no repiten el aviso')

    await lectura('2026-11-19T02:01:00Z', 22, 50)                             // vuelve al rango
    await lectura('2026-11-19T02:01:15Z', 27, 50)                             // y sale otra vez
    assert.equal(await episodios(), 2)
    assert.equal(await avisos(), 4, 'un episodio nuevo genera otro aviso por destinataria')

    const repetida = randomUUID()
    assert.equal(await lectura('2026-11-19T02:01:30Z', 22, 50, repetida), 'creado')
    assert.equal(await lectura('2026-11-19T02:01:30Z', 22, 50, repetida), 'duplicado')
    assert.equal(await contar('public.lecturas_ambiente', 'event_id = $1', [repetida]), 1)
  })

  await t.test('dos lecturas distintas con la misma hora se conservan por separado', async () => {
    const at = '2026-11-19T03:00:00Z'
    const r = await enviar(lote, AMBIENTE, { device_id: AMBIENTE, events: [ambiente(at, 22, 50), ambiente(at, 22.5, 51)] })
    assert.equal(r.status, 200)
    assert.equal(await contar('public.lecturas_ambiente', 'device_id = $1 and ts = $2::timestamptz', [AMBIENTE, at]), 2)
  })

  await t.test('movimiento en lote: evento y aviso por destinataria; apagado no guarda; sin dueño de otro modulo', async () => {
    const mov = evento('movimiento', '2026-11-19T04:00:00Z')
    const r = await enviar(lote, MOVIMIENTO, { device_id: MOVIMIENTO, events: [mov] })
    assert.equal(r.status, 200, await r.clone().text())
    assert.equal(await contar('public.eventos_movimiento', 'event_id = $1', [mov.event_id]), 1)
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [mov.event_id]), 2)

    const reenvio = await enviar(lote, MOVIMIENTO, { device_id: MOVIMIENTO, events: [mov] })
    assert.equal(reenvio.status, 200)
    assert.equal(await contar('public.eventos_movimiento', 'event_id = $1', [mov.event_id]), 1)
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [mov.event_id]), 2, 'el reenvio no duplica avisos')

    // Monitoreo apagado por la cuidadora (estado confirmado por la Pico): HTTP 409, nada se guarda.
    await db.query(
      `insert into cuna_private.estado_modulo (dispositivo_id, estado, actualizado_en)
       values ($1, '{"monitoreo": false}'::jsonb, now())`, [MOVIMIENTO])
    const apagado = evento('movimiento', '2026-11-19T04:05:00Z')
    const r409 = await enviar(lote, MOVIMIENTO, { device_id: MOVIMIENTO, events: [apagado] })
    assert.equal(r409.status, 409)
    assert.equal((await r409.json()).codigo, 'monitoreo_inactivo')
    assert.equal(await contar('public.eventos_movimiento', 'event_id = $1', [apagado.event_id]), 0)

    // El token del ambiente no sirve para el movimiento, y el movimiento no se mezcla.
    const ajeno = await enviar(lote, MOVIMIENTO, { device_id: MOVIMIENTO, events: [evento('movimiento', '2026-11-19T04:06:00Z')] },
      TOKEN[AMBIENTE])
    assert.equal(ajeno.status, 401)
    const mezclado = await enviar(lote, MOVIMIENTO, { device_id: MOVIMIENTO, events: [evento('movimiento', '2026-11-19T04:07:00Z'), ambiente('2026-11-19T04:07:00Z', 22, 50)] })
    assert.equal(mezclado.status, 400)
  })

  await t.test('enrutador: el lote y el evento unico de development conviven en la misma funcion', async () => {
    const sinUsar = async () => { throw new Error('no debe llamarse') }
    const unico = crearIngesta(
      (e, tokenHash, recibidoEn) => rpc('ingestar_ambiente', {
        p_event_id: e.event_id, p_device_id: e.device_id, p_token_sha256: tokenHash, p_ts: e.ts,
        p_recibido_en: recibidoEn, p_temperatura_c: e.datos.temperatura_c, p_humedad_pct: e.datos.humedad_pct,
      }),
      sinUsar, sinUsar, sinUsar, sinUsar)
    const enrutador = crearEnrutador(unico, lote)

    const idUnico = randomUUID()
    const rUnico = await enviar(enrutador, AMBIENTE, {
      event_id: idUnico, device_id: AMBIENTE, tipo: 'ambiente', ts: '2026-11-19T05:00:00Z',
      datos: { temperatura_c: 23, humedad_pct: 50 },
    })
    assert.equal(rUnico.status, 201, 'evento unico de development')
    const idLote = randomUUID()
    const rLote = await enviar(enrutador, AMBIENTE, {
      device_id: AMBIENTE, events: [ambiente('2026-11-19T05:00:15Z', 23, 50, idLote)],
    })
    assert.equal(rLote.status, 200, 'lote de la Pico')
    assert.equal(await contar('public.lecturas_ambiente', 'event_id in ($1, $2)', [idUnico, idLote]), 2)

    // JSON invalido y cuerpo demasiado grande se rechazan antes de la base.
    const roto = await enrutador(new Request('http://localhost/', {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN[AMBIENTE]}` }, body: '{no es json',
    }))
    assert.equal(roto.status, 400)
    const grande = await enrutador(new Request('http://localhost/', {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN[AMBIENTE]}` }, body: 'x'.repeat(9000),
    }))
    assert.equal(grande.status, 413)
    const get = await enrutador(new Request('http://localhost/', { method: 'GET' }))
    assert.equal(get.status, 405)
  })
})
