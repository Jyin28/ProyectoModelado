// Fechas civiles AAAA-MM-DD para el calendario. Todo se calcula en UTC para que
// la zona del equipo no corra el día; la conversión a Costa Rica se hace en tiempo.ts.

const formateadorMes = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

export const DIAS_SEMANA = [
  { corto: 'L', largo: 'lunes' },
  { corto: 'M', largo: 'martes' },
  { corto: 'M', largo: 'miércoles' },
  { corto: 'J', largo: 'jueves' },
  { corto: 'V', largo: 'viernes' },
  { corto: 'S', largo: 'sábado' },
  { corto: 'D', largo: 'domingo' },
]

export type MesCalendario = { anio: number; mes: number }

export function mesDeFecha(fecha: string): MesCalendario | null {
  const p = /^(\d{4})-(\d{2})-\d{2}$/.exec(fecha)
  if (!p) return null
  const mes = Number(p[2]) - 1
  return mes >= 0 && mes <= 11 ? { anio: Number(p[1]), mes } : null
}

export function sumarMeses({ anio, mes }: MesCalendario, delta: number): MesCalendario {
  const total = anio * 12 + mes + delta
  return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 }
}

/** «Noviembre de 2026». */
export function nombreMes({ anio, mes }: MesCalendario): string {
  const texto = formateadorMes.format(new Date(Date.UTC(anio, mes, 1)))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function fechaIso(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, '0')}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Celdas del mes con la semana empezando en lunes: null para los huecos iniciales. */
export function celdasDelMes({ anio, mes }: MesCalendario): Array<string | null> {
  const primero = new Date(Date.UTC(anio, mes, 1)).getUTCDay() // 0 = domingo
  const huecos = (primero + 6) % 7
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  return [
    ...Array.from({ length: huecos }, () => null),
    ...Array.from({ length: dias }, (_, i) => fechaIso(anio, mes, i + 1)),
  ]
}

/** «12 h 30 min» para una duración en milisegundos. */
export function describirDuracion(ms: number): string {
  const minutos = Math.round(ms / 60000)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
