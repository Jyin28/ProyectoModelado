import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type {
  Resultado,
  ServicioAuth,
  Servicios,
  Sesion,
} from '../src/services/tipos.ts'

const SESION: Sesion = { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' }
const CLAVE = 'clave-de-prueba'

type Opciones = {
  inicial?: Promise<Resultado<Sesion | null>>
  alIniciar?: () => Promise<Resultado<Sesion>>
  alCerrar?: () => Promise<Resultado<null>>
}

function crearAuth(opciones: Opciones = {}) {
  const oyentes = new Set<(s: Sesion | null) => void>()
  const suscribir = vi.fn((alCambiar: (s: Sesion | null) => void) => {
    oyentes.add(alCambiar)
    return () => {
      oyentes.delete(alCambiar)
    }
  })
  const auth: ServicioAuth = {
    obtenerSesion: vi.fn(
      (): Promise<Resultado<Sesion | null>> =>
        opciones.inicial ?? Promise.resolve({ ok: true, datos: null }),
    ),
    iniciarSesion: vi.fn(
      opciones.alIniciar ??
        ((): Promise<Resultado<Sesion>> =>
          Promise.resolve({ ok: true, datos: SESION })),
    ),
    cerrarSesion: vi.fn(
      opciones.alCerrar ??
        ((): Promise<Resultado<null>> =>
          Promise.resolve({ ok: true, datos: null })),
    ),
    suscribirCambiosSesion: suscribir,
  }
  const servicios: Servicios = { ...serviciosNoConfigurados, auth }
  return {
    auth,
    servicios,
    suscribir,
    activos: () => oyentes.size,
    emitir: (s: Sesion | null) => act(() => oyentes.forEach((o) => o(s))),
  }
}

function Ruta() {
  return <p data-testid="ruta">{useLocation().pathname}</p>
}

function renderizar(
  ruta: string,
  servicios: Servicios,
  { estricto = false } = {},
) {
  const arbol = (
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
        <Ruta />
      </MemoryRouter>
    </ProveedorServicios>
  )
  return render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol)
}

const titulo = () => screen.findByRole('heading', { level: 1 })
const rutaActual = () => screen.getByTestId('ruta').textContent

async function iniciarSesionEnFormulario() {
  const usuario = userEvent.setup()
  await usuario.type(await screen.findByLabelText('Correo'), SESION.correo)
  await usuario.type(screen.getByLabelText('Contraseña'), CLAVE)
  await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

describe('protección de rutas', () => {
  it('mientras se verifica la sesión no muestra rutas privadas ni redirige', () => {
    const { servicios } = crearAuth({ inicial: new Promise(() => {}) })
    renderizar('/historial', servicios)
    expect(screen.getByText('Verificando sesión…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(rutaActual()).toBe('/historial')
  })

  it('sin sesión redirige a /login y tras iniciar vuelve a la ruta pedida', async () => {
    const { servicios, auth } = crearAuth()
    renderizar('/historial', servicios)
    expect(await titulo()).toHaveTextContent('Inicio de sesión')
    expect(rutaActual()).toBe('/login')

    await iniciarSesionEnFormulario()
    await waitFor(() => expect(rutaActual()).toBe('/historial'))
    expect(await titulo()).toHaveTextContent('Historial')
    expect(auth.iniciarSesion).toHaveBeenCalledWith(SESION.correo, CLAVE)
  })

  it('un inicio directo en /login lleva a /cuna', async () => {
    const { servicios } = crearAuth()
    renderizar('/login', servicios)
    await iniciarSesionEnFormulario()
    await waitFor(() => expect(rutaActual()).toBe('/cuna'))
  })

  it('con sesión restaurada, /login lleva a Cuna', async () => {
    const { servicios } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
    })
    renderizar('/login', servicios)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cuna' }),
    ).toBeInTheDocument()
    expect(rutaActual()).toBe('/cuna')
  })

  it('con sesión restaurada conserva la ruta interna pedida', async () => {
    const { servicios } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
    })
    renderizar('/colchon', servicios)
    expect(await titulo()).toHaveTextContent('Colchón')
    expect(screen.getByText(SESION.correo)).toBeInTheDocument()
  })

  it('si falla la verificación pide login con un mensaje genérico', async () => {
    const { servicios } = crearAuth({
      inicial: Promise.resolve({ ok: false, error: 'No se pudo verificar la sesión.' }),
    })
    renderizar('/cuna', servicios)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo verificar la sesión.',
    )
    expect(rutaActual()).toBe('/login')
  })
})

describe('inicio de sesión', () => {
  it('muestra el error y deja los campos listos para reintentar', async () => {
    const { servicios } = crearAuth({
      alIniciar: () =>
        Promise.resolve({ ok: false, error: 'Correo o contraseña incorrectos.' }),
    })
    renderizar('/login', servicios)
    await iniciarSesionEnFormulario()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Correo o contraseña incorrectos.',
    )
    expect(rutaActual()).toBe('/login')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })

  it('ignora destinos externos guardados en el estado de navegación', async () => {
    const { servicios } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
    })
    render(
      <ProveedorServicios configurado servicios={servicios}>
        <MemoryRouter
          initialEntries={[{ pathname: '/login', state: { desde: '//externo.test' } }]}
        >
          <App />
          <Ruta />
        </MemoryRouter>
      </ProveedorServicios>,
    )
    await waitFor(() => expect(rutaActual()).toBe('/cuna'))
  })
})

describe('cierre de sesión', () => {
  it('cierra, vuelve a /login y no deja contenido privado', async () => {
    const { servicios, auth } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
    })
    renderizar('/cuna', servicios)
    await titulo()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(rutaActual()).toBe('/login'))
    expect(auth.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(SESION.correo)).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('si el cierre falla muestra un mensaje genérico y mantiene la sesión', async () => {
    const { servicios } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
      alCerrar: () =>
        Promise.resolve({ ok: false, error: 'No se pudo cerrar la sesión. Intenta de nuevo.' }),
    })
    renderizar('/cuna', servicios)
    await titulo()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión.',
    )
    expect(rutaActual()).toBe('/cuna')
  })

  it('un cierre de sesión notificado por Auth también protege las rutas', async () => {
    const { servicios, emitir } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
    })
    renderizar('/cuna', servicios)
    await titulo()
    emitir(null)
    await waitFor(() => expect(rutaActual()).toBe('/login'))
  })
})

describe('suscripción y carreras', () => {
  it('un cambio de Auth durante la consulta inicial prevalece sobre su respuesta tardía', async () => {
    let resolver!: (r: Resultado<Sesion | null>) => void
    const inicial = new Promise<Resultado<Sesion | null>>((r) => (resolver = r))
    const { servicios, emitir } = crearAuth({ inicial })
    renderizar('/cuna', servicios)
    emitir(SESION)
    expect(await titulo()).toHaveTextContent('Cuna')
    await act(async () => resolver({ ok: true, datos: null }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cuna')
    expect(rutaActual()).toBe('/cuna')
  })

  it('con StrictMode cada suscripción se cancela y queda una sola activa', async () => {
    const { servicios, suscribir, activos } = crearAuth({
      inicial: Promise.resolve({ ok: true, datos: SESION }),
    })
    const { unmount } = renderizar('/cuna', servicios, { estricto: true })
    expect(await titulo()).toHaveTextContent('Cuna')
    expect(suscribir).toHaveBeenCalledTimes(2)
    expect(activos()).toBe(1)
    unmount()
    expect(activos()).toBe(0)
  })

  it('la respuesta de una consulta cancelada no cambia el estado', async () => {
    let resolver!: (r: Resultado<Sesion | null>) => void
    const inicial = new Promise<Resultado<Sesion | null>>((r) => (resolver = r))
    const { servicios } = crearAuth({ inicial })
    const { unmount } = renderizar('/cuna', servicios)
    unmount()
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => resolver({ ok: true, datos: SESION }))
    expect(errores).not.toHaveBeenCalled()
    errores.mockRestore()
  })
})
