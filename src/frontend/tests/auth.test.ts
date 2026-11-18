import { describe, expect, it, vi } from 'vitest'
import {
  crearServicioAuth,
  MENSAJE_CAMPOS_VACIOS,
  MENSAJE_CIERRE,
  MENSAJE_CONTRASENA_DEBIL,
  MENSAJE_CORREO_EN_USO,
  MENSAJE_REGISTRO,
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

describe('crearServicioAuth.registrarse (HU-01, CA-01.4)', () => {
  const registrar = (resultado: unknown, correo = 'a@b.test', clave = 'clave-larga-1') => {
    const signUp = vi.fn(async () => resultado)
    const servicio = crearServicioAuth(cliente({ signUp }))
    return { signUp, llamada: servicio.registrarse(correo, clave) }
  }

  it('campos vacíos no llegan al servidor', async () => {
    for (const [correo, clave] of [['', 'x'], ['   ', 'x'], ['a@b.test', '']]) {
      const { signUp, llamada } = registrar({ data: {}, error: null }, correo, clave)
      expect(await llamada).toEqual({ ok: false, error: MENSAJE_CAMPOS_VACIOS })
      expect(signUp).not.toHaveBeenCalled()
    }
  })

  it('una cuenta nueva con confirmación pendiente no tiene sesión', async () => {
    const { llamada } = registrar({
      data: { user: { id: 'u-1', identities: [{}] }, session: null },
      error: null,
    })
    expect(await llamada).toEqual({ ok: true, datos: { requiereConfirmacion: true } })
  })

  it('una cuenta nueva con sesión inmediata no pide confirmar', async () => {
    const { llamada } = registrar({
      data: { user: { id: 'u-1', identities: [{}] }, session: { user: { id: 'u-1' } } },
      error: null,
    })
    expect(await llamada).toEqual({ ok: true, datos: { requiereConfirmacion: false } })
  })

  it('un correo repetido no crea otra cuenta, con error o sin él', async () => {
    const conError = registrar({ data: {}, error: { code: 'user_already_exists', message: 'interno' } })
    expect(await conError.llamada).toEqual({ ok: false, error: MENSAJE_CORREO_EN_USO })
    const sinError = registrar({ data: { user: { id: 'u-9', identities: [] }, session: null }, error: null })
    expect(await sinError.llamada).toEqual({ ok: false, error: MENSAJE_CORREO_EN_USO })
  })

  it('distingue contraseña débil y oculta otros fallos', async () => {
    const debil = registrar({ data: {}, error: { code: 'weak_password', message: 'interno' } })
    expect(await debil.llamada).toEqual({ ok: false, error: MENSAJE_CONTRASENA_DEBIL })
    const otro = registrar({ data: {}, error: { status: 500, message: 'interno' } })
    expect(await otro.llamada).toEqual({ ok: false, error: MENSAJE_REGISTRO })
    const lanza = crearServicioAuth(
      cliente({ signUp: async () => { throw new Error('red caída') } }),
    )
    expect(await lanza.registrarse('a@b.test', 'x')).toEqual({ ok: false, error: MENSAJE_REGISTRO })
  })
})
