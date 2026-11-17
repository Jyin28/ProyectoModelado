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
