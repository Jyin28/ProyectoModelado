import { describe, expect, it } from 'vitest'
import type { ComandoModulo, OrdenModulo } from '../src/models/ordenes.ts'
import {
  comandoValido,
  estadoVisibleOrden,
  horaValida,
  parsearIntervalo,
  validarLimites,
} from '../src/utils/ordenes.ts'
import {
  aBase64,
  aPcm8k,
  crearFragmentador,
  MUESTRAS_POR_FRAGMENTO,
} from '../src/utils/voz.ts'

describe('comandoValido (mismos rangos que comandos.py)', () => {
  const buenos: ComandoModulo[] = [
    { command: 'led_set', params: { index: 0, on: true } },
    { command: 'led_set', params: { index: 5, on: false } },
    { command: 'led_all', params: { on: true } },
    { command: 'led_sequence', params: { name: 'chase', step_s: 2 } },
    { command: 'led_sequence', params: { name: 'blink_all', step_s: 3600 } },
    { command: 'led_stop', params: {} },
    { command: 'audio_play', params: { sound: 'tono_suave' } },
    { command: 'audio_stop', params: {} },
    { command: 'motion_set', params: { enabled: false } },
  ]
  it('acepta los comandos del contrato', () => {
    for (const c of buenos) expect(comandoValido(c), JSON.stringify(c)).toBe(true)
  })

  it('rechaza índices, intervalos, nombres y sonidos fuera de contrato', () => {
    const malos = [
      { command: 'led_set', params: { index: 6, on: true } },
      { command: 'led_set', params: { index: -1, on: true } },
      { command: 'led_set', params: { index: 1.5, on: true } },
      { command: 'led_set', params: { index: 1, on: 'si' } },
      { command: 'led_all', params: {} },
      { command: 'led_sequence', params: { name: 'chase', step_s: 1.99 } },
      { command: 'led_sequence', params: { name: 'chase', step_s: 3601 } },
      { command: 'led_sequence', params: { name: 'chase', step_s: Number.NaN } },
      { command: 'led_sequence', params: { name: 'otra', step_s: 5 } },
      { command: 'led_stop', params: { on: true } },
      { command: 'audio_play', params: { sound: 'cancion_cuna' } },
      { command: 'motion_set', params: { enabled: 1 } },
      { command: 'inventado', params: {} },
    ]
    for (const c of malos) expect(comandoValido(c as unknown as ComandoModulo), JSON.stringify(c)).toBe(false)
  })
})

describe('parsearIntervalo', () => {
  it('acepta de 2 a 3600 s con punto o coma', () => {
    expect(parsearIntervalo('2')).toBe(2)
    expect(parsearIntervalo(' 2,5 ')).toBe(2.5)
    expect(parsearIntervalo('3600')).toBe(3600)
  })
  it('rechaza lo demás', () => {
    for (const t of ['', '1', '1.99', '3601', '-2', 'abc', '2e1', '1 0']) {
      expect(parsearIntervalo(t), t).toBeNull()
    }
  })
})

describe('estadoVisibleOrden', () => {
  const base: OrdenModulo = {
    command_id: 'c',
    device_id: 'd',
    command: 'led_all',
    params: {},
    creado_en: '2026-11-18T10:00:00Z',
    vence_en: '2026-11-18T10:00:15Z',
    estado: 'pendiente',
    entregado_en: null,
    confirmado_en: null,
    error: null,
  }
  const antes = new Date('2026-11-18T10:00:05Z')
  const despues = new Date('2026-11-18T10:00:16Z')

  it('refleja el ciclo y marca sin respuesta al vencer', () => {
    expect(estadoVisibleOrden(base, antes)).toBe('pendiente')
    expect(estadoVisibleOrden({ ...base, estado: 'enviado' }, antes)).toBe('enviada')
    expect(estadoVisibleOrden(base, despues)).toBe('sin-respuesta')
    expect(estadoVisibleOrden({ ...base, estado: 'enviado' }, despues)).toBe('sin-respuesta')
    expect(estadoVisibleOrden({ ...base, estado: 'confirmado' }, despues)).toBe('confirmado')
    expect(estadoVisibleOrden({ ...base, estado: 'error' }, despues)).toBe('error')
    expect(estadoVisibleOrden({ ...base, vence_en: 'x' }, antes)).toBe('sin-respuesta')
  })
})

describe('validarLimites', () => {
  const buenos = { temp_min: '20', temp_max: '26', hum_min: '40', hum_max: '60' }
  it('acepta límites válidos con coma o punto', () => {
    expect(validarLimites({ ...buenos, temp_max: '26,5' })).toEqual({
      ok: true,
      limites: { temp_min: 20, temp_max: 26.5, hum_min: 40, hum_max: 60 },
    })
  })
  it('rechaza vacíos, no numéricos, fuera de rango y mínimo mayor o igual que máximo', () => {
    const casos: Array<[Partial<typeof buenos>, RegExp]> = [
      [{ temp_min: '' }, /número/],
      [{ hum_max: 'mucho' }, /número/],
      [{ temp_min: '-41' }, /-40 a 85/],
      [{ temp_max: '86' }, /-40 a 85/],
      [{ hum_min: '-1' }, /0 a 100/],
      [{ hum_max: '101' }, /0 a 100/],
      [{ temp_min: '26' }, /mínimo debe ser menor/],
      [{ hum_min: '70' }, /mínimo debe ser menor/],
    ]
    for (const [cambio, mensaje] of casos) {
      const r = validarLimites({ ...buenos, ...cambio })
      expect(r.ok, JSON.stringify(cambio)).toBe(false)
      if (!r.ok) expect(r.error).toMatch(mensaje)
    }
  })
})

describe('horaValida', () => {
  it('solo HH:MM de 24 h', () => {
    for (const h of ['00:00', '08:05', '23:59']) expect(horaValida(h)).toBe(true)
    for (const h of ['24:00', '8:00', '12:60', '12:00:00', '', 'mediodía']) expect(horaValida(h)).toBe(false)
  })
})

describe('conversión de voz', () => {
  it('lleva 48 kHz a 8 kHz con el tamaño y el rango correctos', () => {
    const entrada = new Float32Array(480).fill(0.5)
    const salida = aPcm8k(entrada, 48000)
    expect(salida.length).toBe(80)
    expect(Array.from(new Set(salida))).toEqual([Math.round(0.5 * 0x7fff)])
    expect(aPcm8k(new Float32Array(48).fill(-1), 48000)[0]).toBe(-0x8000)
    expect(aPcm8k(new Float32Array(48).fill(3), 48000)[0]).toBe(0x7fff)
  })

  it('no acepta tasas menores a 8 kHz', () => {
    expect(() => aPcm8k(new Float32Array(10), 4000)).toThrow()
    expect(() => aPcm8k(new Float32Array(10), Number.NaN)).toThrow()
  })

  it('el fragmentador entrega bloques fijos y conserva el resto', () => {
    const recibidos: number[] = []
    const f = crearFragmentador((pcm) => recibidos.push(pcm.length))
    f.agregar(new Int16Array(100))
    expect(recibidos).toEqual([])
    f.agregar(new Int16Array(MUESTRAS_POR_FRAGMENTO + 20))
    expect(recibidos).toEqual([MUESTRAS_POR_FRAGMENTO])
    f.agregar(new Int16Array(MUESTRAS_POR_FRAGMENTO * 2))
    expect(recibidos).toEqual([MUESTRAS_POR_FRAGMENTO, MUESTRAS_POR_FRAGMENTO, MUESTRAS_POR_FRAGMENTO])
    f.vaciar()
    f.agregar(new Int16Array(10))
    expect(recibidos.length).toBe(3)
  })

  it('los fragmentos cumplen el contrato de la Pico (320 a 1600 bytes)', () => {
    const bytes = MUESTRAS_POR_FRAGMENTO * 2
    expect(bytes).toBeGreaterThanOrEqual(320)
    expect(bytes).toBeLessThanOrEqual(1600)
  })

  it('aBase64 usa little endian', () => {
    const texto = atob(aBase64(new Int16Array([1, -2, 0x0102])))
    expect(Array.from(texto, (c) => c.charCodeAt(0))).toEqual([1, 0, 0xfe, 0xff, 0x02, 0x01])
  })
})
