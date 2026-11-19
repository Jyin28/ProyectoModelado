/** Nombres de los archivos de public/iconos (docs/prompts/gemini-recursos-interfaz.md). */
export const NOMBRES_ICONO = [
  'productos',
  'historial',
  'usuario',
  'lampara',
  'audio',
  'voz',
  'movimiento',
  'ambiente',
  'peso',
  'figuras',
  'temperatura',
  'alarma',
  'horario',
  'calendario',
  'toma',
] as const

export type NombreIcono = (typeof NOMBRES_ICONO)[number]

export function urlIcono(nombre: NombreIcono): string {
  return `${import.meta.env.BASE_URL}iconos/${nombre}.svg`
}
