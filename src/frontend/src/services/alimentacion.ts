import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CAMPOS_CORRECCION,
  ESTADOS_TOMA,
  MOTIVOS_ERROR_PESO,
  type CampoCorreccion,
  type CorreccionToma,
  type EstadoToma,
  type LimitesBiberon,
  type ListaTomas,
  type MotivoErrorPeso,
  type PausaToma,
  type Toma,
} from '../models/alimentacion.ts'
import { MENSAJE_CUENTAS } from './cuentas.ts'
import { llamar } from './ordenes.ts'
import type { Resultado, ServicioAlimentacion } from './tipos.ts'

export type ClienteAlimentacion = Pick<SupabaseClient, 'from' | 'rpc'>

export const MENSAJE_TOMAS = 'No se pudieron consultar las tomas.'
export const MENSAJE_TEMPERATURA_BIBERON = 'No se pudo consultar la temperatura del biberón.'

const FUNCION_ACCION = {
  iniciar: 'iniciar_toma',
  pausar: 'pausar_toma',
  reanudar: 'reanudar_toma',
  finalizar: 'finalizar_toma',
  cerrar: 'cerrar_toma',
  cancelar: 'cancelar_toma',
} as const

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numeroONulo = (v: unknown): number | null | undefined =>
  v === null ? null : esNumero(v) ? v : undefined
const textoONulo = (v: unknown): string | null | undefined =>
  v === null ? null : esTexto(v) ? v : undefined

function aPausa(v: unknown): PausaToma | null {
  if (!esObjeto(v)) return null
  const fin = textoONulo(v.fin)
  if (!esTexto(v.inicio) || fin === undefined) return null
  return { inicio: v.inicio, fin }
}

function aCorreccion(v: unknown): CorreccionToma | null {
  if (!esObjeto(v)) return null
  const anterior = numeroONulo(v.valor_anterior)
  if (
    !CAMPOS_CORRECCION.includes(v.campo as CampoCorreccion) ||
    anterior === undefined ||
    !esNumero(v.valor_nuevo) ||
    !esTexto(v.motivo) ||
    !esTexto(v.creada_en) ||
    typeof v.propia !== 'boolean'
  ) {
    return null
  }
  return {
    campo: v.campo as CampoCorreccion,
    valor_anterior: anterior,
    valor_nuevo: v.valor_nuevo,
    motivo: v.motivo,
    creada_en: v.creada_en,
    propia: v.propia,
  }
}

function lista<T>(v: unknown, convertir: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null
  const salida = v.map(convertir)
  return salida.some((x) => x === null) ? null : (salida as T[])
}

export function aToma(v: unknown): Toma | null {
  if (!esObjeto(v)) return null
  const inicial = numeroONulo(v.peso_inicial_g)
  const final = numeroONulo(v.peso_final_g)
  const ingerido = numeroONulo(v.ingerido_g)
  const duracion = numeroONulo(v.duracion_activa_s)
  const inicio = textoONulo(v.inicio)
  const fin = textoONulo(v.fin)
  const error = v.peso_error === null ? null : v.peso_error
  const pausas = lista(v.pausas, aPausa)
  const correcciones = lista(v.correcciones, aCorreccion)
  if (
    !esTexto(v.id) ||
    !esTexto(v.device_id) ||
    !esTexto(v.bebe_id) ||
    !ESTADOS_TOMA.includes(v.estado as EstadoToma) ||
    inicial === undefined ||
    final === undefined ||
    ingerido === undefined ||
    duracion === undefined ||
    inicio === undefined ||
    fin === undefined ||
    !(error === null || MOTIVOS_ERROR_PESO.includes(error as MotivoErrorPeso)) ||
    !esTexto(v.creada_en) ||
    pausas === null ||
    correcciones === null
  ) {
    return null
  }
  // Una toma completa sin gramos ingeridos no se presenta como completa.
  if ((v.estado === 'completa') !== (ingerido !== null)) return null
  return {
    id: v.id,
    device_id: v.device_id,
    bebe_id: v.bebe_id,
    estado: v.estado as EstadoToma,
    peso_inicial_g: inicial,
    peso_final_g: final,
    ingerido_g: ingerido,
    peso_error: error as MotivoErrorPeso | null,
    creada_en: v.creada_en,
    inicio,
    fin,
    duracion_activa_s: duracion,
    pausas,
    correcciones,
  }
}

function aListaTomas(v: unknown): ListaTomas | null {
  if (!esObjeto(v) || !esTexto(v.ahora)) return null
  const tomas = lista(v.tomas, aToma)
  return tomas === null ? null : { ahora: v.ahora, tomas }
}

function aLimites(v: unknown): LimitesBiberon | null {
  if (!esObjeto(v) || !esNumero(v.temp_min) || !esNumero(v.temp_max)) return null
  return { temp_min: v.temp_min, temp_max: v.temp_max }
}

function comoToma(r: Resultado<unknown>): Resultado<Toma> {
  if (!r.ok) return r
  const toma = aToma(r.datos)
  return toma ? { ok: true, datos: toma } : { ok: false, error: MENSAJE_CUENTAS }
}

/**
 * Alimentación real: la web conduce la toma con funciones del servidor y la
 * Pico pesa cuando se lo piden (el peso llega como evento, nunca por la web).
 * Nada de lo que se muestra se calcula aquí salvo el reloj de la toma en curso,
 * que parte de la hora del servidor.
 */
export function crearServicioAlimentacion(cliente: ClienteAlimentacion): ServicioAlimentacion {
  return {
    async listarTomas(dispositivoId, limite) {
      const r = await llamar(cliente, 'mis_tomas', { p_device_id: dispositivoId, p_limite: limite })
      if (!r.ok) return { ok: false, error: MENSAJE_TOMAS }
      const tomas = aListaTomas(r.datos)
      return tomas ? { ok: true, datos: tomas } : { ok: false, error: MENSAJE_TOMAS }
    },

    async crearToma(dispositivoId, tomaId) {
      return comoToma(await llamar(cliente, 'crear_toma', { p_toma_id: tomaId, p_device_id: dispositivoId }))
    },

    async cambiarEstado(tomaId, accion) {
      return comoToma(await llamar(cliente, FUNCION_ACCION[accion], { p_toma_id: tomaId }))
    },

    async pedirPeso(tomaId, momento, commandId) {
      const r = await llamar(cliente, 'pedir_peso_toma', {
        p_toma_id: tomaId,
        p_momento: momento,
        p_command_id: commandId,
      })
      return r.ok ? { ok: true, datos: null } : r
    },

    async corregir(tomaId, campo, valor, motivo) {
      return comoToma(
        await llamar(cliente, 'corregir_toma', {
          p_toma_id: tomaId,
          p_campo: campo,
          p_valor: valor,
          p_motivo: motivo,
        }),
      )
    },

    async obtenerLimites(dispositivoId) {
      const r = await llamar(cliente, 'mis_limites_biberon', { p_device_id: dispositivoId })
      if (!r.ok) return r
      if (r.datos === null || r.datos === undefined) return { ok: true, datos: null }
      const limites = aLimites(r.datos)
      return limites ? { ok: true, datos: limites } : { ok: false, error: MENSAJE_CUENTAS }
    },

    async guardarLimites(dispositivoId, limites) {
      const r = await llamar(cliente, 'guardar_limites_biberon', {
        p_device_id: dispositivoId,
        p_temp_min: limites.temp_min,
        p_temp_max: limites.temp_max,
      })
      if (!r.ok) return r
      const guardados = aLimites(r.datos)
      return guardados ? { ok: true, datos: guardados } : { ok: false, error: MENSAJE_CUENTAS }
    },

    async ultimaTemperatura(dispositivoId) {
      const fallo = (): Resultado<null> => ({ ok: false, error: MENSAJE_TEMPERATURA_BIBERON })
      try {
        const { data, error } = await cliente
          .from('eventos')
          .select('valor,ts')
          .eq('device_id', dispositivoId)
          .eq('tipo', 'temperatura_biberon')
          .order('ts', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return fallo()
        if (data === null || data === undefined) return { ok: true, datos: null }
        if (!esObjeto(data) || !esNumero(data.valor) || !esTexto(data.ts)) return fallo()
        return { ok: true, datos: { valor: data.valor, ts: data.ts } }
      } catch {
        return fallo()
      }
    },
  }
}
