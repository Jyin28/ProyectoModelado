import {
  CATALOGO_AUDIO,
  LED_INDICE_MAX,
  LED_INTERVALO_MAX_S,
  LED_INTERVALO_MIN_S,
  SECUENCIAS_LED,
  type ComandoModulo,
  type EstadoVisibleOrden,
  type LimitesAmbiente,
  type OrdenModulo,
} from '../models/ordenes.ts'

export const MENSAJE_INTERVALO = `El intervalo va de ${LED_INTERVALO_MIN_S} a ${LED_INTERVALO_MAX_S} segundos.`
export const MENSAJE_LIMITES_MIN_MAX = 'En cada variable el mínimo debe ser menor que el máximo.'
export const MENSAJE_LIMITES_NUMERO = 'Escribe un número en cada límite.'
export const MENSAJE_LIMITES_RANGO =
  'La temperatura va de -40 a 85 °C y la humedad de 0 a 100 %.'

const esEnteroEn = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** true si el comando cumple los mismos rangos que el firmware y la base. */
export function comandoValido(comando: ComandoModulo): boolean {
  const p: Record<string, unknown> = comando.params
  switch (comando.command) {
    case 'led_set':
      return esEnteroEn(p.index, 0, LED_INDICE_MAX) && typeof p.on === 'boolean'
    case 'led_all':
      return typeof p.on === 'boolean'
    case 'led_sequence':
      return (
        SECUENCIAS_LED.includes(p.name as (typeof SECUENCIAS_LED)[number]) &&
        typeof p.step_s === 'number' &&
        Number.isFinite(p.step_s) &&
        p.step_s >= LED_INTERVALO_MIN_S &&
        p.step_s <= LED_INTERVALO_MAX_S
      )
    case 'led_stop':
    case 'audio_stop':
      return Object.keys(p).length === 0
    case 'audio_play':
      return CATALOGO_AUDIO.some((s) => s.id === p.sound)
    case 'motion_set':
      return typeof p.enabled === 'boolean'
    default:
      return false
  }
}

/** Intervalo en segundos: número de 2 a 3600 (se aceptan decimales). */
export function parsearIntervalo(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(limpio)) return null
  const n = Number(limpio)
  return n >= LED_INTERVALO_MIN_S && n <= LED_INTERVALO_MAX_S ? n : null
}

/**
 * Estado a mostrar. El servidor no cambia el estado al vencer: una orden
 * `pendiente` o `enviado` cuya `vence_en` ya pasó es «sin respuesta».
 */
export function estadoVisibleOrden(
  orden: OrdenModulo,
  ahora: Date,
): EstadoVisibleOrden {
  if (orden.estado === 'confirmado') return 'confirmado'
  if (orden.estado === 'error') return 'error'
  const vence = Date.parse(orden.vence_en)
  if (Number.isNaN(vence) || ahora.getTime() > vence) return 'sin-respuesta'
  return orden.estado === 'enviado' ? 'enviada' : 'pendiente'
}

function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(limpio)) return null
  return Number(limpio)
}

export type ResultadoLimites =
  | { ok: true; limites: LimitesAmbiente }
  | { ok: false; error: string }

/** Valida los cuatro límites escritos. Un error no cambia los límites guardados. */
export function validarLimites(textos: {
  temp_min: string
  temp_max: string
  hum_min: string
  hum_max: string
}): ResultadoLimites {
  const temp_min = aNumero(textos.temp_min)
  const temp_max = aNumero(textos.temp_max)
  const hum_min = aNumero(textos.hum_min)
  const hum_max = aNumero(textos.hum_max)
  if (temp_min === null || temp_max === null || hum_min === null || hum_max === null) {
    return { ok: false, error: MENSAJE_LIMITES_NUMERO }
  }
  if (temp_min < -40 || temp_max > 85 || hum_min < 0 || hum_max > 100) {
    return { ok: false, error: MENSAJE_LIMITES_RANGO }
  }
  if (temp_min >= temp_max || hum_min >= hum_max) {
    return { ok: false, error: MENSAJE_LIMITES_MIN_MAX }
  }
  return { ok: true, limites: { temp_min, temp_max, hum_min, hum_max } }
}

/** Hora «HH:MM» de 24 h. */
export function horaValida(texto: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(texto)
}
