// Habitación: sensores, eventos y fotografías, tal como los guarda el servidor.
// Contrato: src/shared/contracts/habitacion.md. Las fechas son ISO 8601 en UTC.
// La cámara solo toma fotos: no hay video y Telegram nunca recibe la imagen.

export const SENSORES_HABITACION = ['puerta', 'movimiento'] as const
export type SensorHabitacion = (typeof SENSORES_HABITACION)[number]

export const NOMBRE_SENSOR: Record<SensorHabitacion, string> = {
  puerta: 'Puerta',
  movimiento: 'Movimiento',
}

export const TIPOS_EVENTO_HABITACION = ['puerta', 'movimiento_habitacion'] as const
export type TipoEventoHabitacion = (typeof TIPOS_EVENTO_HABITACION)[number]

export type EventoHabitacion = {
  event_id: string
  tipo: TipoEventoHabitacion
  descripcion: string
  ts: string
}

export type EstadoFoto = 'pendiente' | 'guardada' | 'fallida'
export const ESTADOS_FOTO: readonly EstadoFoto[] = ['pendiente', 'guardada', 'fallida']

export type MotivoFoto = 'camara_no_disponible' | 'carga_fallida'
export const MOTIVOS_FOTO: readonly MotivoFoto[] = ['camara_no_disponible', 'carga_fallida']

export const TEXTO_MOTIVO_FOTO: Record<MotivoFoto, string> = {
  camara_no_disponible: 'la cámara no estuvo disponible',
  carga_fallida: 'no se pudo subir la imagen',
}

export type FotoHabitacion = {
  event_id: string
  estado: EstadoFoto
  /** Solo con estado «guardada». */
  ruta: string | null
  /** Solo con estado «fallida». */
  motivo: MotivoFoto | null
  solicitada_en: string
  resuelta_en: string | null
}

export const BUCKET_FOTOS = 'fotos-habitacion'
export const FOTO_TIPOS_ACEPTADOS = ['image/jpeg', 'image/png'] as const
export const FOTO_TAMANO_MAX_BYTES = 5 * 1024 * 1024
/** Vigencia del enlace para ver una foto: el enlace caduca solo. */
export const FOTO_ENLACE_SEGUNDOS = 60
