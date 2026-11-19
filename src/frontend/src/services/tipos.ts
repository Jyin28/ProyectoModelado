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
import type {
  AccionToma,
  CampoCorreccion,
  LecturaTemperatura,
  LimitesBiberon,
  ListaTomas,
  MomentoPeso,
  Toma,
} from '../models/alimentacion.ts'
import type { RespuestaHistorial } from '../models/historial.ts'
import type { ConfigColchon, EventoColchon } from '../models/colchon.ts'
import type { EventoColchonPico, OrdenColchonPico } from '../models/colchonPico.ts'
import type {
  EventoHabitacion,
  FotoHabitacion,
  MotivoFoto,
} from '../models/habitacion.ts'
import type { OrdenLampara } from '../models/lampara.ts'
import type {
  ComandoModulo,
  EstadoModulo,
  FaseVoz,
  LimitesAmbiente,
  OrdenModulo,
} from '../models/ordenes.ts'
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

export interface ServicioOrdenes {
  /** Registra una solicitud (RPC solicitar_orden). No prueba que el hardware actúe. */
  solicitar(
    dispositivoId: string,
    comando: ComandoModulo,
  ): Promise<Resultado<OrdenModulo>>
  /** Última orden del módulo entre los comandos dados. */
  obtenerUltimaOrden(
    dispositivoId: string,
    comandos: readonly string[],
  ): Promise<Resultado<OrdenModulo | null>>
  /** Lo último que la Pico confirmó; vacío si nunca confirmó nada. */
  obtenerEstado(dispositivoId: string): Promise<Resultado<EstadoModulo>>
}

export interface ServicioLimites {
  obtener(dispositivoId: string): Promise<Resultado<LimitesAmbiente | null>>
  /** Un rechazo conserva los límites anteriores. */
  guardar(
    dispositivoId: string,
    limites: LimitesAmbiente,
  ): Promise<Resultado<LimitesAmbiente>>
}

export interface ServicioHorarios {
  /** Horas «HH:MM» (hora de Costa Rica) activas para un tipo de horario. */
  listar(dispositivoId: string, tipo: string): Promise<Resultado<string[]>>
  reemplazar(
    dispositivoId: string,
    tipo: string,
    horas: string[],
  ): Promise<Resultado<string[]>>
}

/** Sesión de voz abierta: difunde fragmentos y se cierra con voz_fin. */
export interface SesionVoz {
  enviar(seq: number, pcmBase64: string): Promise<boolean>
  cerrar(): Promise<void>
}

export interface ServicioVoz {
  abrir(productoId: string): Promise<Resultado<SesionVoz>>
  /** Registra que hubo voz (sin audio). */
  registrarActividad(
    dispositivoId: string,
    fase: FaseVoz,
  ): Promise<Resultado<null>>
}

export interface ServicioColchon {
  /** Configuración guardada, o null si nunca se guardó (no hay valores por defecto). */
  obtenerConfig(dispositivoId: string): Promise<Resultado<ConfigColchon | null>>
  /** Un rechazo conserva la configuración anterior. */
  guardarConfig(
    dispositivoId: string,
    config: ConfigColchon,
  ): Promise<Resultado<ConfigColchon>>
  /** Eventos de armado, alarma y parada, del más reciente al más antiguo. */
  listarEventos(
    dispositivoId: string,
    limite: number,
  ): Promise<Resultado<EventoColchon[]>>
}

export interface ServicioHabitacion {
  /** Eventos de puerta y movimiento, del más reciente al más antiguo. */
  listarEventos(
    dispositivoId: string,
    limite: number,
  ): Promise<Resultado<EventoHabitacion[]>>
  /** Solicitudes de foto y su estado, de la más reciente a la más antigua. */
  listarFotos(
    dispositivoId: string,
    limite: number,
  ): Promise<Resultado<FotoHabitacion[]>>
  /** Enlace temporal (60 s) a una foto guardada; solo lo obtiene un dueño. */
  urlFoto(ruta: string): Promise<Resultado<string>>
  /** Sube la imagen al almacén privado y la registra para su evento. */
  subirFoto(
    dispositivoId: string,
    eventId: string,
    archivo: Blob,
  ): Promise<Resultado<null>>
  /** Deja constancia de que la foto no se pudo tomar. */
  marcarFallida(eventId: string, motivo: MotivoFoto): Promise<Resultado<null>>
}

export interface ServicioAlimentacion {
  /** Tomas del módulo, de la más reciente a la más antigua, con la hora del servidor. */
  listarTomas(dispositivoId: string, limite: number): Promise<Resultado<ListaTomas>>
  /** Abre una toma en estado «preparando» para el bebé vigente del módulo. */
  crearToma(dispositivoId: string, tomaId: string): Promise<Resultado<Toma>>
  /** Iniciar, pausar, reanudar, finalizar, cerrar o cancelar. El servidor valida el estado. */
  cambiarEstado(tomaId: string, accion: AccionToma): Promise<Resultado<Toma>>
  /** Pide a la Pico un pesaje; el peso llega después como evento, no en la respuesta. */
  pedirPeso(tomaId: string, momento: MomentoPeso, commandId: string): Promise<Resultado<null>>
  /** Corrige un peso con motivo obligatorio; la corrección queda auditada. */
  corregir(
    tomaId: string,
    campo: CampoCorreccion,
    valor: number,
    motivo: string,
  ): Promise<Resultado<Toma>>
  obtenerLimites(dispositivoId: string): Promise<Resultado<LimitesBiberon | null>>
  guardarLimites(dispositivoId: string, limites: LimitesBiberon): Promise<Resultado<LimitesBiberon>>
  /** Última temperatura informada por la Pico, o null si nunca informó. */
  ultimaTemperatura(dispositivoId: string): Promise<Resultado<LecturaTemperatura | null>>
}

export interface ServicioHistorial {
  /** Registros del bebé en [desde, hasta) (milisegundos UTC), ya unificados por el servidor. */
  consultar(bebeId: string, desde: number, hasta: number): Promise<Resultado<RespuestaHistorial>>
}

/**
 * Colchón de la Pico del colchón (pico-figuras-colchon-01): lee eventos_colchon y
 * pide órdenes con solicitar_comando_colchon. Convive con `ServicioColchon`
 * (fase 6, módulo cuna-colchon-NN con órdenes por módulo).
 */
export interface ServicioColchonPico {
  obtenerUltimoEvento(
    dispositivoId: string,
  ): Promise<Resultado<EventoColchonPico | null>>
  obtenerHistorialEventos(
    dispositivoId: string,
    limite?: number,
  ): Promise<Resultado<EventoColchonPico[]>>
  solicitarComando(
    dispositivoId: string,
    comando: string,
    parametros?: Record<string, unknown>,
  ): Promise<Resultado<OrdenColchonPico>>
  suscribirEventos(
    dispositivoId: string,
    manejadores: Manejadores<EventoColchonPico>,
  ): Cancelar
}

export type Servicios = {
  lecturas: ServicioLecturas
  comandos: ServicioComandos
  lampara: ServicioLampara
  ordenes: ServicioOrdenes
  limites: ServicioLimites
  horarios: ServicioHorarios
  voz: ServicioVoz
  colchon: ServicioColchon
  colchonPico: ServicioColchonPico
  habitacion: ServicioHabitacion
  alimentacion: ServicioAlimentacion
  historial: ServicioHistorial
  auth: ServicioAuth
  cuentas: ServicioCuentas
  telegram: ServicioTelegram
}
