import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TarjetaLectura from '../src/components/TarjetaLectura.tsx'

const REGISTRADO = '2026-11-12T03:00:00Z'

function tarjeta(
  valor: number | null,
  registradoEn: string | null,
  umbral = 30,
) {
  return (
    <TarjetaLectura
      etiqueta="Temperatura"
      valor={valor}
      unidad="°C"
      decimales={1}
      registradoEn={registradoEn}
      umbralDesactualizadoS={umbral}
    />
  )
}

describe('TarjetaLectura', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T03:00:10Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sin valor muestra "Sin datos"', () => {
    render(tarjeta(null, null))
    const art = screen.getByRole('article', { name: 'Temperatura' })
    expect(art).toHaveAttribute('data-estado', 'sin-datos')
    expect(art).toHaveTextContent('Sin datos')
    expect(art).not.toHaveTextContent('°C')
  })

  it('con valor pero sin fecha también es "Sin datos"', () => {
    render(tarjeta(25, null))
    expect(screen.getByRole('article')).toHaveAttribute(
      'data-estado',
      'sin-datos',
    )
  })

  it('con fecha pero sin valor también es "Sin datos"', () => {
    render(tarjeta(null, REGISTRADO))
    expect(screen.getByRole('article')).toHaveAttribute(
      'data-estado',
      'sin-datos',
    )
  })

  it('lectura reciente se muestra "Actual" con valor, hora CR y antigüedad', () => {
    render(tarjeta(25.5, REGISTRADO))
    const art = screen.getByRole('article')
    expect(art).toHaveAttribute('data-estado', 'actual')
    expect(art).toHaveTextContent('Actual')
    expect(art).toHaveTextContent('25,5')
    expect(art).toHaveTextContent('°C')
    expect(art).toHaveTextContent('21:00')
    expect(art).toHaveTextContent('hace 10 s')
    expect(art).not.toHaveTextContent('Desactualizado')
  })

  it('pasa a "Desactualizado" al superar el umbral, sin presentarse como nueva', () => {
    render(tarjeta(25.5, REGISTRADO))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    const art = screen.getByRole('article')
    expect(art).toHaveAttribute('data-estado', 'desactualizado')
    expect(art).toHaveTextContent('Desactualizado')
    expect(art).toHaveTextContent('Último valor')
    expect(art).toHaveTextContent('25,5')
    expect(art).toHaveTextContent('21:00')
    expect(art).toHaveTextContent('hace 40 s')
    expect(art).not.toHaveTextContent(/^Actual|● Actual/)
  })
})
