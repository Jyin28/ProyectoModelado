// Interfaces de los servicios de la web. Se implementarán con Supabase cuando
// existan las tablas. Los tipos de datos vienen de models/contrato.ts
// (PROVISIONAL, pendiente de acuerdo con Persona B y C).

import type {
  Comando,
  Confirmacion,
  EventoMovimiento,
  LecturaAmbiental,
  LecturaPeso,
  Modulo,
  OrdenComando,
} from '../models/contrato.ts'

export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string }

/** Función que cancela una suscripción. */
export type Cancelar = () => void

export type Manejadores<T> = {
  alRecibir: (dato: T) => void
  alError?: (error: string) => void
}

// PROVISIONAL: la forma de la sesión depende de Supabase Auth.
export type Sesion = {
  usuario_id: string
  correo: string
}

export interface ServicioLecturas {
  obtenerUltimaAmbiental(
    dispositivoId: string,
  ): Promise<Resultado<LecturaAmbiental | null>>
  obtenerHistorialAmbiental(
    dispositivoId: string,
    desde: string, // ISO UTC
    hasta: string, // ISO UTC
  ): Promise<Resultado<LecturaAmbiental[]>>
  obtenerUltimoPeso(dispositivoId: string): Promise<Resultado<LecturaPeso | null>>
  obtenerEventosMovimiento(
    dispositivoId: string,
    desde: string, // ISO UTC
  ): Promise<Resultado<EventoMovimiento[]>>
  suscribirAmbiental(
    dispositivoId: string,
    manejadores: Manejadores<LecturaAmbiental>,
  ): Cancelar
}

export interface ServicioComandos {
  enviarComando(
    modulo: Modulo,
    orden: OrdenComando,
  ): Promise<Resultado<Comando>>
  suscribirConfirmaciones(manejadores: Manejadores<Confirmacion>): Cancelar
}

export interface ServicioAuth {
  obtenerSesion(): Promise<Resultado<Sesion | null>>
  iniciarSesion(correo: string, contrasena: string): Promise<Resultado<Sesion>>
  cerrarSesion(): Promise<Resultado<null>>
  suscribirCambiosSesion(alCambiar: (sesion: Sesion | null) => void): Cancelar
}

export type Servicios = {
  lecturas: ServicioLecturas
  comandos: ServicioComandos
  auth: ServicioAuth
}
