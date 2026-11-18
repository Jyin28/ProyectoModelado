import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DatosTomaRegistro,
  FotoRegistro,
  RegistroHistorial,
  RespuestaHistorial,
} from '../models/historial.ts'
import { llamar } from './ordenes.ts'
import type { ServicioHistorial } from './tipos.ts'

export type ClienteHistorial = Pick<SupabaseClient, 'rpc'>

// Mensajes fijos: nunca se muestra el texto de error del servidor.
export const MENSAJE_HISTORIAL = 'No se pudo consultar el historial.'

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numeroONulo = (v: unknown): number | null | undefined =>
  v === null ? null : esNumero(v) ? v : undefined
const textoONulo = (v: unknown): string | null | undefined =>
  v === null ? null : esTexto(v) ? v : undefined

function aToma(v: unknown): DatosTomaRegistro | null | undefined {
  if (v === null) return null
  if (!esObjeto(v)) return undefined
  const inicial = numeroONulo(v.peso_inicial_g)
  const final = numeroONulo(v.peso_final_g)
  const cantidad = numeroONulo(v.cantidad_g)
  const duracion = numeroONulo(v.duracion_s)
  if (inicial === undefined || final === undefined || cantidad === undefined || duracion === undefined) {
    return undefined
  }
  return { peso_inicial_g: inicial, peso_final_g: final, cantidad_g: cantidad, duracion_s: duracion }
}

const ESTADOS_FOTO: readonly string[] = ['pendiente', 'guardada', 'fallida']

function aFoto(v: unknown): FotoRegistro | null | undefined {
  if (v === null) return null
  if (!esObjeto(v)) return undefined
  const ruta = textoONulo(v.ruta)
  const motivo = textoONulo(v.motivo)
  if (!ESTADOS_FOTO.includes(v.estado as string) || ruta === undefined || motivo === undefined) {
    return undefined
  }
  return { estado: v.estado as FotoRegistro['estado'], ruta, motivo }
}

export function aRegistro(v: unknown): RegistroHistorial | null {
  if (!esObjeto(v)) return null
  const descripcion = textoONulo(v.descripcion)
  const valor = numeroONulo(v.valor)
  const unidad = textoONulo(v.unidad)
  const toma = aToma(v.toma)
  const foto = aFoto(v.foto)
  if (
    !esTexto(v.registro_id) ||
    !esTexto(v.ts) ||
    Number.isNaN(Date.parse(v.ts)) ||
    !esTexto(v.tipo) ||
    !esTexto(v.bebe_id) ||
    !esTexto(v.device_id) ||
    descripcion === undefined ||
    valor === undefined ||
    unidad === undefined ||
    toma === undefined ||
    foto === undefined
  ) {
    return null
  }
  return {
    registro_id: v.registro_id,
    ts: v.ts,
    tipo: v.tipo,
    bebe_id: v.bebe_id,
    device_id: v.device_id,
    descripcion,
    valor,
    unidad,
    toma,
    foto,
  }
}

export function aRespuesta(v: unknown): RespuestaHistorial | null {
  if (!esObjeto(v) || !esTexto(v.ahora) || !esTexto(v.desde) || !esTexto(v.hasta)) return null
  if (typeof v.truncado !== 'boolean' || !Array.isArray(v.registros)) return null
  const registros = v.registros.map(aRegistro)
  // Si un solo registro no tiene la forma esperada, no se muestra ninguno:
  // un historial parcial parecería completo.
  if (registros.some((r) => r === null)) return null
  return {
    ahora: v.ahora,
    desde: v.desde,
    hasta: v.hasta,
    truncado: v.truncado,
    registros: registros as RegistroHistorial[],
  }
}

/** Historial real: una sola consulta al servidor por bebé e intervalo. */
export function crearServicioHistorial(cliente: ClienteHistorial): ServicioHistorial {
  return {
    async consultar(bebeId, desde, hasta) {
      const r = await llamar(cliente, 'historial_bebe', {
        p_bebe_id: bebeId,
        p_desde: new Date(desde).toISOString(),
        p_hasta: new Date(hasta).toISOString(),
      })
      // `llamar` ya traduce los errores del servidor a mensajes fijos.
      if (!r.ok) return r
      const respuesta = aRespuesta(r.datos)
      return respuesta ? { ok: true, datos: respuesta } : { ok: false, error: MENSAJE_HISTORIAL }
    },
  }
}
