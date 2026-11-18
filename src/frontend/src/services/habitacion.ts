import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BUCKET_FOTOS,
  ESTADOS_FOTO,
  FOTO_ENLACE_SEGUNDOS,
  MOTIVOS_FOTO,
  TIPOS_EVENTO_HABITACION,
  type EstadoFoto,
  type EventoHabitacion,
  type FotoHabitacion,
  type MotivoFoto,
  type TipoEventoHabitacion,
} from '../models/habitacion.ts'
import { rutaFoto, validarArchivoFoto } from '../utils/habitacion.ts'
import { llamar } from './ordenes.ts'
import type { Resultado, ServicioHabitacion } from './tipos.ts'

export type ClienteHabitacion = Pick<SupabaseClient, 'from' | 'rpc' | 'storage'>

export const MENSAJE_EVENTOS_HABITACION = 'No se pudieron consultar los eventos de la habitación.'
export const MENSAJE_FOTOS_HABITACION = 'No se pudieron consultar las fotografías.'
export const MENSAJE_ABRIR_FOTO = 'No se pudo abrir la fotografía.'
export const MENSAJE_SUBIR_FOTO = 'No se pudo guardar la fotografía.'

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function aEvento(fila: unknown): EventoHabitacion | null {
  if (!esObjeto(fila)) return null
  const { event_id, tipo, descripcion, ts } = fila
  if (
    typeof event_id !== 'string' ||
    typeof descripcion !== 'string' ||
    typeof ts !== 'string' ||
    !TIPOS_EVENTO_HABITACION.includes(tipo as TipoEventoHabitacion)
  ) {
    return null
  }
  return { event_id, tipo: tipo as TipoEventoHabitacion, descripcion, ts }
}

function aFoto(fila: unknown): FotoHabitacion | null {
  if (!esObjeto(fila)) return null
  const { event_id, estado, ruta, motivo, solicitada_en, resuelta_en } = fila
  if (
    typeof event_id !== 'string' ||
    typeof solicitada_en !== 'string' ||
    !ESTADOS_FOTO.includes(estado as EstadoFoto) ||
    !(ruta === null || typeof ruta === 'string') ||
    !(motivo === null || MOTIVOS_FOTO.includes(motivo as MotivoFoto)) ||
    !(resuelta_en === null || typeof resuelta_en === 'string')
  ) {
    return null
  }
  // Una foto guardada sin ruta (o una fallida sin motivo) no se presenta.
  if ((estado === 'guardada') !== (ruta !== null)) return null
  if ((estado === 'fallida') !== (motivo !== null)) return null
  return {
    event_id,
    estado: estado as EstadoFoto,
    ruta,
    motivo: motivo as MotivoFoto | null,
    solicitada_en,
    resuelta_en,
  }
}

/**
 * Habitación real: eventos y fotos se leen con la sesión del usuario (RLS limita
 * las filas); las imágenes viven en un almacén privado al que solo entran los
 * dueños. La imagen nunca pasa por Telegram ni se guarda fuera de ese almacén.
 */
export function crearServicioHabitacion(cliente: ClienteHabitacion): ServicioHabitacion {
  return {
    async listarEventos(dispositivoId, limite) {
      const fallo = (): Resultado<EventoHabitacion[]> => ({
        ok: false,
        error: MENSAJE_EVENTOS_HABITACION,
      })
      try {
        const { data, error } = await cliente
          .from('eventos')
          .select('event_id,tipo,descripcion,ts')
          .eq('device_id', dispositivoId)
          .in('tipo', [...TIPOS_EVENTO_HABITACION])
          .order('ts', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(limite)
        if (error || !Array.isArray(data)) return fallo()
        const eventos = data.map(aEvento)
        if (eventos.some((e) => e === null)) return fallo()
        return { ok: true, datos: eventos as EventoHabitacion[] }
      } catch {
        return fallo()
      }
    },

    async listarFotos(dispositivoId, limite) {
      const fallo = (): Resultado<FotoHabitacion[]> => ({
        ok: false,
        error: MENSAJE_FOTOS_HABITACION,
      })
      try {
        const { data, error } = await cliente
          .from('fotos')
          .select('event_id,estado,ruta,motivo,solicitada_en,resuelta_en')
          .eq('device_id', dispositivoId)
          .order('solicitada_en', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(limite)
        if (error || !Array.isArray(data)) return fallo()
        const fotos = data.map(aFoto)
        if (fotos.some((f) => f === null)) return fallo()
        return { ok: true, datos: fotos as FotoHabitacion[] }
      } catch {
        return fallo()
      }
    },

    async urlFoto(ruta) {
      try {
        const { data, error } = await cliente.storage
          .from(BUCKET_FOTOS)
          .createSignedUrl(ruta, FOTO_ENLACE_SEGUNDOS)
        if (error || typeof data?.signedUrl !== 'string') {
          return { ok: false, error: MENSAJE_ABRIR_FOTO }
        }
        return { ok: true, datos: data.signedUrl }
      } catch {
        return { ok: false, error: MENSAJE_ABRIR_FOTO }
      }
    },

    async subirFoto(dispositivoId, eventId, archivo) {
      const invalido = validarArchivoFoto(archivo)
      if (invalido !== null) return { ok: false, error: invalido }
      const ruta = rutaFoto(dispositivoId, eventId, archivo.type)
      try {
        const { error } = await cliente.storage
          .from(BUCKET_FOTOS)
          .upload(ruta, archivo, { contentType: archivo.type, upsert: false })
        if (error) {
          // Que la foto quede marcada como fallida es un intento: si también falla, el error ya se informa.
          await llamar(cliente, 'marcar_foto_fallida', {
            p_event_id: eventId,
            p_motivo: 'carga_fallida',
          })
          return { ok: false, error: MENSAJE_SUBIR_FOTO }
        }
      } catch {
        return { ok: false, error: MENSAJE_SUBIR_FOTO }
      }
      const r = await llamar(cliente, 'registrar_foto', { p_event_id: eventId, p_ruta: ruta })
      return r.ok ? { ok: true, datos: null } : r
    },

    async marcarFallida(eventId, motivo) {
      const r = await llamar(cliente, 'marcar_foto_fallida', {
        p_event_id: eventId,
        p_motivo: motivo,
      })
      return r.ok ? { ok: true, datos: null } : r
    },
  }
}
