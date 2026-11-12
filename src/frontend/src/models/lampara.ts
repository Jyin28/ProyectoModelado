// Orden de la lámpara tal como la guarda public.ordenes_lampara
// (ver src/shared/contracts/lampara.md). Las fechas son ISO 8601 en UTC.

import type { EstadoComando } from './contrato.ts'

/** Estado guardado por el servidor. */
export type EstadoOrdenLampara =
  | 'pendiente'
  | 'enviado'
  | 'confirmado'
  | 'error'

export type OrdenLampara = {
  command_id: string
  device_id: string
  /** Nivel pedido por el cuidador (0–100). No es el nivel aplicado. */
  nivel: number
  creado_en: string
  vence_en: string
  estado: EstadoOrdenLampara
  entregado_en: string | null
  confirmado_en: string | null
  /** Nivel que la Pico reportó haber aplicado a su salida. No prueba la luz. */
  nivel_confirmado: number | null
  error: string | null
}

/** Estado mostrado: el del servidor, más «enviada» y «sin-respuesta». */
export type EstadoVisibleLampara = EstadoComando | 'enviada'
