import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstadoOrdenLampara, OrdenLampara } from '../models/lampara.ts'
import { esNivelValido } from '../utils/lampara.ts'
import type { Resultado, ServicioLampara } from './tipos.ts'

// Solo se necesitan `from` y `rpc` del cliente (facilita las pruebas).
export type ClienteLampara = Pick<SupabaseClient, 'from' | 'rpc'>

export const RPC_SOLICITAR_LAMPARA = 'solicitar_lampara'
export const TABLA_ORDENES_LAMPARA = 'ordenes_lampara'
export const COLUMNAS_ORDEN_LAMPARA =
  'command_id,device_id,nivel,creado_en,vence_en,estado,entregado_en,confirmado_en,nivel_confirmado,error'

// Mensajes seguros: nunca se reenvía el texto del servidor.
export const MENSAJE_SOLICITUD_LAMPARA =
  'No se pudo registrar la solicitud de la lámpara.'
export const MENSAJE_CONSULTA_LAMPARA =
  'No se pudo consultar la última orden de la lámpara.'

const ESTADOS: readonly EstadoOrdenLampara[] = [
  'pendiente',
  'enviado',
  'confirmado',
  'error',
]

function esTexto(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function textoONulo(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null
  return typeof v === 'string' ? v : undefined
}

function aOrdenLampara(fila: unknown): OrdenLampara | null {
  if (typeof fila !== 'object' || fila === null) return null
  const f = fila as Record<string, unknown>
  const entregado = textoONulo(f.entregado_en)
  const confirmado = textoONulo(f.confirmado_en)
  const error = textoONulo(f.error)
  const confirmadoNivel = f.nivel_confirmado ?? null
  if (
    !esTexto(f.command_id) ||
    !esTexto(f.device_id) ||
    !esNivelValido(f.nivel) ||
    !esTexto(f.creado_en) ||
    !esTexto(f.vence_en) ||
    typeof f.estado !== 'string' ||
    !ESTADOS.includes(f.estado as EstadoOrdenLampara) ||
    entregado === undefined ||
    confirmado === undefined ||
    error === undefined ||
    (confirmadoNivel !== null && !esNivelValido(confirmadoNivel))
  ) {
    return null
  }
  return {
    command_id: f.command_id,
    device_id: f.device_id,
    nivel: f.nivel,
    creado_en: f.creado_en,
    vence_en: f.vence_en,
    estado: f.estado as EstadoOrdenLampara,
    entregado_en: entregado,
    confirmado_en: confirmado,
    nivel_confirmado: confirmadoNivel,
    error,
  }
}

/**
 * Lámpara real: la solicitud usa el RPC `solicitar_lampara` y la consulta lee
 * `ordenes_lampara`, ambos con la sesión del usuario y la clave publicable
 * (RLS limita las filas). Registrar la solicitud no prueba que la luz cambie.
 */
export function crearServicioLampara(
  cliente: ClienteLampara,
): ServicioLampara {
  return {
    async solicitarLampara(dispositivoId, nivel) {
      const fallo = (): Resultado<OrdenLampara> => ({
        ok: false,
        error: MENSAJE_SOLICITUD_LAMPARA,
      })
      if (!esNivelValido(nivel)) return fallo()
      try {
        const commandId = crypto.randomUUID()
        // PostgREST representa por defecto el retorno compuesto como arreglo;
        // `.single()` pide explícitamente un objeto singular.
        const { data, error } = await cliente
          .rpc(RPC_SOLICITAR_LAMPARA, {
            p_command_id: commandId,
            p_device_id: dispositivoId,
            p_level: nivel,
          })
          .single()
        if (error) return fallo()
        const orden = aOrdenLampara(data)
        // La respuesta debe ser la orden pedida; si no, no se presenta.
        if (
          !orden ||
          orden.command_id !== commandId ||
          orden.device_id !== dispositivoId ||
          orden.nivel !== nivel
        ) {
          return fallo()
        }
        return { ok: true, datos: orden }
      } catch {
        return fallo()
      }
    },

    async obtenerUltimaOrdenLampara(dispositivoId) {
      const fallo = (): Resultado<OrdenLampara | null> => ({
        ok: false,
        error: MENSAJE_CONSULTA_LAMPARA,
      })
      try {
        const { data, error } = await cliente
          .from(TABLA_ORDENES_LAMPARA)
          .select(COLUMNAS_ORDEN_LAMPARA)
          .eq('device_id', dispositivoId)
          .order('creado_en', { ascending: false })
          .order('command_id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return fallo()
        if (data === null || data === undefined) return { ok: true, datos: null }
        const orden = aOrdenLampara(data)
        return orden ? { ok: true, datos: orden } : fallo()
      } catch {
        return fallo()
      }
    },
  }
}
