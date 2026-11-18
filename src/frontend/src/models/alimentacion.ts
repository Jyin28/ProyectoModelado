// Alimentación: tomas, pausas, correcciones y temperatura del biberón, tal como
// las entrega el servidor. Contrato: src/shared/contracts/alimentacion.md.
// Las fechas son ISO 8601 en UTC. El dispositivo no calienta, no enfría ni
// suministra alimento: solo pesa y mide la temperatura.

export const MOMENTOS_PESO = ['inicial', 'control', 'final'] as const
export type MomentoPeso = (typeof MOMENTOS_PESO)[number]

export const ESTADOS_TOMA = [
  'preparando',
  'en_curso',
  'pausada',
  'por_cerrar',
  'completa',
  'cancelada',
] as const
export type EstadoToma = (typeof ESTADOS_TOMA)[number]

/** Estados en los que la toma sigue abierta (solo hay una por módulo). */
export const ESTADOS_ABIERTOS: readonly EstadoToma[] = [
  'preparando',
  'en_curso',
  'pausada',
  'por_cerrar',
]

export const NOMBRE_ESTADO_TOMA: Record<EstadoToma, string> = {
  preparando: 'Preparando',
  en_curso: 'En curso',
  pausada: 'Pausada',
  por_cerrar: 'Por cerrar',
  completa: 'Completa',
  cancelada: 'Cancelada',
}

export const CAMPOS_CORRECCION = ['peso_inicial_g', 'peso_final_g'] as const
export type CampoCorreccion = (typeof CAMPOS_CORRECCION)[number]

export const NOMBRE_CAMPO: Record<CampoCorreccion, string> = {
  peso_inicial_g: 'Peso inicial',
  peso_final_g: 'Peso final',
}

export type MotivoErrorPeso = 'sin_lectura' | 'sin_calibracion'
export const MOTIVOS_ERROR_PESO: readonly MotivoErrorPeso[] = ['sin_lectura', 'sin_calibracion']

export const TEXTO_ERROR_PESO: Record<MotivoErrorPeso, string> = {
  sin_lectura: 'la balanza no dio una lectura válida (¿está el recipiente puesto?)',
  sin_calibracion: 'la balanza no está calibrada',
}

export type PausaToma = { inicio: string; fin: string | null }

export type CorreccionToma = {
  campo: CampoCorreccion
  valor_anterior: number | null
  valor_nuevo: number
  motivo: string
  creada_en: string
  /** true si la hizo la persona que consulta; nunca se expone quién fue otra. */
  propia: boolean
}

export type Toma = {
  id: string
  device_id: string
  bebe_id: string
  estado: EstadoToma
  peso_inicial_g: number | null
  peso_final_g: number | null
  ingerido_g: number | null
  /** Último fallo de pesaje sin resolver. */
  peso_error: MotivoErrorPeso | null
  creada_en: string
  inicio: string | null
  fin: string | null
  /** Segundos activos (sin pausas) a la hora del servidor `ahora`. */
  duracion_activa_s: number | null
  pausas: PausaToma[]
  correcciones: CorreccionToma[]
}

export type ListaTomas = {
  /** Hora del servidor con la que se calculó la duración activa. */
  ahora: string
  tomas: Toma[]
}

export const ACCIONES_TOMA = [
  'iniciar',
  'pausar',
  'reanudar',
  'finalizar',
  'cerrar',
  'cancelar',
] as const
export type AccionToma = (typeof ACCIONES_TOMA)[number]

export type LimitesBiberon = { temp_min: number; temp_max: number }

export type LecturaTemperatura = { valor: number; ts: string }

export const PESO_MAX_G = 5000
export const MOTIVO_CORRECCION_MAX = 200
export const TEMP_BIBERON_MIN_C = -10
export const TEMP_BIBERON_MAX_C = 100
/** A los 2 minutos sin una lectura nueva la temperatura se marca como desactualizada. */
export const TEMP_BIBERON_UMBRAL_S = 120
