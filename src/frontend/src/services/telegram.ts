import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CodigoVinculacion,
  DestinatarioTelegram,
} from '../models/telegram.ts'
import { mensajeCuentas } from './cuentas.ts'
import type { Resultado, ServicioTelegram } from './tipos.ts'

export type ClienteTelegram = Pick<SupabaseClient, 'rpc'>

const MENSAJE_GENERICO = 'No se pudo completar la operación. Intenta de nuevo.'

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function aDestinatario(v: unknown): DestinatarioTelegram | null {
  if (
    !esObjeto(v) ||
    typeof v.id !== 'string' ||
    v.id === '' ||
    typeof v.nombre !== 'string' ||
    v.nombre === '' ||
    typeof v.vinculado !== 'boolean'
  ) {
    return null
  }
  return { id: v.id, nombre: v.nombre, vinculado: v.vinculado }
}

function aCodigo(v: unknown): CodigoVinculacion | null {
  if (
    !esObjeto(v) ||
    typeof v.codigo !== 'string' ||
    !/^[A-Za-z0-9_-]{8,64}$/.test(v.codigo) ||
    typeof v.vence_en !== 'string' ||
    Number.isNaN(Date.parse(v.vence_en))
  ) {
    return null
  }
  return { codigo: v.codigo, vence_en: v.vence_en }
}

/** Destinatarios reales: RPC con la sesión del usuario; la base decide los permisos. */
export function crearServicioTelegram(cliente: ClienteTelegram): ServicioTelegram {
  async function llamar(
    nombre: string,
    parametros: Record<string, unknown>,
  ): Promise<Resultado<unknown>> {
    try {
      const { data, error } = await cliente.rpc(nombre, parametros)
      if (error) return { ok: false, error: mensajeCuentas(error) }
      return { ok: true, datos: data }
    } catch {
      return { ok: false, error: MENSAJE_GENERICO }
    }
  }

  return {
    async listarDestinatarios(dispositivoId) {
      const r = await llamar('mis_destinatarios', { p_device_id: dispositivoId })
      if (!r.ok) return r
      if (!Array.isArray(r.datos)) return { ok: false, error: MENSAJE_GENERICO }
      const lista = r.datos.map(aDestinatario)
      return lista.every((d) => d !== null)
        ? { ok: true, datos: lista }
        : { ok: false, error: MENSAJE_GENERICO }
    },

    async crearDestinatario(dispositivoId, nombre) {
      const limpio = nombre.trim()
      if (limpio === '') return { ok: false, error: 'Escribe el nombre del destinatario.' }
      const r = await llamar('crear_destinatario', {
        p_device_id: dispositivoId,
        p_nombre: limpio,
      })
      if (!r.ok) return r
      const d = aDestinatario(r.datos)
      return d ? { ok: true, datos: d } : { ok: false, error: MENSAJE_GENERICO }
    },

    async generarCodigo(destinatarioId) {
      const r = await llamar('generar_codigo_vinculacion', {
        p_destinatario_id: destinatarioId,
      })
      if (!r.ok) return r
      const c = aCodigo(r.datos)
      return c ? { ok: true, datos: c } : { ok: false, error: MENSAJE_GENERICO }
    },

    async retirarDestinatario(destinatarioId) {
      const r = await llamar('retirar_destinatario', {
        p_destinatario_id: destinatarioId,
      })
      return r.ok ? { ok: true, datos: null } : r
    },
  }
}
