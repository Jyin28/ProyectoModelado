import {
  MOTIVO_CORRECCION_MAX,
  PESO_MAX_G,
  TEMP_BIBERON_MAX_C,
  TEMP_BIBERON_MIN_C,
  type CampoCorreccion,
  type LimitesBiberon,
  type Toma,
} from '../models/alimentacion.ts'

export const MENSAJE_PESO_NUMERO = `Escribe el peso en gramos: un número mayor que 0 y hasta ${PESO_MAX_G}.`
export const MENSAJE_MOTIVO_CORRECCION = `Explica el motivo de la corrección (hasta ${MOTIVO_CORRECCION_MAX} caracteres).`
export const MENSAJE_LIMITES_BIBERON_NUMERO = 'Escribe un número en cada límite.'
export const MENSAJE_LIMITES_BIBERON_RANGO = `Los límites deben estar entre ${TEMP_BIBERON_MIN_C} y ${TEMP_BIBERON_MAX_C} °C.`
export const MENSAJE_LIMITES_BIBERON_MIN_MAX = 'El mínimo debe ser menor que el máximo.'

const formateadorNumero = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 })

/** «200 g», «150,5 g». */
export function formatearGramos(gramos: number): string {
  return `${formateadorNumero.format(gramos)} g`
}

/** «37,5 °C». */
export function formatearGrados(grados: number): string {
  return `${formateadorNumero.format(grados)} °C`
}

/** Gramos escritos por una persona: número positivo con hasta dos decimales. */
export function parsearGramos(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(limpio)) return null
  const n = Number(limpio)
  return n > 0 && n <= PESO_MAX_G ? n : null
}

export type ResultadoCorreccion =
  | { ok: true; valor: number; motivo: string }
  | { ok: false; error: string }

/** Valida el peso y el motivo de una corrección antes de enviarla. */
export function validarCorreccion(textoValor: string, textoMotivo: string): ResultadoCorreccion {
  const valor = parsearGramos(textoValor)
  if (valor === null) return { ok: false, error: MENSAJE_PESO_NUMERO }
  const motivo = textoMotivo.trim()
  if (motivo.length === 0 || motivo.length > MOTIVO_CORRECCION_MAX) {
    return { ok: false, error: MENSAJE_MOTIVO_CORRECCION }
  }
  return { ok: true, valor, motivo }
}

function aGrados(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(limpio)) return null
  return Number(limpio)
}

export type ResultadoLimitesBiberon =
  | { ok: true; limites: LimitesBiberon }
  | { ok: false; error: string }

/** Valida los límites de frío y calor. Un error no cambia los límites guardados. */
export function validarLimitesBiberon(textoMin: string, textoMax: string): ResultadoLimitesBiberon {
  const temp_min = aGrados(textoMin)
  const temp_max = aGrados(textoMax)
  if (temp_min === null || temp_max === null) {
    return { ok: false, error: MENSAJE_LIMITES_BIBERON_NUMERO }
  }
  if (temp_min < TEMP_BIBERON_MIN_C || temp_max > TEMP_BIBERON_MAX_C) {
    return { ok: false, error: MENSAJE_LIMITES_BIBERON_RANGO }
  }
  if (temp_min >= temp_max) return { ok: false, error: MENSAJE_LIMITES_BIBERON_MIN_MAX }
  return { ok: true, limites: { temp_min, temp_max } }
}

/** «13 min 5 s», «1 h 2 min 0 s». */
export function formatearDuracion(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const resto = s % 60
  if (h > 0) return `${h} h ${m} min ${resto} s`
  return `${m} min ${resto} s`
}

/**
 * Duración activa para mostrar. Con la toma en curso suma lo transcurrido desde
 * que llegó la consulta (la hora de referencia es la del servidor, no la del
 * reloj del teléfono). En pausa, finalizada o sin iniciar no avanza.
 */
export function duracionVisibleS(toma: Toma, recibidoEnMs: number, ahoraMs: number): number | null {
  if (toma.duracion_activa_s === null) return null
  if (toma.estado !== 'en_curso') return toma.duracion_activa_s
  const transcurrido = Math.max(0, Math.floor((ahoraMs - recibidoEnMs) / 1000))
  return toma.duracion_activa_s + transcurrido
}

/** Último valor que se conoce de un campo corregible. */
export function pesoDeCampo(toma: Toma, campo: CampoCorreccion): number | null {
  return campo === 'peso_inicial_g' ? toma.peso_inicial_g : toma.peso_final_g
}

/** Campos que se pueden corregir según el estado de la toma. */
export function camposCorregibles(toma: Toma): CampoCorreccion[] {
  if (toma.estado === 'por_cerrar' || toma.estado === 'completa') {
    return ['peso_inicial_g', 'peso_final_g']
  }
  if (toma.estado === 'en_curso' || toma.estado === 'pausada') return ['peso_inicial_g']
  return []
}
