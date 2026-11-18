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
import type {
  Bebe,
  Dueno,
  InvitacionDueno,
  ModuloAsociado,
} from '../models/cuentas.ts'
import type { OrdenLampara } from '../models/lampara.ts'
import type {
  CodigoVinculacion,
  DestinatarioTelegram,
} from '../models/telegram.ts'

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
  obtenerUltimoMovimiento(
    dispositivoId: string,
  ): Promise<Resultado<EventoMovimiento | null>>
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

export interface ServicioLampara {
  /** Registra una solicitud (RPC solicitar_lampara). No prueba que la luz cambie. */
  solicitarLampara(
    dispositivoId: string,
    nivel: number,
  ): Promise<Resultado<OrdenLampara>>
  obtenerUltimaOrdenLampara(
    dispositivoId: string,
  ): Promise<Resultado<OrdenLampara | null>>
}

export type ResultadoRegistro = {
  /** true si la cuenta existe pero falta confirmar el correo antes de iniciar sesión. */
  requiereConfirmacion: boolean
}

export interface ServicioAuth {
  obtenerSesion(): Promise<Resultado<Sesion | null>>
  iniciarSesion(correo: string, contrasena: string): Promise<Resultado<Sesion>>
  /** Crea la cuenta. Un correo repetido o campos vacíos no crean una segunda cuenta. */
  registrarse(
    correo: string,
    contrasena: string,
  ): Promise<Resultado<ResultadoRegistro>>
  cerrarSesion(): Promise<Resultado<null>>
  suscribirCambiosSesion(alCambiar: (sesion: Sesion | null) => void): Cancelar
}

export interface ServicioCuentas {
  listarBebes(): Promise<Resultado<Bebe[]>>
  /** Nombre obligatorio; fecha de nacimiento (AAAA-MM-DD) opcional. */
  crearBebe(
    nombre: string,
    fechaNacimiento: string | null,
  ): Promise<Resultado<Bebe>>
  listarDispositivos(): Promise<Resultado<ModuloAsociado[]>>
  /** Asocia un módulo con su código de reclamo de un solo uso. */
  reclamarDispositivo(
    dispositivoId: string,
    codigo: string,
  ): Promise<Resultado<null>>
  /** Reasigna desde ahora; `null` cierra la asignación. No borra historial. */
  asignarDispositivo(
    dispositivoId: string,
    bebeId: string | null,
  ): Promise<Resultado<null>>
  listarDuenos(dispositivoId: string): Promise<Resultado<Dueno[]>>
  invitarDueno(dispositivoId: string, correo: string): Promise<Resultado<null>>
  retirarDueno(
    dispositivoId: string,
    usuarioId: string,
  ): Promise<Resultado<null>>
  listarInvitaciones(): Promise<Resultado<InvitacionDueno[]>>
  aceptarInvitacion(invitacionId: string): Promise<Resultado<null>>
}

export interface ServicioTelegram {
  listarDestinatarios(dispositivoId: string): Promise<Resultado<DestinatarioTelegram[]>>
  crearDestinatario(
    dispositivoId: string,
    nombre: string,
  ): Promise<Resultado<DestinatarioTelegram>>
  /** El código se muestra una sola vez; el servidor guarda solo su hash. */
  generarCodigo(destinatarioId: string): Promise<Resultado<CodigoVinculacion>>
  retirarDestinatario(destinatarioId: string): Promise<Resultado<null>>
}

export type Servicios = {
  lecturas: ServicioLecturas
  comandos: ServicioComandos
  lampara: ServicioLampara
  auth: ServicioAuth
  cuentas: ServicioCuentas
  telegram: ServicioTelegram
}
