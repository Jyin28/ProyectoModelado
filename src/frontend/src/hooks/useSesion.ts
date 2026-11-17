import { createContext, useContext } from 'react'
import type { Resultado, Sesion } from '../services/tipos.ts'

export type EstadoSesion =
  | { tipo: 'sin-configurar' }
  | { tipo: 'verificando' }
  | { tipo: 'anonimo'; error?: string }
  | { tipo: 'autenticado'; sesion: Sesion }

export type ValorSesion = {
  estado: EstadoSesion
  iniciarSesion: (
    correo: string,
    contrasena: string,
  ) => Promise<Resultado<Sesion>>
  cerrarSesion: () => Promise<Resultado<null>>
}

// Sin proveedor la sesión no aplica (backend sin configurar).
export const ContextoSesion = createContext<ValorSesion>({
  estado: { tipo: 'sin-configurar' },
  iniciarSesion: () =>
    Promise.resolve({ ok: false, error: 'Backend no configurado' }),
  cerrarSesion: () =>
    Promise.resolve({ ok: false, error: 'Backend no configurado' }),
})

export function useSesion(): ValorSesion {
  return useContext(ContextoSesion)
}
