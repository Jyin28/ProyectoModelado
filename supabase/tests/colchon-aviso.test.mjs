// Aviso por Telegram cuando suena la alarma del colchón (lote de la Pico del
// colchón → ingestar_lote → evento unificado `alarma_colchon` → avisos).
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearBase } from './_base.mjs'
import { textoAviso } from '../functions/notificador/handler.ts'

const COLCHON = 'pico-figuras-colchon-01'
const OTRO = 'cuna-ambiente-01'
const TOKEN = 'c'.repeat(64)
const hash = (valor) => createHash('sha256').update(valor).digest('hex')

test('alarma del colchón: un aviso por alarma nueva, nada por el resto de eventos', async (t) => {
  const { db, como, contar, usuario, bebe, asignar } = await crearBase()
  t.after(() => db.close())

  const ana = await usuario('ana@example.com')
  const luna = await bebe('Luna')
  for (const id of [COLCHON, OTRO]) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, hash(id === COLCHON ? TOKEN : 'x'.repeat(64)), id === COLCHON ? 'colchon' : 'cuna', 'p-' + id])
    await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, ana])
    await asignar(id, '2026-01-01T00:00:00Z', luna)
  }
  // Dos destinatarias del colchón y una de otro módulo (no debe recibir nada).
  for (const [dispositivo, nombre, chat] of [[COLCHON, 'Mamá', 1001], [COLCHON, 'Papá', 1002], [OTRO, 'Tía', 2001]]) {
    await db.query(
      'insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, $2, $3)',
      [dispositivo, nombre, chat])
  }

  const lote = async (events) => {
    const r = await como('service_role', null, () => db.query(
      'select public.ingestar_lote($1, $2, $3::timestamptz, $4::jsonb) as r',
      [COLCHON, hash(TOKEN), '2026-11-19T01:02:00Z', JSON.stringify(events)]))
    return r.rows[0].r
  }
  const ev = (type, at, data = {}, event_id = randomUUID()) => ({ event_id, type, at, data })

  await t.test('alarm_started genera el evento unificado y un aviso por destinataria del colchón', async () => {
    const alarma = ev('alarm_started', '2026-11-19T01:00:30Z', { weight_g: 150, reference_g: 200, threshold_g: 180 })
    const r = await lote([alarma])
    assert.equal(r.estado, 'ok')
    assert.equal(await contar('public.eventos_colchon', 'event_id = $1', [alarma.event_id]), 1)
    assert.equal(await contar('public.eventos', "event_id = $1 and tipo = 'alarma_colchon'", [alarma.event_id]), 1)
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [alarma.event_id]), 2)

    const pendientes = await como('service_role', null, () =>
      db.query('select public.avisos_pendientes(20) as r'))
    const avisos = pendientes.rows[0].r
    assert.deepEqual(avisos.map((a) => a.chat_id).sort(), [1001, 1002])
    assert.ok(avisos.every((a) => a.tipo === 'alarma_colchon' && a.device_id === COLCHON))
    // El texto de Telegram sale de la descripción: solo texto, con la hora de Costa Rica.
    assert.match(textoAviso(avisos[0]), /Alarma del colchón/)
    assert.match(textoAviso(avisos[0]), /hora de Costa Rica/)
  })

  await t.test('reenviar la misma alarma no repite el aviso', async () => {
    const alarma = ev('alarm_started', '2026-11-19T01:10:00Z', { weight_g: 140 })
    await lote([alarma])
    const antes = await contar('cuna_private.avisos')
    const r = await lote([alarma])
    assert.deepEqual(r.resultados.map((x) => x.estado), ['duplicado'])
    assert.equal(await contar('cuna_private.avisos'), antes)
    assert.equal(await contar('public.eventos', 'event_id = $1', [alarma.event_id]), 1)
  })

  await t.test('armar, silenciar y detener no avisan', async () => {
    const antes = await contar('cuna_private.avisos')
    const r = await lote([
      ev('monitoring_started', '2026-11-19T02:00:00Z', { reference_g: 200 }),
      ev('alarm_stopped', '2026-11-19T02:00:45Z', { reason: 'button' }),
      ev('monitoring_stopped', '2026-11-19T02:01:00Z', { reason: 'button' }),
    ])
    assert.deepEqual(r.resultados.map((x) => x.estado), ['creado', 'creado', 'creado'])
    assert.equal(await contar('cuna_private.avisos'), antes)
    assert.equal(await contar('public.eventos', "tipo = 'alarma_colchon' and ts >= '2026-11-19T02:00:00Z'"), 0)
  })

  await t.test('una alarma dentro de un lote con otros eventos avisa una sola vez', async () => {
    const alarma = ev('alarm_started', '2026-11-19T03:00:30Z', { weight_g: 90 })
    await lote([ev('monitoring_started', '2026-11-19T03:00:00Z', { reference_g: 200 }), alarma])
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [alarma.event_id]), 2)
  })

  await t.test('sin destinatarias vinculadas la alarma se guarda pero no crea avisos', async () => {
    await db.query("update cuna_private.destinatarios_telegram set activo = false where dispositivo_id = $1", [COLCHON])
    const alarma = ev('alarm_started', '2026-11-19T04:00:30Z', { weight_g: 80 })
    const r = await lote([alarma])
    assert.equal(r.estado, 'ok')
    assert.equal(await contar('public.eventos_colchon', 'event_id = $1', [alarma.event_id]), 1)
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [alarma.event_id]), 0)
  })
})
