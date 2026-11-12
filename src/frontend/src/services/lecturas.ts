import type { SupabaseClient } from '@supabase/supabase-js'
import type { LecturaAmbiental } from '../models/contrato.ts'
import { serviciosNoConfigurados } from './noConfigurado.ts'
import type { Resultado, ServicioLecturas } from './tipos.ts'

// Solo se necesita `from` del cliente (facilita las pruebas).
export type ClienteLecturas = Pick<SupabaseClient, 'from'>

export const TABLA_LECTURAS_AMBIENTE = 'lecturas_ambiente'
export const COLUMNAS_LECTURA_AMBIENTE =
  'event_id,device_id,ts,recibido_en,temperatura_c,humedad_pct'

// Mensaje seguro: nunca se reenvía el texto del servidor.
export const MENSAJE_LECTURA = 'No se pudo consultar la última lectura.'

function fallo<T>(): Resultado<T> {
  return { ok: false, error: MENSAJE_LECTURA }
}

function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

// event_id → id, device_id → dispositivo_id, ts → registrado_en.
function aLecturaAmbiental(fila: unknown): LecturaAmbiental | null {
  if (typeof fila !== 'object' || fila === null) return null
  const f = fila as Record<string, unknown>
  if (
    typeof f.event_id !== 'string' ||
    typeof f.device_id !== 'string' ||
    typeof f.ts !== 'string' ||
    !esNumero(f.temperatura_c) ||
    !esNumero(f.humedad_pct)
  ) {
    return null
  }
  return {
    id: f.event_id,
    dispositivo_id: f.device_id,
    temperatura_c: f.temperatura_c,
    humedad_pct: f.humedad_pct,
    registrado_en: f.ts,
  }
}

/**
 * Lecturas reales: solo `obtenerUltimaAmbiental` consulta Supabase (con la
 * sesión del usuario y la clave publicable, bajo RLS). El resto sigue sin
 * configurar hasta que exista su integración.
 */
export function crearServicioLecturas(
  cliente: ClienteLecturas,
): ServicioLecturas {
  return {
    ...serviciosNoConfigurados.lecturas,

    async obtenerUltimaAmbiental(dispositivoId) {
      try {
        const { data, error } = await cliente
          .from(TABLA_LECTURAS_AMBIENTE)
          .select(COLUMNAS_LECTURA_AMBIENTE)
          .eq('device_id', dispositivoId)
          .order('ts', { ascending: false })
          .order('recibido_en', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return fallo()
        if (data === null || data === undefined) return { ok: true, datos: null }
        const lectura = aLecturaAmbiental(data)
        return lectura ? { ok: true, datos: lectura } : fallo()
      } catch {
        return fallo()
      }
    },
  }
}
