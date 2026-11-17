export const ZONA_CR = 'America/Costa_Rica'
export const TEXTO_FECHA_INVALIDA = 'Fecha inválida'

const formateadorCR = new Intl.DateTimeFormat('es-CR', {
  timeZone: ZONA_CR,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function aMilisegundos(isoUtc: string): number {
  return Date.parse(isoUtc)
}

export function formatearHoraCR(isoUtc: string): string {
  const ms = aMilisegundos(isoUtc)
  if (Number.isNaN(ms)) return TEXTO_FECHA_INVALIDA
  return formateadorCR.format(new Date(ms))
}

export function antiguedadSegundos(isoUtc: string, ahora: Date): number {
  const ms = aMilisegundos(isoUtc)
  if (Number.isNaN(ms)) return Number.NaN
  // Un reloj local atrasado no debe producir antigüedades negativas.
  return Math.max(0, Math.floor((ahora.getTime() - ms) / 1000))
}

export function describirAntiguedad(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return TEXTO_FECHA_INVALIDA
  const s = Math.floor(segundos)
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const dias = Math.floor(s / 86400)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

export function estaDesactualizado(
  isoUtc: string | null,
  ahora: Date,
  umbralSegundos: number,
): boolean {
  if (isoUtc === null) return true
  const ms = aMilisegundos(isoUtc)
  if (Number.isNaN(ms)) return true
  // Compara en milisegundos exactos; un reloj atrasado no da antigüedad negativa.
  const antiguedadMs = Math.max(0, ahora.getTime() - ms)
  return antiguedadMs > umbralSegundos * 1000
}
