// Modelo de datos para el colchón inteligente y sus eventos en Supabase.
// Basado en HU-14, HU-15, HU-16 y los eventos emitidos por el firmware de la Pico.

export type TipoEventoColchonPico =
  | 'monitoring_started'
  | 'alarm_started'
  | 'alarm_stopped'
  | 'monitoring_stopped'

export type DatosMonitoringStarted = {
  reference_g?: number
  tolerance_pct?: number
  duration_s?: number
  alarm_s?: number
}

export type DatosAlarmStarted = {
  weight_g?: number
  reference_g?: number
  threshold_g?: number
}

export type DatosAlarmStopped = {
  reason?: string
}

export type DatosMonitoringStopped = {
  reason?: string
}

export type DatosEventoColchonPico =
  | DatosMonitoringStarted
  | DatosAlarmStarted
  | DatosAlarmStopped
  | DatosMonitoringStopped
  | Record<string, unknown>

export type EventoColchonPico = {
  event_id: string
  device_id: string
  bebe_id: string
  ts: string // ISO UTC
  recibido_en: string // ISO UTC
  tipo: TipoEventoColchonPico
  datos: DatosEventoColchonPico
}

/** Estado operacional deducido del colchón */
export type EstadoColchonPico = 'detenido' | 'monitoreando' | 'alarma'

export type EstadoOrdenColchonPico =
  | 'pendiente'
  | 'enviado'
  | 'confirmado'
  | 'error'

export type OrdenColchonPico = {
  command_id: string
  device_id: string
  command: string
  params: Record<string, unknown>
  estado: EstadoOrdenColchonPico
  creado_en: string
  confirmado_en?: string | null
  error?: string | null
}
