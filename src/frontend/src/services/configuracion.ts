// Módulo lógico de ambiente (Pico, Supabase y web comparten este identificador).
export const DISPOSITIVO_AMBIENTE_POR_DEFECTO = 'cuna-ambiente-01'

export const dispositivoAmbienteId: string =
  import.meta.env.VITE_AMBIENTE_DEVICE_ID?.trim() ||
  DISPOSITIVO_AMBIENTE_POR_DEFECTO

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
