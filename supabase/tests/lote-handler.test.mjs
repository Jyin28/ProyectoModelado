import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearIngestaLote as crearIngesta } from '../functions/ingesta/lote.ts'

const TOKEN = 'ab'.repeat(32)
const AT = '2026-11-19T00:35:02Z'

function solicitud(cuerpo, token = TOKEN) {
  return new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

const ambiente = (extra = {}) => ({
  event_id: randomUUID(), type: 'ambiente', at: AT,
  data: { temperatura_c: 22.8, humedad_pct: 67 }, ...extra,
})
const movimiento = (extra = {}) => ({
  event_id: randomUUID(), type: 'movimiento', at: AT, data: {}, ...extra,
})

function conGuardar(resultado = { estado: 'ok', resultados: [] }) {
  const llamadas = []
  const manejar = crearIngesta(async (lote, hash, recibidoEn) => {
    llamadas.push({ lote, hash, recibidoEn })
    return resultado
  })
  return { manejar, llamadas }
}

test('el lote de ambiente sigue funcionando igual', async () => {
  const { manejar, llamadas } = conGuardar()
  const r = await manejar(solicitud({ device_id: 'pico2-cuna-01', events: [ambiente()] }))
  assert.equal(r.status, 200)
  assert.equal(llamadas.length, 1)
  assert.equal(llamadas[0].lote.events[0].type, 'ambiente')
})

test('los eventos del colchon siguen aceptandose', async () => {
  const { manejar } = conGuardar()
  const e = { event_id: randomUUID(), type: 'alarm_started', at: AT, data: { weight_g: 120 } }
  const r = await manejar(solicitud({ device_id: 'pico-figuras-colchon-01', events: [e] }))
  assert.equal(r.status, 200)
})

test('el movimiento se acepta solo, con data vacio', async () => {
  const { manejar, llamadas } = conGuardar()
  const r = await manejar(solicitud({ device_id: 'cuna-movimiento-01', events: [movimiento()] }))
  assert.equal(r.status, 200)
  assert.equal(llamadas[0].lote.events[0].type, 'movimiento')
  assert.equal(llamadas[0].lote.device_id, 'cuna-movimiento-01')
  assert.match(llamadas[0].hash, /^[0-9a-f]{64}$/)
})

test('el movimiento con datos se rechaza sin llegar a la base', async () => {
  const { manejar, llamadas } = conGuardar()
  const r = await manejar(solicitud({
    device_id: 'cuna-movimiento-01', events: [movimiento({ data: { x: 1 } })],
  }))
  assert.equal(r.status, 400)
  assert.equal((await r.json()).codigo, 'evento_invalido')
  assert.equal(llamadas.length, 0)
})

test('el movimiento no se mezcla con otros eventos', async () => {
  const { manejar, llamadas } = conGuardar()
  const r = await manejar(solicitud({
    device_id: 'cuna-movimiento-01', events: [movimiento(), ambiente()],
  }))
  assert.equal(r.status, 400)
  assert.equal((await r.json()).codigo, 'lote_invalido')
  assert.equal(llamadas.length, 0)
})

test('varios movimientos en un lote tampoco se aceptan', async () => {
  const { manejar, llamadas } = conGuardar()
  const r = await manejar(solicitud({
    device_id: 'cuna-movimiento-01', events: [movimiento(), movimiento()],
  }))
  assert.equal(r.status, 400)
  assert.equal(llamadas.length, 0)
})

test('los estados de la base se traducen a codigos HTTP', async () => {
  const casos = [['no_autorizado', 401], ['sin_asignacion', 422], ['id_reutilizado', 409],
    ['monitoreo_inactivo', 409], ['otro', 503]]
  for (const [estado, http] of casos) {
    const { manejar } = conGuardar({ estado })
    const r = await manejar(solicitud({ device_id: 'cuna-movimiento-01', events: [movimiento()] }))
    assert.equal(r.status, http, estado)
  }
})

test('sin credencial o con tipo desconocido se rechaza', async () => {
  const { manejar } = conGuardar()
  const sinToken = await manejar(new Request('http://localhost/', {
    method: 'POST', body: JSON.stringify({ device_id: 'x', events: [movimiento()] }),
  }))
  assert.equal(sinToken.status, 401)
  const raro = await manejar(solicitud({
    device_id: 'cuna-movimiento-01', events: [movimiento({ type: 'sismo' })],
  }))
  assert.equal(raro.status, 400)
})
