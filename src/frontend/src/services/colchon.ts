import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TIPOS_EVENTO_COLCHON,
  type ConfigColchon,
  type EventoColchon,
  type TipoEventoColchon,
} from '../models/colchon.ts'
import { MENSAJE_CUENTAS } from './cuentas.ts'
import { llamar } from './ordenes.ts'
import type { Resultado, ServicioColchon } from './tipos.ts'

export type ClienteColchon = Pick<SupabaseClient, 'from' | 'rpc'>

export const MENSAJE_EVENTOS_COLCHON = 'No se pudieron consultar los eventos del colchón.'

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function aConfig(v: unknown): ConfigColchon | null {
  if (!esObjeto(v)) return null
  const { duracion_s, tolerancia_pct, alarma_s } = v
  if (
    typeof duracion_s !== 'number' ||
    typeof tolerancia_pct !== 'number' ||
    typeof alarma_s !== 'number'
  ) {
    return null
  }
  return { duracion_s, tolerancia_pct, alarma_s }
}

function aEvento(fila: unknown): EventoColchon | null {
  if (!esObjeto(fila)) return null
  const { event_id, tipo, descripcion, ts } = fila
  if (
    typeof event_id !== 'string' ||
    typeof descripcion !== 'string' ||
    typeof ts !== 'string' ||
    !TIPOS_EVENTO_COLCHON.includes(tipo as TipoEventoColchon)
  ) {
    return null
  }
  return { event_id, tipo: tipo as TipoEventoColchon, descripcion, ts }
}

/**
 * Colchón real: la configuración se guarda con RPC y los eventos se leen de
 * `eventos` con la sesión del usuario (RLS limita las filas). El peso nunca
 * pasa por aquí: se mide solo en la Pico.
 */
export function crearServicioColchon(cliente: ClienteColchon): ServicioColchon {
  return {
    async obtenerConfig(dispositivoId) {
      const r = await llamar(cliente, 'mi_config_colchon', { p_device_id: dispositivoId })
      if (!r.ok) return r
      if (r.datos === null || r.datos === undefined) return { ok: true, datos: null }
      const config = aConfig(r.datos)
      return config ? { ok: true, datos: config } : { ok: false, error: MENSAJE_CUENTAS }
    },

    async guardarConfig(dispositivoId, config) {
      const r = await llamar(cliente, 'guardar_config_colchon', {
        p_device_id: dispositivoId,
        p_duracion_s: config.duracion_s,
        p_tolerancia_pct: config.tolerancia_pct,
        p_alarma_s: config.alarma_s,
      })
      if (!r.ok) return r
      const guardada = aConfig(r.datos)
      return guardada ? { ok: true, datos: guardada } : { ok: false, error: MENSAJE_CUENTAS }
    },

    async listarEventos(dispositivoId, limite) {
      const fallo = (): Resultado<EventoColchon[]> => ({
        ok: false,
        error: MENSAJE_EVENTOS_COLCHON,
      })
      try {
        const { data, error } = await cliente
          .from('eventos')
          .select('event_id,tipo,descripcion,ts')
          .eq('device_id', dispositivoId)
          .in('tipo', [...TIPOS_EVENTO_COLCHON])
          .order('ts', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(limite)
        if (error || !Array.isArray(data)) return fallo()
        const eventos = data.map(aEvento)
        if (eventos.some((e) => e === null)) return fallo()
        return { ok: true, datos: eventos as EventoColchon[] }
      } catch {
        return fallo()
      }
    },
  }
}
