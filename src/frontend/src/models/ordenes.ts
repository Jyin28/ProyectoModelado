// Órdenes remotas por módulo, tal como las guarda public.ordenes_modulo.
// Contrato: src/shared/contracts/ordenes.md. Las fechas son ISO 8601 en UTC.
// Los comandos y rangos son idénticos a src/firmware/common/utilities/comandos.py.

export const SECUENCIAS_LED = ['chase', 'alternate', 'blink_all'] as const
export type SecuenciaLed = (typeof SECUENCIAS_LED)[number]

export const NOMBRE_SECUENCIA: Record<SecuenciaLed, string> = {
  chase: 'Persecución (un LED recorre la fila)',
  alternate: 'Alternados',
  blink_all: 'Todos parpadean',
}

export const LED_INDICE_MAX = 5
export const LED_INTERVALO_MIN_S = 2
export const LED_INTERVALO_MAX_S = 3600

/** Sonidos que la Pico sabe reproducir hoy: solo un tono sintetizado. */
export const CATALOGO_AUDIO = [
  { id: 'tono_suave', nombre: 'Tono suave' },
] as const

export type ComandoFiguras =
  | { command: 'led_set'; params: { index: number; on: boolean } }
  | { command: 'led_all'; params: { on: boolean } }
  | { command: 'led_sequence'; params: { name: SecuenciaLed; step_s: number } }
  | { command: 'led_stop'; params: Record<string, never> }

export type ComandoAudio =
  | { command: 'audio_play'; params: { sound: string } }
  | { command: 'audio_stop'; params: Record<string, never> }

export type ComandoMovimiento = {
  command: 'motion_set'
  params: { enabled: boolean }
}

export type ComandoModulo = ComandoFiguras | ComandoAudio | ComandoMovimiento

export const COMANDOS_FIGURAS = ['led_set', 'led_all', 'led_sequence', 'led_stop']
export const COMANDOS_AUDIO = ['audio_play', 'audio_stop']
export const COMANDOS_MOVIMIENTO = ['motion_set']

/** Estado guardado por el servidor. */
export type EstadoOrden = 'pendiente' | 'enviado' | 'confirmado' | 'error'

export type OrdenModulo = {
  command_id: string
  device_id: string
  command: string
  params: Record<string, unknown>
  creado_en: string
  vence_en: string
  estado: EstadoOrden
  entregado_en: string | null
  confirmado_en: string | null
  error: string | null
}

/** Estado mostrado: el del servidor, más «enviada» y «sin-respuesta». */
export type EstadoVisibleOrden =
  | 'pendiente'
  | 'enviada'
  | 'confirmado'
  | 'error'
  | 'sin-respuesta'

/** Última confirmación real de la Pico para un módulo (vacío si no hay). */
export type EstadoModulo = {
  estado: Record<string, unknown>
  actualizado_en: string | null
}

export type LimitesAmbiente = {
  temp_min: number
  temp_max: number
  hum_min: number
  hum_max: number
}

export type FaseVoz = 'inicio' | 'fin'
