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

const formateadorFechaCivil = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Fecha civil AAAA-MM-DD (por ejemplo, una fecha de nacimiento). No es un
 * instante: no se convierte de zona horaria para no correr el día.
 */
export function formatearFechaCivil(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!partes) return TEXTO_FECHA_INVALIDA
  const ms = Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
  const fechaUtc = new Date(ms)
  // Rechaza fechas inexistentes como 2026-02-31.
  if (fechaUtc.toISOString().slice(0, 10) !== fecha) return TEXTO_FECHA_INVALIDA
  return formateadorFechaCivil.format(fechaUtc)
}

// ------------------------------------------------------ fechas y horas de CR
// Costa Rica no usa horario de verano: su desfase con UTC es siempre -06:00.
const DESFASE_CR_MS = 6 * 3600 * 1000
const MS_HORA = 3600 * 1000
const MS_DIA = 24 * MS_HORA

const PARTES_CR = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Fecha AAAA-MM-DD y hora HH:MM:SS en Costa Rica de un instante UTC, o null si es inválido. */
export function fechaYHoraCR(isoUtc: string): { fecha: string; hora: string } | null {
  const ms = Date.parse(isoUtc)
  if (Number.isNaN(ms)) return null
  const p = Object.fromEntries(PARTES_CR.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}` }
}

/** Convierte una fecha AAAA-MM-DD y una hora HH:MM de Costa Rica en milisegundos UTC. */
export function crAUtc(fecha: string, hora: string): number | null {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  const h = /^(\d{2}):(\d{2})$/.exec(hora)
  if (!f || !h) return null
  const ms = Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3]), Number(h[1]), Number(h[2]))
  if (Number.isNaN(ms)) return null
  const control = new Date(ms)
  if (
    control.toISOString().slice(0, 10) !== fecha ||
    Number(h[1]) > 23 ||
    Number(h[2]) > 59
  ) {
    return null
  }
  return ms + DESFASE_CR_MS
}

/**
 * Intervalo de una noche: empieza en la fecha y hora de inicio y termina en la
 * próxima vez que el reloj marque la hora de fin. Si el fin es menor o igual
 * que el inicio, cruza la medianoche y termina al día siguiente.
 */
export function intervaloNoche(
  fecha: string,
  horaInicio: string,
  horaFin: string,
): { desde: number; hasta: number } | null {
  const desde = crAUtc(fecha, horaInicio)
  const finMismoDia = crAUtc(fecha, horaFin)
  if (desde === null || finMismoDia === null) return null
  const hasta = finMismoDia > desde ? finMismoDia : finMismoDia + MS_DIA
  return { desde, hasta }
}

/** Texto corto «18 nov, 13:05» de un instante UTC, en hora de Costa Rica. */
export function formatearCortoCR(ms: number): string {
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: ZONA_CR,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms))
}

export const MS_POR_HORA = MS_HORA
export const MS_POR_DIA = MS_DIA
