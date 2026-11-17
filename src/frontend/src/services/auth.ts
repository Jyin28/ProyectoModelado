import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { Resultado, ServicioAuth, Sesion } from './tipos.ts'

// Solo se necesita la parte de Auth del cliente (facilita las pruebas).
export type ClienteAuth = Pick<SupabaseClient, 'auth'>

// Mensajes seguros para mostrar: nunca se reenvía el texto del servidor.
export const MENSAJE_SESION = 'No se pudo verificar la sesión.'
export const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.'
export const MENSAJE_INICIO = 'No se pudo iniciar sesión. Intenta de nuevo.'
export const MENSAJE_CIERRE = 'No se pudo cerrar la sesión. Intenta de nuevo.'

function aSesion(sesion: Session | null | undefined): Sesion | null {
  if (!sesion?.user) return null
  return { usuario_id: sesion.user.id, correo: sesion.user.email ?? '' }
}

function fallo<T>(error: string): Resultado<T> {
  return { ok: false, error }
}

function esCredencialInvalida(error: unknown): boolean {
  const e = error as { code?: string; status?: number } | null
  return e?.code === 'invalid_credentials' || e?.status === 400
}

export function crearServicioAuth(cliente: ClienteAuth): ServicioAuth {
  return {
    async obtenerSesion() {
      try {
        const { data, error } = await cliente.auth.getSession()
        if (error) return fallo(MENSAJE_SESION)
        return { ok: true, datos: aSesion(data.session) }
      } catch {
        return fallo(MENSAJE_SESION)
      }
    },

    async iniciarSesion(correo, contrasena) {
      try {
        const { data, error } = await cliente.auth.signInWithPassword({
          email: correo,
          password: contrasena,
        })
        if (error) {
          return fallo(
            esCredencialInvalida(error) ? MENSAJE_CREDENCIALES : MENSAJE_INICIO,
          )
        }
        const sesion = aSesion(data.session)
        return sesion ? { ok: true, datos: sesion } : fallo(MENSAJE_INICIO)
      } catch {
        return fallo(MENSAJE_INICIO)
      }
    },

    async cerrarSesion() {
      try {
        const { error } = await cliente.auth.signOut()
        if (error) return fallo(MENSAJE_CIERRE)
        return { ok: true, datos: null }
      } catch {
        return fallo(MENSAJE_CIERRE)
      }
    },

    suscribirCambiosSesion(alCambiar) {
      // El callback es síncrono a propósito: Supabase bloquea Auth si se
      // hacen llamadas async dentro de él.
      const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => {
        alCambiar(aSesion(sesion))
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
