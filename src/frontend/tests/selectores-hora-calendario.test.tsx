import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import FormularioIntervaloHistorial, {
  type ConsultaElegida,
} from '../src/components/FormularioIntervaloHistorial.tsx'
import SelectorHora from '../src/components/SelectorHora.tsx'
import type { Bebe } from '../src/models/cuentas.ts'
import {
  celdasDelMes,
  describirDuracion,
  mesDeFecha,
  nombreMes,
  sumarMeses,
} from '../src/utils/calendario.ts'
import { ajustarAlPaso, posicionDeValor, valorDePosicion } from '../src/utils/perilla.ts'
import { crAUtc } from '../src/utils/tiempo.ts'

describe('SelectorHora', () => {
  function Prueba({ inicial = '' }: { inicial?: string }) {
    const [valor, setValor] = useState(inicial)
    return <SelectorHora etiqueta="Nueva hora" valor={valor} alCambiar={setValor} />
  }

  const opcion = (rueda: 'Hora' | 'Minutos', texto: string) =>
    screen.getByRole('option', { name: `${rueda} ${texto}` })

  it('sin hora elegida lo dice y no inventa una', () => {
    render(<Prueba />)
    expect(screen.getByText('Hora elegida: sin elegir')).toBeInTheDocument()
    expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument()
  })

  it('hora y minutos son dos ruedas lado a lado, como en la alarma del iPhone', () => {
    render(<Prueba inicial="07:30" />)
    const grupo = screen.getByRole('group', { name: 'Nueva hora' })
    const ruedas = within(grupo).getAllByRole('listbox')
    expect(ruedas.map((r) => r.getAttribute('aria-label'))).toEqual(['Hora', 'Minutos'])
    // Mismo contenedor y orden horizontal: la hora a la izquierda y los minutos a la derecha.
    expect(ruedas[0].parentElement).toBe(ruedas[1].parentElement)
    expect(ruedas[0].compareDocumentPosition(ruedas[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('se elige tocando una fila de cada rueda, con la hora elegida a la vista', async () => {
    render(<Prueba />)
    await userEvent.click(opcion('Hora', '06'))
    expect(screen.getByText('Hora elegida: 06:00')).toBeInTheDocument()
    await userEvent.click(opcion('Minutos', '37'))
    expect(screen.getByText('Hora elegida: 06:37')).toBeInTheDocument()
    expect(opcion('Hora', '06')).toHaveAttribute('aria-selected', 'true')
    expect(opcion('Minutos', '37')).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(opcion('Hora', '21'))
    expect(screen.getByText('Hora elegida: 21:37')).toBeInTheDocument()
  })

  it('el teclado mueve la rueda enfocada: flechas, Re Pág/Av Pág, Inicio y Fin', async () => {
    render(<Prueba inicial="23:45" />)
    const horas = screen.getByRole('listbox', { name: 'Hora' })
    const minutos = screen.getByRole('listbox', { name: 'Minutos' })
    horas.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByText('Hora elegida: 22:45')).toBeInTheDocument()
    await userEvent.keyboard('{End}')
    expect(screen.getByText('Hora elegida: 23:45')).toBeInTheDocument()
    await userEvent.keyboard('{Home}')
    expect(screen.getByText('Hora elegida: 00:45')).toBeInTheDocument()
    minutos.focus()
    await userEvent.keyboard('{PageDown}')
    expect(screen.getByText('Hora elegida: 00:55')).toBeInTheDocument()
    await userEvent.keyboard('{End}{ArrowDown}')
    expect(screen.getByText('Hora elegida: 00:59')).toBeInTheDocument()
  })

  it('ofrece las 24 horas y los 60 minutos', () => {
    render(<Prueba />)
    expect(within(screen.getByRole('listbox', { name: 'Hora' })).getAllByRole('option')).toHaveLength(24)
    expect(within(screen.getByRole('listbox', { name: 'Minutos' })).getAllByRole('option')).toHaveLength(60)
  })

  it('al detenerse el desplazamiento elige la fila que quedó en el centro', () => {
    vi.useFakeTimers()
    try {
      render(<Prueba inicial="08:00" />)
      const horas = screen.getByRole('listbox', { name: 'Hora' })
      horas.scrollTop = 38 * 15 // 15 filas de 38 px
      fireEvent.scroll(horas)
      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(screen.getByText('Hora elegida: 15:00')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

const BEBES: Bebe[] = [
  { id: 'b-1', nombre: 'Luna', fecha_nacimiento: null },
]

describe('FormularioIntervaloHistorial: calendario', () => {
  // 2026-11-19 12:00 en Costa Rica (UTC-6) = 18:00 UTC.
  const AHORA = Date.UTC(2026, 10, 19, 18, 0)
  const montar = () => {
    const alConsultar = vi.fn<(c: ConsultaElegida) => void>()
    render(<FormularioIntervaloHistorial bebes={BEBES} ocupado={false} alConsultar={alConsultar} ahora={() => AHORA} />)
    return alConsultar
  }

  it('muestra el mes y el año en español y navega entre meses', async () => {
    montar()
    expect(screen.getByText('Noviembre de 2026')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByText('Diciembre de 2026')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByText('Enero de 2027')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(screen.getByText('Octubre de 2026')).toBeInTheDocument()
  })

  it('por defecto es la última noche: cruza la medianoche y el resumen la muestra en hora de Costa Rica', async () => {
    const alConsultar = montar()
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('2026-11-18')
    expect(screen.getByLabelText('Fecha de fin')).toHaveValue('2026-11-19')
    expect(screen.getByRole('status')).toHaveTextContent(/18 nov.*19:00.*19 nov.*07:00.*hora de Costa Rica.*12 h/)
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(alConsultar).toHaveBeenCalledWith({
      bebeId: 'b-1',
      intervalo: { desde: crAUtc('2026-11-18', '19:00'), hasta: crAUtc('2026-11-19', '07:00') },
    })
    // 19:00 CR es 01:00 UTC del día siguiente: la conversión UTC se conserva.
    expect(new Date(alConsultar.mock.calls[0][0].intervalo.desde).toISOString()).toBe('2026-11-19T01:00:00.000Z')
    expect(new Date(alConsultar.mock.calls[0][0].intervalo.hasta).toISOString()).toBe('2026-11-19T13:00:00.000Z')
  })

  it('elige inicio y fin en el calendario y los marca', async () => {
    const alConsultar = montar()
    await userEvent.click(screen.getByRole('button', { name: 'Elegir inicio' }))
    await userEvent.click(screen.getByRole('button', { name: '10 de noviembre de 2026' }))
    // Tras elegir el inicio, el siguiente toque elige el fin.
    expect(screen.getByRole('button', { name: 'Elegir fin', pressed: true })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '12 de noviembre de 2026' }))
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('2026-11-10')
    expect(screen.getByLabelText('Fecha de fin')).toHaveValue('2026-11-12')
    expect(screen.getByRole('button', { name: '10 de noviembre de 2026, inicio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '12 de noviembre de 2026, fin' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(/10 nov.*19:00.*12 nov.*07:00.*36 h/)
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(alConsultar).toHaveBeenCalledWith({
      bebeId: 'b-1',
      intervalo: { desde: crAUtc('2026-11-10', '19:00'), hasta: crAUtc('2026-11-12', '07:00') },
    })
  })

  it('valida el orden: un fin anterior al inicio no consulta y lo explica', async () => {
    const alConsultar = montar()
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-11-17' } })
    expect(screen.getByRole('status')).toHaveTextContent('El fin debe ser posterior al inicio.')
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El fin debe ser posterior al inicio.')
    expect(alConsultar).not.toHaveBeenCalled()
  })

  it('un intervalo que cruza medianoche con fin explícito conserva las horas elegidas', async () => {
    const alConsultar = montar()
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-11-15' } })
    fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '23:30' } })
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-11-16' } })
    fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '00:30' } })
    expect(screen.getByRole('status')).toHaveTextContent(/1 h/)
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    const { desde, hasta } = alConsultar.mock.calls[0][0].intervalo
    expect(new Date(desde).toISOString()).toBe('2026-11-16T05:30:00.000Z')
    expect(new Date(hasta).toISOString()).toBe('2026-11-16T06:30:00.000Z')
    expect(hasta - desde).toBe(3600 * 1000)
  })

  it('«Última noche» devuelve el fin automático', async () => {
    montar()
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-11-25' } })
    await userEvent.click(screen.getByRole('button', { name: /Última noche/ }))
    expect(screen.getByLabelText('Fecha de fin')).toHaveValue('2026-11-19')
  })
})

describe('utilidades del calendario y la perilla', () => {
  it('nombreMes está en español y mayúscula inicial', () => {
    expect(nombreMes({ anio: 2026, mes: 10 })).toBe('Noviembre de 2026')
    expect(nombreMes({ anio: 2027, mes: 0 })).toBe('Enero de 2027')
  })

  it('sumarMeses cruza el cambio de año en ambos sentidos', () => {
    expect(sumarMeses({ anio: 2026, mes: 11 }, 1)).toEqual({ anio: 2027, mes: 0 })
    expect(sumarMeses({ anio: 2026, mes: 0 }, -1)).toEqual({ anio: 2025, mes: 11 })
    expect(sumarMeses({ anio: 2026, mes: 5 }, -18)).toEqual({ anio: 2024, mes: 11 })
  })

  it('celdasDelMes alinea el primer día con la semana que empieza en lunes', () => {
    // 1 nov 2026 es domingo: seis huecos antes.
    const celdas = celdasDelMes({ anio: 2026, mes: 10 })
    expect(celdas.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(celdas[6]).toBe('2026-11-01')
    expect(celdas.filter(Boolean)).toHaveLength(30)
    // Febrero de 2028 (bisiesto) empieza el martes y tiene 29 días.
    const feb = celdasDelMes({ anio: 2028, mes: 1 })
    expect(feb.filter((c) => c === null)).toHaveLength(1)
    expect(feb.filter(Boolean)).toHaveLength(29)
  })

  it('mesDeFecha rechaza fechas mal formadas', () => {
    expect(mesDeFecha('2026-11-19')).toEqual({ anio: 2026, mes: 10 })
    expect(mesDeFecha('2026-13-01')).toBeNull()
    expect(mesDeFecha('')).toBeNull()
  })

  it('describirDuracion', () => {
    expect(describirDuracion(12 * 3600_000)).toBe('12 h')
    expect(describirDuracion(90 * 60_000)).toBe('1 h 30 min')
    expect(describirDuracion(25 * 60_000)).toBe('25 min')
  })

  it('la perilla recorre el mínimo y el máximo y ajusta al paso', () => {
    expect(valorDePosicion(0, 2, 3600, 1)).toBe(2)
    expect(valorDePosicion(1, 2, 3600, 1)).toBe(3600)
    expect(valorDePosicion(-5, 2, 3600, 1)).toBe(2)
    expect(valorDePosicion(7, 2, 3600, 1)).toBe(3600)
    expect(posicionDeValor(2, 2, 3600)).toBe(0)
    expect(posicionDeValor(3600, 2, 3600)).toBeCloseTo(1, 10)
    const medio = valorDePosicion(posicionDeValor(60, 2, 3600), 2, 3600, 1)
    expect(medio).toBe(60)
    expect(ajustarAlPaso(5.4, 2, 3600, 1)).toBe(5)
    expect(ajustarAlPaso(1, 2, 3600, 1)).toBe(2)
    expect(ajustarAlPaso(9999, 2, 3600, 1)).toBe(3600)
  })
})
