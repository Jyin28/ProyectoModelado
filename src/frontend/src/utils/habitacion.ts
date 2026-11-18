import {
  FOTO_TAMANO_MAX_BYTES,
  FOTO_TIPOS_ACEPTADOS,
  TEXTO_MOTIVO_FOTO,
  type FotoHabitacion,
  type SensorHabitacion,
} from '../models/habitacion.ts'
import type { EstadoModulo } from '../models/ordenes.ts'

export const MENSAJE_FOTO_TIPO = 'La foto debe ser JPEG o PNG.'
export const MENSAJE_FOTO_TAMANO = 'La foto pesa más de 5 MB.'
export const MENSAJE_FOTO_VACIA = 'La foto está vacía.'

/**
 * Monitoreo de un sensor según lo último que la Pico confirmó. Devuelve null
 * mientras no haya una confirmación real: no se inventa un estado.
 */
export function leerMonitoreoSensor(
  estado: EstadoModulo | null,
  sensor: SensorHabitacion,
): boolean | null {
  if (estado === null || estado.actualizado_en === null) return null
  const valor = estado.estado[`monitoreo_${sensor}`]
  return typeof valor === 'boolean' ? valor : null
}

/** Mensaje de error si el archivo no se puede subir, o null si es válido. */
export function validarArchivoFoto(archivo: { type: string; size: number }): string | null {
  if (!(FOTO_TIPOS_ACEPTADOS as readonly string[]).includes(archivo.type)) return MENSAJE_FOTO_TIPO
  if (archivo.size <= 0) return MENSAJE_FOTO_VACIA
  if (archivo.size > FOTO_TAMANO_MAX_BYTES) return MENSAJE_FOTO_TAMANO
  return null
}

/** Ruta en el almacén: <dispositivo>/<evento>.<jpg|png>. */
export function rutaFoto(dispositivoId: string, eventId: string, tipo: string): string {
  return `${dispositivoId}/${eventId}.${tipo === 'image/png' ? 'png' : 'jpg'}`
}

/** Texto del estado de una foto; el de una foto fallida dice por qué. */
export function textoFoto(foto: FotoHabitacion): string {
  if (foto.estado === 'guardada') return 'Foto guardada.'
  if (foto.estado === 'fallida') {
    const motivo = foto.motivo === null ? '' : `: ${TEXTO_MOTIVO_FOTO[foto.motivo]}`
    return `No se tomó la foto${motivo}.`
  }
  return 'Foto pendiente: esperando la cámara.'
}
