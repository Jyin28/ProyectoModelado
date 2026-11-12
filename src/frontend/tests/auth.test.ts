import { describe, expect, it, vi } from 'vitest'
import {
  crearServicioAuth,
  MENSAJE_CIERRE,
  MENSAJE_CREDENCIALES,
  MENSAJE_INICIO,
  MENSAJE_SESION,
  type ClienteAuth,
} from '../src/services/auth.ts'

const usuario = { id: 'u-1', email: 'usuario@ejemplo.test' }
const sesionSb = { user: usuario }

function cliente(auth: Record<string, unknown>): ClienteAuth {
  return { auth } as unknown as ClienteAuth
}

describe('crearServicioAuth', () => {
  it('obtenerSesion convierte la sesión y oculta errores internos', async () => {
    const bien = crearServicioAuth(
      cliente({ getSession: async () => ({ data: { session: sesionSb }, error: null }) }),
    )
    expect(await bien.obtenerSesion()).toEqual({
      ok: true,
      datos: { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' },
    })

    const mal = crearServicioAuth(
      cliente({
        getSession: async () => ({ data: { session: null }, error: { message: 'detalle interno' } }),
      }),
    )
    expect(await mal.obtenerSesion()).toEqual({ ok: false, error: MENSAJE_SESION })

    const lanza = crearServicioAuth(
      cliente({ getSession: async () => { throw new Error('red caída') } }),
    )
    expect(await lanza.obtenerSesion()).toEqual({ ok: false, error: MENSAJE_SESION })
  })

  it('iniciarSesion distingue credenciales inválidas de otros fallos sin filtrar texto', async () => {
    const llamar = (error: unknown) =>
      crearServicioAuth(
        cliente({
          signInWithPassword: async () => ({ data: { session: null }, error }),
        }),
      ).iniciarSesion('a@b.test', 'x')

    expect(await llamar({ code: 'invalid_credentials', message: 'interno' })).toEqual({
      ok: false,
      error: MENSAJE_CREDENCIALES,
    })
    expect(await llamar({ status: 500, message: 'interno' })).toEqual({
      ok: false,
      error: MENSAJE_INICIO,
    })
  })

  it('cerrarSesion informa el fallo con mensaje genérico', async () => {
    const mal = crearServicioAuth(
      cliente({ signOut: async () => ({ error: { message: 'interno' } }) }),
    )
    expect(await mal.cerrarSesion()).toEqual({ ok: false, error: MENSAJE_CIERRE })
    const bien = crearServicioAuth(cliente({ signOut: async () => ({ error: null }) }))
    expect(await bien.cerrarSesion()).toEqual({ ok: true, datos: null })
  })

  it('suscribirCambiosSesion entrega sesiones de forma síncrona y cancela', () => {
    const unsubscribe = vi.fn()
    let callback!: (evento: string, sesion: unknown) => void
    const servicio = crearServicioAuth(
      cliente({
        onAuthStateChange: (cb: typeof callback) => {
          callback = cb
          return { data: { subscription: { unsubscribe } } }
        },
      }),
    )
    const alCambiar = vi.fn()
    const cancelar = servicio.suscribirCambiosSesion(alCambiar)
    callback('SIGNED_IN', sesionSb)
    callback('SIGNED_OUT', null)
    expect(alCambiar).toHaveBeenNthCalledWith(1, {
      usuario_id: 'u-1',
      correo: 'usuario@ejemplo.test',
    })
    expect(alCambiar).toHaveBeenNthCalledWith(2, null)
    cancelar()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
