import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { LecturaAmbiental } from '../src/models/contrato.ts'
import { DISPOSITIVO_AMBIENTE_POR_DEFECTO } from '../src/services/configuracion.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, Servicios, Sesion } from '../src/services/tipos.ts'

const SESION: Sesion = { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' }
const OTRA: Sesion = { usuario_id: 'u-2', correo: 'otra@ejemplo.test' }
const AHORA = new Date('2026-11-11T16:04:15Z')

function lectura(extra: Partial<LecturaAmbiental> = {}): LecturaAmbiental {
  return {
    id: 'evento-1',
    dispositivo_id: DISPOSITIVO_AMBIENTE_POR_DEFECTO,
    temperatura_c: 24.3,
    humedad_pct: 52,
    registrado_en: '2026-11-11T16:04:10Z', // 10:04:10 en Costa Rica
    ...extra,
  }
}

type Consulta = Resultado<LecturaAmbiental | null>

function montar(respuestas: Array<() => Promise<Consulta>>) {
  const oyentes = new Set<(s: Sesion | null) => void>()
  let n = 0
  const obtenerUltimaAmbiental = vi.fn(() => {
    const r = respuestas[Math.min(n, respuestas.length - 1)]
    n += 1
    return r()
  })
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    lecturas: { ...serviciosNoConfigurados.lecturas, obtenerUltimaAmbiental },
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
  const vista = render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/cuna']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
  return {
    obtenerUltimaAmbiental,
    desmontar: vista.unmount,
    emitir: (s: Sesion | null) => act(() => oyentes.forEach((o) => o(s))),
  }
}

// Con temporizadores falsos no sirven findBy*/waitFor: se vacían las promesas.
const avanzar = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const ok = (datos: LecturaAmbiental | null) => () =>
  Promise.resolve<Consulta>({ ok: true, datos })
const falla = () =>
  Promise.resolve<Consulta>({ ok: false, error: 'No se pudo consultar la última lectura.' })

const tarjeta = (nombre: string) => screen.getByRole('article', { name: nombre })
const hayBannerConexion = () =>
  screen
    .queryAllByRole('status')
    .some((el) => el.hasAttribute('data-estado'))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Cuna: última lectura', () => {
  it('muestra carga hasta que responde la primera consulta', async () => {
    montar([() => new Promise(() => {})])
    await avanzar()
    expect(screen.getByText('Cargando la última lectura…')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('consulta vacía: Sin datos en ambas tarjetas y sin aviso de conexión', async () => {
    const { obtenerUltimaAmbiental } = montar([ok(null)])
    await avanzar()
    expect(obtenerUltimaAmbiental).toHaveBeenCalledWith(DISPOSITIVO_AMBIENTE_POR_DEFECTO)
    for (const nombre of ['Temperatura', 'Humedad']) {
      expect(tarjeta(nombre)).toHaveAttribute('data-estado', 'sin-datos')
    }
    expect(screen.getByText('Todavía no hay datos recibidos del dispositivo.')).toBeInTheDocument()
    expect(hayBannerConexion()).toBe(false)
    expect(screen.queryByText('Integración pendiente.')).not.toBeInTheDocument()
  })

  it('consulta con valores: Actual, hora de Costa Rica y cero válido', async () => {
    montar([ok(lectura({ humedad_pct: 0 }))])
    await avanzar()
    const temperatura = tarjeta('Temperatura')
    expect(temperatura).toHaveAttribute('data-estado', 'actual')
    expect(temperatura).toHaveTextContent('24,3')
    expect(temperatura).toHaveTextContent('10:04:10')
    const humedad = tarjeta('Humedad')
    expect(humedad).toHaveAttribute('data-estado', 'actual')
    expect(humedad).toHaveTextContent('0')
    expect(humedad).not.toHaveTextContent('Sin datos')
    expect(screen.queryByText('Todavía no hay datos recibidos del dispositivo.')).not.toBeInTheDocument()
  })

  it('pasa a Desactualizado cuando ts supera 30 s', async () => {
    montar([ok(lectura())])
    await avanzar()
    await avanzar(30_000) // 40 s de antigüedad; las consultas repiten el mismo dato
    expect(tarjeta('Temperatura')).toHaveAttribute('data-estado', 'desactualizado')
    expect(tarjeta('Temperatura')).toHaveTextContent('24,3')
  })

  it('un fallo posterior conserva la última lectura y muestra el aviso de conexión', async () => {
    montar([ok(lectura()), falla])
    await avanzar()
    expect(hayBannerConexion()).toBe(false)
    await avanzar(10_000)
    expect(screen.getByText(/Sin conexión con el servidor/)).toBeInTheDocument()
    expect(tarjeta('Temperatura')).toHaveTextContent('24,3')
    expect(tarjeta('Temperatura')).toHaveAttribute('data-estado', 'actual')
  })

  it('un fallo en la primera consulta muestra el aviso y Sin datos', async () => {
    montar([falla])
    await avanzar()
    expect(screen.getByText(/Sin conexión con el servidor/)).toBeInTheDocument()
    expect(tarjeta('Temperatura')).toHaveAttribute('data-estado', 'sin-datos')
  })

  it('tras un fallo, una consulta exitosa quita el aviso', async () => {
    montar([falla, ok(lectura())])
    await avanzar()
    await avanzar(10_000)
    expect(screen.queryByText(/Sin conexión con el servidor/)).not.toBeInTheDocument()
    expect(tarjeta('Temperatura')).toHaveTextContent('24,3')
  })

  it('una consulta vacía posterior descarta el dato visible', async () => {
    montar([ok(lectura()), ok(null)])
    await avanzar()
    expect(tarjeta('Temperatura')).toHaveTextContent('24,3')
    await avanzar(10_000)
    expect(tarjeta('Temperatura')).toHaveAttribute('data-estado', 'sin-datos')
    expect(tarjeta('Temperatura')).not.toHaveTextContent('24,3')
  })
})

describe('Cuna: polling', () => {
  it('consulta al montar y cada 10 s', async () => {
    const { obtenerUltimaAmbiental } = montar([ok(lectura())])
    await avanzar()
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(1)
    await avanzar(9_000)
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(1)
    await avanzar(1_000)
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(2)
    await avanzar(10_000)
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(3)
  })

  it('no superpone consultas mientras una sigue pendiente', async () => {
    const { obtenerUltimaAmbiental } = montar([() => new Promise(() => {})])
    await avanzar(35_000)
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(1)
  })
})

describe('Cuna: cierre de sesión y desmontaje', () => {
  it('al desmontar deja de consultar e ignora la respuesta tardía', async () => {
    let resolver!: (r: Consulta) => void
    const { obtenerUltimaAmbiental, desmontar } = montar([
      () => new Promise<Consulta>((r) => (resolver = r)),
    ])
    await avanzar()
    desmontar()
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => resolver({ ok: true, datos: lectura() }))
    await avanzar(30_000)
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(1)
    expect(errores).not.toHaveBeenCalled()
    errores.mockRestore()
  })

  it('al cerrar sesión deja de consultar y no queda ninguna lectura visible', async () => {
    const { obtenerUltimaAmbiental, emitir } = montar([ok(lectura())])
    await avanzar()
    expect(tarjeta('Temperatura')).toHaveTextContent('24,3')
    emitir(null)
    await avanzar()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByText('24,3', { exact: false })).not.toBeInTheDocument()
    await avanzar(30_000)
    expect(obtenerUltimaAmbiental).toHaveBeenCalledTimes(1)
  })

  it('con otra cuenta no se muestra la lectura anterior ni su respuesta tardía', async () => {
    let resolver!: (r: Consulta) => void
    const { emitir } = montar([
      ok(lectura()),
      () => new Promise<Consulta>((r) => (resolver = r)),
    ])
    await avanzar()
    expect(tarjeta('Temperatura')).toHaveTextContent('24,3')
    emitir(OTRA)
    await avanzar()
    // Consulta de la nueva cuenta pendiente: carga y nada del usuario anterior.
    expect(screen.getByText('Cargando la última lectura…')).toBeInTheDocument()
    expect(screen.queryByText('24,3', { exact: false })).not.toBeInTheDocument()
    await act(async () => resolver({ ok: true, datos: lectura({ temperatura_c: 19.5 }) }))
    expect(tarjeta('Temperatura')).toHaveTextContent('19,5')
  })
})
