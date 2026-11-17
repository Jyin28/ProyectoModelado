import { describe, expect, it } from 'vitest'
import type { OrdenComando } from '../src/models/contrato.ts'
import { validarComando } from '../src/models/validarComando.ts'

// Permite construir órdenes mal formadas a propósito.
const mala = (valor: unknown) => valor as OrdenComando

describe('validarComando: valores válidos', () => {
  it.each<[string, OrdenComando]>([
    ['lamp_set 40', { command: 'lamp_set', params: { level: 40 } }],
    ['led_set 3 on', { command: 'led_set', params: { index: 3, on: true } }],
    ['led_set 3 off', { command: 'led_set', params: { index: 3, on: false } }],
    ['led_all on', { command: 'led_all', params: { on: true } }],
    [
      'led_sequence chase 5',
      { command: 'led_sequence', params: { name: 'chase', step_s: 5 } },
    ],
    ['led_stop', { command: 'led_stop', params: {} }],
    ['get_status', { command: 'get_status', params: {} }],
  ])('%s', (_nombre, orden) => {
    expect(validarComando(orden)).toEqual({ ok: true })
  })
})

describe('validarComando: límites', () => {
  it.each<[string, OrdenComando]>([
    ['level 0', { command: 'lamp_set', params: { level: 0 } }],
    ['level 100', { command: 'lamp_set', params: { level: 100 } }],
    ['index 0', { command: 'led_set', params: { index: 0, on: true } }],
    ['index 5', { command: 'led_set', params: { index: 5, on: true } }],
    [
      'step_s 2',
      { command: 'led_sequence', params: { name: 'chase', step_s: 2 } },
    ],
  ])('%s es válido', (_nombre, orden) => {
    expect(validarComando(orden)).toEqual({ ok: true })
  })
})

describe('validarComando: valores inválidos', () => {
  it.each<[string, unknown]>([
    ['level 101', { command: 'lamp_set', params: { level: 101 } }],
    ['level -1', { command: 'lamp_set', params: { level: -1 } }],
    ['index 2.5', { command: 'led_set', params: { index: 2.5, on: true } }],
    ['index 6', { command: 'led_set', params: { index: 6, on: true } }],
    ['index -1', { command: 'led_set', params: { index: -1, on: true } }],
    [
      'step_s 1.9',
      { command: 'led_sequence', params: { name: 'chase', step_s: 1.9 } },
    ],
    [
      'name vacío',
      { command: 'led_sequence', params: { name: '', step_s: 2 } },
    ],
    ['level como texto', { command: 'lamp_set', params: { level: '40' } }],
    ['level booleano', { command: 'lamp_set', params: { level: true } }],
    ['level NaN', { command: 'lamp_set', params: { level: Number.NaN } }],
    ['index NaN', { command: 'led_set', params: { index: Number.NaN, on: true } }],
    ['on como texto', { command: 'led_set', params: { index: 1, on: 'si' } }],
    ['led_all sin on', { command: 'led_all', params: {} }],
    [
      'step_s como texto',
      { command: 'led_sequence', params: { name: 'chase', step_s: '2' } },
    ],
    ['params ausentes', { command: 'lamp_set' }],
    ['comando desconocido', { command: 'buzzer_set', params: {} }],
  ])('%s', (_nombre, orden) => {
    const resultado = validarComando(mala(orden))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(typeof resultado.error).toBe('string')
      expect(resultado.error.length).toBeGreaterThan(0)
    }
  })
})
