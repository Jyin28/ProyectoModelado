// Módulo lógico de ambiente (Pico, Supabase y web comparten este identificador).
export const DISPOSITIVO_AMBIENTE_POR_DEFECTO = 'cuna-ambiente-01'

export const dispositivoAmbienteId: string =
  import.meta.env.VITE_AMBIENTE_DEVICE_ID?.trim() ||
  DISPOSITIVO_AMBIENTE_POR_DEFECTO
