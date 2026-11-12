import {
  NIVEL_LAMPARA_MAX,
  NIVEL_LAMPARA_MIN,
} from '../models/contrato.ts'
import type {
  EstadoVisibleLampara,
  OrdenLampara,
} from '../models/lampara.ts'

export function esNivelValido(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= NIVEL_LAMPARA_MIN &&
    valor <= NIVEL_LAMPARA_MAX
  )
}

/** Acepta solo enteros decimales de 0 a 100 («40»; no «4.5», «1e1» ni «-0»). */
export function parsearNivel(texto: string): number | null {
  const limpio = texto.trim()
  if (!/^\d{1,3}$/.test(limpio)) return null
  const n = Number(limpio)
  return esNivelValido(n) ? n : null
}

/**
 * Estado a mostrar. El servidor no cambia el estado al vencer: una orden
 * `pendiente` o `enviado` cuya `vence_en` ya pasó es «sin respuesta».
 */
export function estadoVisible(
  orden: OrdenLampara,
  ahora: Date,
): EstadoVisibleLampara {
  if (orden.estado === 'confirmado') return 'confirmado'
  if (orden.estado === 'error') return 'error'
  const vence = Date.parse(orden.vence_en)
  if (Number.isNaN(vence) || ahora.getTime() > vence) return 'sin-respuesta'
  return orden.estado === 'enviado' ? 'enviada' : 'pendiente'
}
