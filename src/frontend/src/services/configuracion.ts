// Módulo lógico de ambiente (Pico, Supabase y web comparten este identificador).
export const DISPOSITIVO_AMBIENTE_POR_DEFECTO = 'cuna-ambiente-01'

export const dispositivoAmbienteId: string =
  import.meta.env.VITE_AMBIENTE_DEVICE_ID?.trim() ||
  DISPOSITIVO_AMBIENTE_POR_DEFECTO

// Módulo lógico de la lámpara (distinto del de ambiente).
export const DISPOSITIVO_LAMPARA_POR_DEFECTO = 'cuna-lampara-01'

/**
 * Los controles de la lámpara son opt-in: solo con VITE_LAMPARA_HABILITADA=true
 * (exactamente). Se lee al llamar, no al importar, para poder probarlo.
 */
export function lamparaHabilitada(): boolean {
  return import.meta.env.VITE_LAMPARA_HABILITADA?.trim() === 'true'
}

export function dispositivoLamparaId(): string {
  return (
    import.meta.env.VITE_LAMPARA_DEVICE_ID?.trim() ||
    DISPOSITIVO_LAMPARA_POR_DEFECTO
  )
}

// Módulo lógico de movimiento (sensor PIR).
export const DISPOSITIVO_MOVIMIENTO_POR_DEFECTO = 'cuna-movimiento-01'

export const dispositivoMovimientoId: string =
  import.meta.env.VITE_MOVIMIENTO_DEVICE_ID?.trim() ||
  DISPOSITIVO_MOVIMIENTO_POR_DEFECTO

/** Opt-in: solo el valor exacto "true" activa el panel; por defecto, apagado. */
export function movimientoActivado(valor: string | undefined): boolean {
  return valor?.trim().toLowerCase() === 'true'
}

export const movimientoHabilitado: boolean = movimientoActivado(
  import.meta.env.VITE_MOVIMIENTO_HABILITADO,
)

/**
 * Usuario del bot de Telegram (sin @) para armar el enlace de vinculación.
 * Solo se acepta el formato de usuarios de Telegram; si no coincide, no hay enlace.
 */
export function botTelegram(): string | null {
  const bot = import.meta.env.VITE_TELEGRAM_BOT?.trim().replace(/^@/, '') ?? ''
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(bot) ? bot : null
}

// ---- Fase 5: figuras, audio, monitoreo y voz ----
export const DISPOSITIVO_FIGURAS_POR_DEFECTO = 'cuna-figuras-01'
export const DISPOSITIVO_AUDIO_POR_DEFECTO = 'cuna-audio-01'
export const PRODUCTO_CUNA_POR_DEFECTO = 'cuna-01'
export const DISPOSITIVO_COLCHON_POR_DEFECTO = 'cuna-colchon-01'

const IDENTIFICADOR = /^[a-z0-9][a-z0-9_-]{0,63}$/

function identificador(valor: string | undefined, porDefecto: string): string {
  const limpio = valor?.trim() ?? ''
  return IDENTIFICADOR.test(limpio) ? limpio : porDefecto
}

export function dispositivoFigurasId(): string {
  return identificador(import.meta.env.VITE_FIGURAS_DEVICE_ID, DISPOSITIVO_FIGURAS_POR_DEFECTO)
}

export function dispositivoAudioId(): string {
  return identificador(import.meta.env.VITE_AUDIO_DEVICE_ID, DISPOSITIVO_AUDIO_POR_DEFECTO)
}

/** Producto de la cuna: define el canal de voz y de órdenes de la Pico. */
export function productoCunaId(): string {
  return identificador(import.meta.env.VITE_CUNA_PRODUCTO_ID, PRODUCTO_CUNA_POR_DEFECTO)
}

/**
 * Los controles que operan hardware (figuras, audio, monitoreo de movimiento)
 * son opt-in: solo con VITE_ORDENES_HABILITADAS=true (exactamente). Se lee al
 * llamar, no al importar, para poder probarlo.
 */
export function ordenesHabilitadas(): boolean {
  return import.meta.env.VITE_ORDENES_HABILITADAS?.trim() === 'true'
}

/** La voz en vivo es opt-in aparte: VITE_VOZ_HABILITADA=true (exactamente). */
export function vozHabilitada(): boolean {
  return import.meta.env.VITE_VOZ_HABILITADA?.trim() === 'true'
}

export const DISPOSITIVO_HABITACION_POR_DEFECTO = 'cuna-habitacion-01'

/** Módulo de la habitación (puerta, movimiento y fotos). Separado de la cuna. */
export function dispositivoHabitacionId(): string {
  return identificador(
    import.meta.env.VITE_HABITACION_DEVICE_ID,
    DISPOSITIVO_HABITACION_POR_DEFECTO,
  )
}

/**
 * La pantalla que usa el teléfono como cámara es opt-in:
 * VITE_CAMARA_HABILITADA=true (exactamente). Se lee al llamar, no al importar.
 */
export function camaraHabilitada(): boolean {
  return import.meta.env.VITE_CAMARA_HABILITADA?.trim() === 'true'
}

export const DISPOSITIVO_ALIMENTACION_POR_DEFECTO = 'cuna-alimentacion-01'

/** Módulo de alimentación (balanza y temperatura del biberón). Separado de la cuna. */
export function dispositivoAlimentacionId(): string {
  return identificador(
    import.meta.env.VITE_ALIMENTACION_DEVICE_ID,
    DISPOSITIVO_ALIMENTACION_POR_DEFECTO,
  )
}

/** Módulo del colchón. Es un módulo separado de la cuna. */
export function dispositivoColchonId(): string {
  return identificador(import.meta.env.VITE_COLCHON_DEVICE_ID, DISPOSITIVO_COLCHON_POR_DEFECTO)
}
