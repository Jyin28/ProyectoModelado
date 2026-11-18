import {
  COLCHON_ALARMA_MAX_S,
  COLCHON_DURACION_MAX_S,
  TEXTO_MOTIVO,
  type ConfigColchon,
  type EstadoColchon,
  type MotivoParada,
  type SituacionColchon,
} from '../models/colchon.ts'
import type { EstadoModulo } from '../models/ordenes.ts'

export const MENSAJE_CONFIG_DURACION = `La duración va de 1 a ${COLCHON_DURACION_MAX_S} segundos, en números enteros.`
export const MENSAJE_CONFIG_TOLERANCIA =
  'La tolerancia debe ser mayor que 0 y menor que 100 %.'
export const MENSAJE_CONFIG_ALARMA = `La alarma dura de 1 a ${COLCHON_ALARMA_MAX_S} segundos, en números enteros.`

const SITUACIONES: readonly string[] = ['activo', 'alarma', 'detenido']

export type ResultadoConfigColchon =
  | { ok: true; config: ConfigColchon }
  | { ok: false; error: string }

function entero(texto: string, maximo: number): number | null {
  const limpio = texto.trim()
  if (!/^\d{1,6}$/.test(limpio)) return null
  const n = Number(limpio)
  return n >= 1 && n <= maximo ? n : null
}

function porcentaje(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(limpio)) return null
  const n = Number(limpio)
  return n > 0 && n < 100 ? n : null
}

/** Valida lo escrito. Un error no cambia la configuración guardada. */
export function validarConfigColchon(textos: {
  duracion_s: string
  tolerancia_pct: string
  alarma_s: string
}): ResultadoConfigColchon {
  const duracion_s = entero(textos.duracion_s, COLCHON_DURACION_MAX_S)
  if (duracion_s === null) return { ok: false, error: MENSAJE_CONFIG_DURACION }
  const tolerancia_pct = porcentaje(textos.tolerancia_pct)
  if (tolerancia_pct === null) return { ok: false, error: MENSAJE_CONFIG_TOLERANCIA }
  const alarma_s = entero(textos.alarma_s, COLCHON_ALARMA_MAX_S)
  if (alarma_s === null) return { ok: false, error: MENSAJE_CONFIG_ALARMA }
  return { ok: true, config: { duracion_s, tolerancia_pct, alarma_s } }
}

/**
 * Estado del colchón según lo último que informó la Pico. Sin ningún evento
 * (o con una forma inesperada) devuelve null: no se inventa un estado.
 */
export function leerEstadoColchon(estado: EstadoModulo | null): EstadoColchon | null {
  if (estado === null || estado.actualizado_en === null) return null
  const { colchon, referencia_g, motivo } = estado.estado
  if (typeof colchon !== 'string' || !SITUACIONES.includes(colchon)) return null
  const situacion = colchon as SituacionColchon
  const referencia =
    typeof referencia_g === 'number' && Number.isFinite(referencia_g) && referencia_g > 0
      ? referencia_g
      : null
  const motivoConocido =
    typeof motivo === 'string' && motivo in TEXTO_MOTIVO ? (motivo as MotivoParada) : null
  return {
    situacion,
    referencia_g: situacion === 'detenido' ? null : referencia,
    motivo: situacion === 'detenido' ? motivoConocido : null,
    desde: estado.actualizado_en,
  }
}
