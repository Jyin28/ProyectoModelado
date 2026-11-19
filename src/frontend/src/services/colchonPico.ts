import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DatosEventoColchonPico,
  EventoColchonPico,
  TipoEventoColchonPico,
} from '../models/colchonPico.ts'
import { serviciosNoConfigurados } from './noConfigurado.ts'
import type { Manejadores, Resultado, ServicioColchonPico } from './tipos.ts'

export type ClienteColchonPico = Pick<SupabaseClient, 'from'> &
  Partial<Pick<SupabaseClient, 'rpc' | 'channel'>>

export const TABLA_EVENTOS_COLCHON = 'eventos_colchon'
export const TABLA_ORDENES_COLCHON = 'ordenes_colchon'
export const RPC_SOLICITAR_COMANDO_COLCHON = 'solicitar_comando_colchon'

export const COLUMNAS_EVENTOS_COLCHON =
  'event_id,device_id,bebe_id,ts,recibido_en,tipo,datos'

export const MENSAJE_ERROR_COLCHON_PICO = 'No se pudo consultar la información del colchón.'
export const MENSAJE_ERROR_ORDEN_COLCHON_PICO = 'No se pudo registrar la orden para el colchón.'

function fallo<T>(error = MENSAJE_ERROR_COLCHON_PICO): Resultado<T> {
  return { ok: false, error }
}

const TIPOS_VALIDOS: readonly TipoEventoColchonPico[] = [
  'monitoring_started',
  'alarm_started',
  'alarm_stopped',
  'monitoring_stopped',
]

function extraerDatos(valor: unknown): DatosEventoColchonPico {
  if (typeof valor === 'string') {
    try {
      const parseado = JSON.parse(valor)
      if (typeof parseado === 'object' && parseado !== null) {
        return parseado as DatosEventoColchonPico
      }
    } catch {
      return {}
    }
  }
  if (typeof valor === 'object' && valor !== null) {
    return valor as DatosEventoColchonPico
  }
  return {}
}

export function aEventoColchonPico(fila: unknown): EventoColchonPico | null {
  if (typeof fila !== 'object' || fila === null) return null
  const f = fila as Record<string, unknown>
  if (
    typeof f.event_id !== 'string' ||
    typeof f.device_id !== 'string' ||
    typeof f.ts !== 'string' ||
    typeof f.tipo !== 'string' ||
    !TIPOS_VALIDOS.includes(f.tipo as TipoEventoColchonPico)
  ) {
    return null
  }

  return {
    event_id: f.event_id,
    device_id: f.device_id,
    bebe_id: typeof f.bebe_id === 'string' ? f.bebe_id : '',
    ts: f.ts,
    recibido_en: typeof f.recibido_en === 'string' ? f.recibido_en : f.ts,
    tipo: f.tipo as TipoEventoColchonPico,
    datos: extraerDatos(f.datos),
  }
}

export function crearServicioColchonPico(cliente: ClienteColchonPico): ServicioColchonPico {
  return {
    ...serviciosNoConfigurados.colchonPico,

    async obtenerUltimoEvento(dispositivoId) {
      try {
        const { data, error } = await cliente
          .from(TABLA_EVENTOS_COLCHON)
          .select(COLUMNAS_EVENTOS_COLCHON)
          .eq('device_id', dispositivoId)
          .order('ts', { ascending: false })
          .order('recibido_en', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) {
          console.warn('[Colchón] Error al consultar último evento:', error)
          return fallo()
        }
        if (data === null || data === undefined) return { ok: true, datos: null }
        const evento = aEventoColchonPico(data)
        return evento ? { ok: true, datos: evento } : fallo()
      } catch (err) {
        console.warn('[Colchón] Excepción al consultar último evento:', err)
        return fallo()
      }
    },

    async obtenerHistorialEventos(dispositivoId, limite = 20) {
      try {
        const { data, error } = await cliente
          .from(TABLA_EVENTOS_COLCHON)
          .select(COLUMNAS_EVENTOS_COLCHON)
          .eq('device_id', dispositivoId)
          .order('ts', { ascending: false })
          .order('recibido_en', { ascending: false })
          .limit(limite)

        if (error) {
          console.warn('[Colchón] Error al consultar historial:', error)
          return fallo()
        }
        if (!Array.isArray(data)) return { ok: true, datos: [] }
        const eventos = data
          .map(aEventoColchonPico)
          .filter((e): e is EventoColchonPico => e !== null)
        return { ok: true, datos: eventos }
      } catch (err) {
        console.warn('[Colchón] Excepción al consultar historial:', err)
        return fallo()
      }
    },

    async solicitarComando(dispositivoId, comando, parametros = {}) {
      const commandId = crypto.randomUUID()
      if (typeof cliente.rpc !== 'function') {
        return fallo(MENSAJE_ERROR_ORDEN_COLCHON_PICO)
      }
      try {
        const { data, error } = await cliente.rpc(RPC_SOLICITAR_COMANDO_COLCHON, {
          p_command_id: commandId,
          p_device_id: dispositivoId,
          p_command: comando,
          p_params: parametros,
        })

        if (error) {
          console.warn('[Colchón] Error RPC solicitar_comando_colchon:', error)
          return fallo(MENSAJE_ERROR_ORDEN_COLCHON_PICO)
        }

        // La RPC puede retornar null en conflicto de command_id (muy raro),
        // pero igual la considera exitosa porque la orden existe.
        return {
          ok: true,
          datos: {
            command_id: commandId,
            device_id: dispositivoId,
            command: comando,
            params: parametros,
            estado: 'pendiente',
            creado_en: new Date().toISOString(),
            ...(typeof data === 'object' && data !== null ? data : {}),
          },
        }
      } catch (err) {
        console.warn('[Colchón] Excepción al solicitar comando:', err)
        return fallo(MENSAJE_ERROR_ORDEN_COLCHON_PICO)
      }
    },

    suscribirEventos(dispositivoId: string, manejadores: Manejadores<EventoColchonPico>) {
      if (typeof cliente.channel !== 'function') {
        return () => {}
      }
      try {
        const canal = cliente
          .channel(`canal_colchon_${dispositivoId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: TABLA_EVENTOS_COLCHON,
              filter: `device_id=eq.${dispositivoId}`,
            },
            (payload) => {
              const evento = aEventoColchonPico(payload.new)
              if (evento) {
                manejadores.alRecibir(evento)
              }
            },
          )
          .subscribe()

        return () => {
          canal.unsubscribe()
        }
      } catch {
        return () => {}
      }
    },
  }
}
