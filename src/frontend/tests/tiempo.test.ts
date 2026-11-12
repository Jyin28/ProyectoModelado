import { describe, expect, it } from 'vitest'
import {
  antiguedadSegundos,
  describirAntiguedad,
  estaDesactualizado,
  formatearHoraCR,
} from '../src/utils/tiempo.ts'

describe('formatearHoraCR', () => {
  it('convierte UTC a UTC-6 el mismo día', () => {
    const texto = formatearHoraCR('2026-11-12T18:30:00Z')
    expect(texto).toContain('12')
    expect(texto).toContain('noviembre')
    expect(texto).toContain('12:30')
  })

  it('cambia de día al restar 6 horas', () => {
    const texto = formatearHoraCR('2026-11-12T03:00:00Z')
    expect(texto).toContain('11')
    expect(texto).toContain('noviembre')
    expect(texto).toContain('2026')
    expect(texto).toContain('21:00')
    expect(texto).not.toContain('12 de')
  })

  it('devuelve "Fecha inválida" sin lanzar error', () => {
    expect(formatearHoraCR('no es fecha')).toBe('Fecha inválida')
    expect(formatearHoraCR('')).toBe('Fecha inválida')
  })
})

describe('antiguedadSegundos', () => {
  const ahora = new Date('2026-11-12T12:00:30Z')

  it('calcula la diferencia en segundos', () => {
    expect(antiguedadSegundos('2026-11-12T12:00:00Z', ahora)).toBe(30)
  })

  it('no devuelve valores negativos', () => {
    expect(antiguedadSegundos('2026-11-12T12:05:00Z', ahora)).toBe(0)
  })

  it('devuelve NaN con fecha inválida', () => {
    expect(antiguedadSegundos('xx', ahora)).toBeNaN()
  })
})

describe('describirAntiguedad', () => {
  it.each([
    [0, 'hace 0 s'],
    [59, 'hace 59 s'],
    [60, 'hace 1 min'],
    [3599, 'hace 59 min'],
    [3600, 'hace 1 h'],
    [86399, 'hace 23 h'],
    [86400, 'hace 1 día'],
    [172800, 'hace 2 días'],
  ])('%i s → "%s"', (segundos, esperado) => {
    expect(describirAntiguedad(segundos)).toBe(esperado)
  })

  it('maneja valores no válidos', () => {
    expect(describirAntiguedad(Number.NaN)).toBe('Fecha inválida')
  })
})

describe('estaDesactualizado', () => {
  const ahora = new Date('2026-11-12T12:00:40Z')

  it('null cuenta como desactualizado', () => {
    expect(estaDesactualizado(null, ahora, 30)).toBe(true)
  })

  it('por debajo del umbral no está desactualizado', () => {
    expect(estaDesactualizado('2026-11-12T12:00:20Z', ahora, 30)).toBe(false)
  })

  it('justo en el umbral no está desactualizado', () => {
    expect(estaDesactualizado('2026-11-12T12:00:10Z', ahora, 30)).toBe(false)
  })

  it('por encima del umbral está desactualizado', () => {
    expect(estaDesactualizado('2026-11-12T12:00:09Z', ahora, 30)).toBe(true)
  })

  it('fecha inválida cuenta como desactualizado', () => {
    expect(estaDesactualizado('xx', ahora, 30)).toBe(true)
  })

  it('compara el borde en milisegundos exactos', () => {
    const lectura = '2026-11-12T12:00:00.000Z'
    const exacto = new Date('2026-11-12T12:00:30.000Z')
    const pasado = new Date('2026-11-12T12:00:30.001Z')
    expect(estaDesactualizado(lectura, exacto, 30)).toBe(false)
    expect(estaDesactualizado(lectura, pasado, 30)).toBe(true)
  })
})
