import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PanelMovimiento from '../src/components/PanelMovimiento.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import ProveedorSesion from '../src/components/ProveedorSesion.tsx'
import type { EventoMovimiento } from '../src/models/contrato.ts'
import {
  DISPOSITIVO_MOVIMIENTO_POR_DEFECTO,
  movimientoActivado,
  movimientoHabilitado,
} from '../src/services/configuracion.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, Servicios, Sesion } from '../src/services/tipos.ts'

const SESION: Sesion = { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' }
const OTRA: Sesion = { usuario_id: 'u-2', correo: 'otra@ejemplo.test' }

type Consulta = Resultado<EventoMovimiento | null>

const evento = (extra: Partial<EventoMovimiento> = {}): EventoMovimiento => ({
  id: 'mov-1',
  dispositivo_id: DISPOSITIVO_MOVIMIENTO_POR_DEFECTO,
  registrado_en: '2026-11-11T16:04:10Z', // 10:04:10 en Costa Rica
  ...extra,
})
const ok = (datos: EventoMovimiento | null) => () => Promise.resolve<Consulta>({ ok: true, datos })
const falla = () => Promise.resolve<Consulta>({ ok: false, error: 'x' })

function montar(respuestas: Array<() => Promise<Consulta>>, habilitado = true) {
  const oyentes = new Set<(s: Sesion | null) => void>()
  let n = 0
  const obtenerUltimoMovimiento = vi.fn(() => {
    const r = respuestas[Math.min(n, respuestas.length - 1)]
    n += 1
    return r()
  })
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    lecturas: { ...serviciosNoConfigurados.lecturas, obtenerUltimoMovimiento },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => Promise.resolve({ ok: true, datos: SESION }),
      suscribirCambiosSesion: (alCambiar) => {
        oyentes.add(alCambiar)
        return () => {
          oyentes.delete(alCambiar)
        }
      },
    },
  }
  render(
    <ProveedorServicios configurado servicios={servicios}>
      <ProveedorSesion>
        <PanelMovimiento
          dispositivoId={DISPOSITIVO_MOVIMIENTO_POR_DEFECTO}
          habilitado={habilitado}
        />
      </ProveedorSesion>
    </ProveedorServicios>,
  )
  return {
    obtenerUltimoMovimiento,
    emitir: (s: Sesion | null) => act(() => oyentes.forEach((o) => o(s))),
  }
}

const avanzar = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-11T16:04:15Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('configuración de movimiento', () => {
  it('es opt-in: solo "true" activa y por defecto está apagado', () => {
    expect(movimientoActivado(undefined)).toBe(false)
    expect(movimientoActivado('')).toBe(false)
    expect(movimientoActivado('1')).toBe(false)
    expect(movimientoActivado('false')).toBe(false)
    expect(movimientoActivado(' TRUE ')).toBe(true)
    expect(movimientoHabilitado).toBe(false)
  })
})

describe('PanelMovimiento', () => {
  it('deshabilitado no renderiza ni consulta', async () => {
    const { obtenerUltimoMovimiento } = montar([ok(evento())], false)
    await avanzar(30_000)
    expect(obtenerUltimoMovimiento).not.toHaveBeenCalled()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('tabla vacía muestra Sin datos', async () => {
    const { obtenerUltimoMovimiento } = montar([ok(null)])
    await avanzar()
    expect(obtenerUltimoMovimiento).toHaveBeenCalledWith(DISPOSITIVO_MOVIMIENTO_POR_DEFECTO)
    expect(screen.getByRole('region', { name: 'Último movimiento' })).toHaveTextContent('Sin datos')
  })

  it('con evento muestra la hora de Costa Rica', async () => {
    montar([ok(evento())])
    await avanzar()
    expect(screen.getByRole('region', { name: 'Último movimiento' })).toHaveTextContent('10:04:10')
  })

  it('consulta al montar y cada 10 s sin superponerse', async () => {
    const { obtenerUltimoMovimiento } = montar([() => new Promise(() => {})])
    await avanzar(35_000)
    expect(obtenerUltimoMovimiento).toHaveBeenCalledTimes(1)
    const otro = montar([ok(evento())])
    await avanzar()
    await avanzar(10_000)
    expect(otro.obtenerUltimoMovimiento).toHaveBeenCalledTimes(2)
  })

  it('un fallo conserva el último evento y avisa', async () => {
    montar([ok(evento()), falla])
    await avanzar()
    await avanzar(10_000)
    const panel = screen.getByRole('region', { name: 'Último movimiento' })
    expect(panel).toHaveTextContent('10:04:10')
    expect(panel).toHaveTextContent('No se pudo actualizar')
  })

  it('al cambiar de cuenta no muestra el evento anterior', async () => {
    let resolver!: (r: Consulta) => void
    const { emitir } = montar([ok(evento()), () => new Promise<Consulta>((r) => (resolver = r))])
    await avanzar()
    emitir(OTRA)
    await avanzar()
    expect(screen.queryByText(/10:04:10/)).not.toBeInTheDocument()
    expect(screen.getByText('Cargando el último movimiento…')).toBeInTheDocument()
    await act(async () => resolver({ ok: true, datos: null }))
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
  })

  it('sin sesión no consulta ni muestra nada', async () => {
    const { obtenerUltimoMovimiento, emitir } = montar([ok(evento())])
    await avanzar()
    emitir(null)
    await avanzar(30_000)
    expect(obtenerUltimoMovimiento).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
