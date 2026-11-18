// Colchón: configuración, eventos y estado, tal como los guarda el servidor.
// Contrato: src/shared/contracts/colchon.md. Las fechas son ISO 8601 en UTC.
// El peso se mide solo en la Pico: la web nunca recibe ni muestra lecturas de peso.

export type ConfigColchon = {
  duracion_s: number
  tolerancia_pct: number
  alarma_s: number
}

export const COLCHON_DURACION_MAX_S = 86400
export const COLCHON_ALARMA_MAX_S = 60

export type MotivoParada = 'app' | 'boton' | 'temporizador' | 'duracion' | 'wifi'

export const TEXTO_MOTIVO: Record<MotivoParada, string> = {
  app: 'desde la app',
  boton: 'con el botón',
  temporizador: 'al terminar el tiempo de la alarma',
  duracion: 'al terminar la duración',
  wifi: 'por pérdida de WiFi',
}

export const TIPOS_EVENTO_COLCHON = [
  'colchon_armado',
  'alarma_colchon',
  'colchon_detenido',
] as const
export type TipoEventoColchon = (typeof TIPOS_EVENTO_COLCHON)[number]

export type EventoColchon = {
  event_id: string
  tipo: TipoEventoColchon
  descripcion: string
  ts: string
}

export type SituacionColchon = 'activo' | 'alarma' | 'detenido'

/** Lo último que la Pico informó (a partir de estado_de_modulo). */
export type EstadoColchon = {
  situacion: SituacionColchon
  /** Solo en «activo» y «alarma»: la referencia que midió la Pico. */
  referencia_g: number | null
  motivo: MotivoParada | null
  /** Hora UTC del evento que fijó este estado. */
  desde: string
}
