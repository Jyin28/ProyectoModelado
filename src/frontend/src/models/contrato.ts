// PROVISIONAL: pendiente de acuerdo con Persona B y C
//
// Tipos que la web espera recibir y enviar. Los nombres de los comandos y de
// las confirmaciones (command_id, command, params, ok, result, error) son los
// que ya usa el firmware en src/firmware/common/utilities/comandos.py.
// Las fechas son cadenas ISO 8601 en UTC.

// ---- Lecturas ----

export type LecturaAmbiental = {
  id: string
  dispositivo_id: string
  temperatura_c: number // °C
  humedad_pct: number // % HR, 0–100
  registrado_en: string // ISO UTC
}

export type EventoMovimiento = {
  id: string
  dispositivo_id: string
  registrado_en: string // ISO UTC
}

export type LecturaPeso = {
  id: string
  dispositivo_id: string
  peso_g: number // gramos
  registrado_en: string // ISO UTC
}

// ---- Comandos ----

export type Modulo = 'cuna' | 'colchon' | 'figuras'

// Límites provisionales (espejo de config.py del firmware).
export const NIVEL_LAMPARA_MIN = 0
export const NIVEL_LAMPARA_MAX = 100
export const CANTIDAD_LEDS = 6
export const INTERVALO_SECUENCIA_MIN_S = 2

export type ParamsLampSet = { level: number } // 0–100
export type ParamsLedSet = { index: number; on: boolean } // index entero 0–5
export type ParamsLedAll = { on: boolean }
export type ParamsLedSequence = { name: string; step_s: number } // step_s >= 2
export type ParamsVacios = Record<string, never>

// Unión discriminada por "command".
// Comandos del colchón y del audio: pendiente de definir con B y C.
export type OrdenComando =
  | { command: 'lamp_set'; params: ParamsLampSet }
  | { command: 'led_set'; params: ParamsLedSet }
  | { command: 'led_all'; params: ParamsLedAll }
  | { command: 'led_sequence'; params: ParamsLedSequence }
  | { command: 'led_stop'; params: ParamsVacios }
  | { command: 'get_status'; params: ParamsVacios }

export type NombreComando = OrdenComando['command']

export type Comando = OrdenComando & {
  command_id: string // uuid
  modulo: Modulo
  creado_en: string // ISO UTC
}

export type Confirmacion = {
  command_id: string
  command: NombreComando
  ok: boolean
  result?: Record<string, unknown>
  error?: string
  confirmado_en: string // ISO UTC
}

export type EstadoComando =
  | 'pendiente'
  | 'confirmado'
  | 'error'
  | 'sin-respuesta'
