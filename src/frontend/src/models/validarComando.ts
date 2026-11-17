import {
  CANTIDAD_LEDS,
  INTERVALO_SECUENCIA_MIN_S,
  NIVEL_LAMPARA_MAX,
  NIVEL_LAMPARA_MIN,
} from './contrato.ts'
import type { OrdenComando } from './contrato.ts'

export type ResultadoValidacion = { ok: true } | { ok: false; error: string }

const VALIDO: ResultadoValidacion = { ok: true }

function fallo(error: string): ResultadoValidacion {
  return { ok: false, error }
}

function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function validarEncendido(params: Record<string, unknown>): ResultadoValidacion {
  return typeof params.on === 'boolean'
    ? VALIDO
    : fallo('El parámetro «on» debe ser verdadero o falso.')
}

// Valida los parámetros antes de enviar. Revisa tipos reales en ejecución.
export function validarComando(orden: OrdenComando): ResultadoValidacion {
  const bruto: unknown = orden?.params
  const params: Record<string, unknown> =
    typeof bruto === 'object' && bruto !== null
      ? (bruto as Record<string, unknown>)
      : {}

  switch (orden?.command) {
    case 'lamp_set': {
      const nivel = params.level
      if (
        !esNumero(nivel) ||
        nivel < NIVEL_LAMPARA_MIN ||
        nivel > NIVEL_LAMPARA_MAX
      ) {
        return fallo(
          `El nivel de la lámpara debe ser un número entre ${NIVEL_LAMPARA_MIN} y ${NIVEL_LAMPARA_MAX}.`,
        )
      }
      return VALIDO
    }
    case 'led_set': {
      const indice = params.index
      if (
        !esNumero(indice) ||
        !Number.isInteger(indice) ||
        indice < 0 ||
        indice > CANTIDAD_LEDS - 1
      ) {
        return fallo(
          `El índice del LED debe ser un entero entre 0 y ${CANTIDAD_LEDS - 1}.`,
        )
      }
      return validarEncendido(params)
    }
    case 'led_all':
      return validarEncendido(params)
    case 'led_sequence': {
      if (typeof params.name !== 'string' || params.name.trim() === '') {
        return fallo('El nombre de la secuencia no puede estar vacío.')
      }
      const intervalo = params.step_s
      if (!esNumero(intervalo) || intervalo < INTERVALO_SECUENCIA_MIN_S) {
        return fallo(
          `El intervalo de la secuencia debe ser un número de al menos ${INTERVALO_SECUENCIA_MIN_S} s.`,
        )
      }
      return VALIDO
    }
    case 'led_stop':
    case 'get_status':
      return VALIDO
    default:
      return fallo('Comando desconocido.')
  }
}
