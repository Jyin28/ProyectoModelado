// Historial unificado por bebé (fase 10, HU-24 a HU-27). Forma de la respuesta
// de la función public.historial_bebe; ver src/shared/contracts/historial.md.

/** Datos de la toma a la que pertenece un registro (solo eventos de alimentación). */
export interface DatosTomaRegistro {
  peso_inicial_g: number | null
  peso_final_g: number | null
  cantidad_g: number | null
  duracion_s: number | null
}

/** Foto ligada al evento. Solo la reciben las personas dueñas del módulo. */
export interface FotoRegistro {
  estado: 'pendiente' | 'guardada' | 'fallida'
  ruta: string | null
  motivo: string | null
}

export interface RegistroHistorial {
  registro_id: string
  /** Instante en UTC (ISO 8601). Se muestra siempre en America/Costa_Rica. */
  ts: string
  tipo: string
  bebe_id: string
  device_id: string
  descripcion: string | null
  valor: number | null
  unidad: string | null
  toma: DatosTomaRegistro | null
  foto: FotoRegistro | null
}

export interface RespuestaHistorial {
  ahora: string
  desde: string
  hasta: string
  /** true si el servidor devolvió solo parte de los registros por el tope de 20000. */
  truncado: boolean
  registros: RegistroHistorial[]
}

/** Intervalo [desde, hasta) en milisegundos UTC. */
export interface Intervalo {
  desde: number
  hasta: number
}

export const TIPOS_MEDICION: readonly string[] = [
  'temperatura_ambiente',
  'humedad_ambiente',
  'temperatura_biberon',
  'peso_alimentacion',
]

export const NOMBRE_TIPO_EVENTO: Readonly<Record<string, string>> = {
  temperatura_ambiente: 'Temperatura ambiente',
  humedad_ambiente: 'Humedad ambiente',
  temperatura_biberon: 'Temperatura del biberón',
  peso_alimentacion: 'Peso del biberón',
  peso_alimentacion_fallido: 'Pesaje fallido',
  movimiento: 'Movimiento en la cuna',
  movimiento_habitacion: 'Movimiento en la habitación',
  puerta: 'Puerta',
  foto_tomada: 'Foto de la habitación',
  toma_iniciada: 'Toma iniciada',
  toma_completa: 'Toma completa',
  biberon_fuera_rango: 'Biberón fuera de rango',
  alarma_colchon: 'Alarma del colchón',
  parada_colchon: 'Colchón detenido',
  voz_inicio: 'Voz iniciada',
  voz_fin: 'Voz finalizada',
}

/** Eventos que se cuentan por hora en el histograma (todo lo que no es una medición). */
export const esMedicion = (tipo: string): boolean => TIPOS_MEDICION.includes(tipo)

export function nombreTipo(tipo: string): string {
  return NOMBRE_TIPO_EVENTO[tipo] ?? tipo.replaceAll('_', ' ')
}

/**
 * Columnas del .xlsx, en el orden y con los nombres de DEC-06. Las cuatro
 * últimas solo aplican a las tomas; en el resto de filas quedan vacías.
 */
export const COLUMNAS_EXCEL = [
  'fecha',
  'hora',
  'evento',
  'bebe_id',
  'dispositivo_id',
  'descripcion',
  'valor',
  'unidad',
  'peso_inicial_g',
  'peso_final_g',
  'cantidad_g',
  'duracion_s',
] as const
export type ColumnaExcel = (typeof COLUMNAS_EXCEL)[number]
export type FilaExcel = Record<ColumnaExcel, string | number | null>
