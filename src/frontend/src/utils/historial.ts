// Cálculos puros del historial (fase 10): conteos por hora, series de medición,
// resumen de una noche y filas del Excel. Todo sale de los registros que
// entrega el servidor; nada se inventa ni se rellena.
import {
  COLUMNAS_EXCEL,
  esMedicion,
  type FilaExcel,
  type Intervalo,
  type RegistroHistorial,
} from '../models/historial.ts'
import { fechaYHoraCR, MS_POR_HORA } from './tiempo.ts'

const TIPOS_MOVIMIENTO: readonly string[] = ['movimiento', 'movimiento_habitacion']

const ms = (registro: RegistroHistorial): number => Date.parse(registro.ts)

/** Una hora [inicio, inicio + 1 h) en Costa Rica (las horas coinciden con las de UTC). */
export interface CuboHora {
  /** Inicio de la hora, en milisegundos UTC. */
  inicio: number
  /**
   * 'sin_datos': el bebé no tiene ningún registro en esa hora.
   * 'con_datos': hay registros; `eventos` puede ser 0 (hubo mediciones, no eventos).
   */
  estado: 'sin_datos' | 'con_datos'
  eventos: number
  porTipo: Record<string, number>
}

/**
 * Cuenta los eventos por hora. Un evento a las 08:15 y otro a las 08:59 caen en
 * [08:00, 09:00); uno a las 09:00 cae en [09:00, 10:00) (CA-26.3). Las
 * mediciones no se cuentan como eventos, pero sí prueban que hubo datos en la
 * hora, de modo que «0 eventos» y «sin datos» se distinguen (CA-26.4).
 */
export function conteoPorHora(registros: readonly RegistroHistorial[], intervalo: Intervalo): CuboHora[] {
  if (!(intervalo.hasta > intervalo.desde)) return []
  const primero = Math.floor(intervalo.desde / MS_POR_HORA) * MS_POR_HORA
  const cubos = new Map<number, CuboHora>()
  for (let inicio = primero; inicio < intervalo.hasta; inicio += MS_POR_HORA) {
    cubos.set(inicio, { inicio, estado: 'sin_datos', eventos: 0, porTipo: {} })
  }
  for (const registro of registros) {
    const t = ms(registro)
    if (Number.isNaN(t) || t < intervalo.desde || t >= intervalo.hasta) continue
    const cubo = cubos.get(Math.floor(t / MS_POR_HORA) * MS_POR_HORA)
    if (!cubo) continue
    cubo.estado = 'con_datos'
    if (!esMedicion(registro.tipo)) {
      cubo.eventos += 1
      cubo.porTipo[registro.tipo] = (cubo.porTipo[registro.tipo] ?? 0) + 1
    }
  }
  return [...cubos.values()]
}

export interface PuntoSerie {
  /** Instante en milisegundos UTC; null en un punto de corte (hueco). */
  t: number
  valor: number | null
}

export interface SerieMedicion {
  tipo: string
  unidad: string
  puntos: PuntoSerie[]
  /** Cantidad de lecturas reales (sin contar cortes ni reducción). */
  total: number
}

/** Separación a partir de la cual dos lecturas seguidas se consideran un hueco. */
export const UMBRAL_HUECO_MS = 30 * 60 * 1000

/**
 * Una serie por tipo de medición, ordenada por tiempo. Entre dos lecturas
 * separadas por más de `umbralHuecoMs` se inserta un punto nulo, para que la
 * línea se corte en vez de unir lecturas que no tienen nada en medio.
 */
export function seriesMedicion(
  registros: readonly RegistroHistorial[],
  umbralHuecoMs: number = UMBRAL_HUECO_MS,
): SerieMedicion[] {
  const porTipo = new Map<string, { unidad: string; lecturas: { t: number; valor: number }[] }>()
  for (const registro of registros) {
    if (!esMedicion(registro.tipo) || registro.valor === null) continue
    const t = ms(registro)
    if (Number.isNaN(t)) continue
    const grupo = porTipo.get(registro.tipo) ?? { unidad: registro.unidad ?? '', lecturas: [] }
    grupo.lecturas.push({ t, valor: registro.valor })
    porTipo.set(registro.tipo, grupo)
  }
  return [...porTipo.entries()].map(([tipo, { unidad, lecturas }]) => {
    lecturas.sort((a, b) => a.t - b.t)
    const puntos: PuntoSerie[] = []
    lecturas.forEach((lectura, i) => {
      if (i > 0 && lectura.t - lecturas[i - 1].t > umbralHuecoMs) {
        puntos.push({ t: lecturas[i - 1].t + 1, valor: null })
      }
      puntos.push({ t: lectura.t, valor: lectura.valor })
    })
    return { tipo, unidad, puntos, total: lecturas.length }
  })
}

/**
 * Reduce una serie para dibujarla conservando los extremos: de cada tramo deja
 * el mínimo y el máximo, así un pico no desaparece. Los puntos de corte se
 * conservan. Solo afecta al dibujo; la lista y el Excel usan todos los registros.
 */
export function reducirSerie(puntos: readonly PuntoSerie[], maximo: number): PuntoSerie[] {
  if (puntos.length <= maximo || maximo < 4) return [...puntos]
  const tramos = Math.floor(maximo / 2)
  const tamano = Math.ceil(puntos.length / tramos)
  const salida: PuntoSerie[] = []
  for (let i = 0; i < puntos.length; i += tamano) {
    const tramo = puntos.slice(i, i + tamano)
    const reales = tramo.filter((p) => p.valor !== null)
    const corte = tramo.find((p) => p.valor === null)
    if (reales.length > 0) {
      const minimo = reales.reduce((a, b) => (b.valor! < a.valor! ? b : a))
      const maximoP = reales.reduce((a, b) => (b.valor! > a.valor! ? b : a))
      salida.push(...(minimo.t <= maximoP.t ? [minimo, maximoP] : [maximoP, minimo]))
    }
    if (corte) salida.push(corte)
  }
  salida.sort((a, b) => a.t - b.t)
  return salida.filter((p, i) => i === 0 || p.t !== salida[i - 1].t)
}

export interface ResumenNoche {
  totalRegistros: number
  eventosPorTipo: { tipo: string; cantidad: number }[]
  movimientos: number
  /** Hora de mayor actividad de movimiento, o null si no hubo movimientos. */
  horaMasActiva: { inicio: number; movimientos: number } | null
  temperatura: { minimo: number; maximo: number; unidad: string } | null
  humedad: { minimo: number; maximo: number; unidad: string } | null
  tomas: { cantidad: number; gramos: number }
  fotos: number
}

function rango(registros: readonly RegistroHistorial[], tipo: string) {
  const valores = registros.filter((r) => r.tipo === tipo && r.valor !== null)
  if (valores.length === 0) return null
  const numeros = valores.map((r) => r.valor as number)
  return {
    minimo: Math.min(...numeros),
    maximo: Math.max(...numeros),
    unidad: valores[0].unidad ?? '',
  }
}

/**
 * Resume el intervalo elegido. Devuelve null si no hay ningún registro: la web
 * lo informa como «sin registros» y no muestra ceros que parezcan actividad.
 */
export function resumirNoche(
  registros: readonly RegistroHistorial[],
  intervalo: Intervalo,
): ResumenNoche | null {
  if (registros.length === 0) return null
  const cantidades = new Map<string, number>()
  for (const r of registros) {
    if (esMedicion(r.tipo)) continue
    cantidades.set(r.tipo, (cantidades.get(r.tipo) ?? 0) + 1)
  }
  const movimientos = registros.filter((r) => TIPOS_MOVIMIENTO.includes(r.tipo))
  const porHora = conteoPorHora(movimientos, intervalo)
  const masActiva = porHora.reduce<CuboHora | null>(
    (mejor, cubo) => (cubo.eventos > (mejor?.eventos ?? 0) ? cubo : mejor),
    null,
  )
  const completas = registros.filter((r) => r.tipo === 'toma_completa' && r.toma?.cantidad_g != null)
  return {
    totalRegistros: registros.length,
    eventosPorTipo: [...cantidades.entries()]
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad || a.tipo.localeCompare(b.tipo)),
    movimientos: movimientos.length,
    horaMasActiva: masActiva ? { inicio: masActiva.inicio, movimientos: masActiva.eventos } : null,
    temperatura: rango(registros, 'temperatura_ambiente'),
    humedad: rango(registros, 'humedad_ambiente'),
    tomas: {
      cantidad: completas.length,
      gramos: completas.reduce((suma, r) => suma + (r.toma?.cantidad_g ?? 0), 0),
    },
    fotos: registros.filter((r) => r.tipo === 'foto_tomada').length,
  }
}

/**
 * Una fila por registro, con las columnas de DEC-06. Los campos que no aplican
 * quedan en null (celda vacía). Nunca incluye la foto, su ruta ni enlaces.
 */
export function filasExcel(registros: readonly RegistroHistorial[]): FilaExcel[] {
  return registros.map((r) => {
    const cr = fechaYHoraCR(r.ts)
    return {
      fecha: cr?.fecha ?? null,
      hora: cr?.hora ?? null,
      evento: r.tipo,
      bebe_id: r.bebe_id,
      dispositivo_id: r.device_id,
      descripcion: r.descripcion,
      valor: r.valor,
      unidad: r.unidad,
      peso_inicial_g: r.toma?.peso_inicial_g ?? null,
      peso_final_g: r.toma?.peso_final_g ?? null,
      cantidad_g: r.toma?.cantidad_g ?? null,
      duracion_s: r.toma?.duracion_s ?? null,
    }
  })
}

export { COLUMNAS_EXCEL }
