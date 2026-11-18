import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ComandoModulo,
  EstadoModulo,
  EstadoOrden,
  FaseVoz,
  LimitesAmbiente,
  OrdenModulo,
} from '../models/ordenes.ts'
import { comandoValido, horaValida } from '../utils/ordenes.ts'
import { MENSAJE_CUENTAS, mensajeCuentas } from './cuentas.ts'
import type {
  Resultado,
  ServicioHorarios,
  ServicioLimites,
  ServicioOrdenes,
  ServicioVoz,
  SesionVoz,
} from './tipos.ts'

export type ClienteOrdenes = Pick<SupabaseClient, 'from' | 'rpc'>
export type ClienteRpc = Pick<SupabaseClient, 'rpc'>
export type ClienteVoz = Pick<SupabaseClient, 'rpc' | 'channel' | 'removeChannel'>

export const TABLA_ORDENES_MODULO = 'ordenes_modulo'
export const COLUMNAS_ORDEN_MODULO =
  'command_id,device_id,command,params,creado_en,vence_en,estado,entregado_en,confirmado_en,error'

// Mensajes seguros: nunca se reenvía el texto del servidor.
export const MENSAJE_SOLICITUD_ORDEN = 'No se pudo registrar la solicitud.'
export const MENSAJE_CONSULTA_ORDEN = 'No se pudo consultar la última orden.'
const MENSAJES_ORDENES: Record<string, string> = {
  parametros_invalidos: 'Los valores pedidos no son válidos para este comando.',
  comando_invalido: 'Ese comando no existe.',
  comando_de_otro_modulo: 'Ese comando no corresponde a este módulo.',
  limites_invalidos:
    'Los límites no son válidos: el mínimo debe ser menor que el máximo y estar en rango.',
  horario_invalido: 'Alguna hora del horario no es válida.',
  actividad_invalida: 'No se pudo registrar la actividad de voz.',
}

function mensaje(error: unknown): string {
  const m = (error as { message?: unknown } | null)?.message
  return (typeof m === 'string' && MENSAJES_ORDENES[m]) || mensajeCuentas(error)
}

const ESTADOS: readonly EstadoOrden[] = ['pendiente', 'enviado', 'confirmado', 'error']

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const textoONulo = (v: unknown): string | null | undefined =>
  v === null || v === undefined ? null : typeof v === 'string' ? v : undefined

function aOrden(fila: unknown): OrdenModulo | null {
  if (!esObjeto(fila)) return null
  const entregado = textoONulo(fila.entregado_en)
  const confirmado = textoONulo(fila.confirmado_en)
  const error = textoONulo(fila.error)
  if (
    !esTexto(fila.command_id) ||
    !esTexto(fila.device_id) ||
    !esTexto(fila.command) ||
    !esObjeto(fila.params) ||
    !esTexto(fila.creado_en) ||
    !esTexto(fila.vence_en) ||
    !ESTADOS.includes(fila.estado as EstadoOrden) ||
    entregado === undefined ||
    confirmado === undefined ||
    error === undefined
  ) {
    return null
  }
  return {
    command_id: fila.command_id,
    device_id: fila.device_id,
    command: fila.command,
    params: fila.params,
    creado_en: fila.creado_en,
    vence_en: fila.vence_en,
    estado: fila.estado as EstadoOrden,
    entregado_en: entregado,
    confirmado_en: confirmado,
    error,
  }
}

async function llamar(
  cliente: ClienteRpc,
  nombre: string,
  parametros: Record<string, unknown>,
): Promise<Resultado<unknown>> {
  try {
    const { data, error } = await cliente.rpc(nombre, parametros)
    if (error) return { ok: false, error: mensaje(error) }
    return { ok: true, datos: data }
  } catch {
    return { ok: false, error: MENSAJE_CUENTAS }
  }
}

/**
 * Órdenes reales: la solicitud usa el RPC `solicitar_orden` y la consulta lee
 * `ordenes_modulo`, ambos con la sesión del usuario (RLS limita las filas).
 * Registrar una solicitud no prueba que el hardware actúe: solo una
 * confirmación de la Pico (`estado_de_modulo`) cambia lo que se muestra.
 */
export function crearServicioOrdenes(cliente: ClienteOrdenes): ServicioOrdenes {
  return {
    async solicitar(dispositivoId, comando: ComandoModulo) {
      const fallo = (texto = MENSAJE_SOLICITUD_ORDEN): Resultado<OrdenModulo> => ({
        ok: false,
        error: texto,
      })
      if (!comandoValido(comando)) return fallo()
      const commandId = crypto.randomUUID()
      const r = await llamar(cliente, 'solicitar_orden', {
        p_command_id: commandId,
        p_device_id: dispositivoId,
        p_command: comando.command,
        p_params: comando.params,
      })
      if (!r.ok) return fallo(r.error)
      const d = r.datos
      // La respuesta debe ser la orden pedida; si no, no se presenta.
      if (
        !esObjeto(d) ||
        d.command_id !== commandId ||
        d.device_id !== dispositivoId ||
        d.command !== comando.command ||
        !esTexto(d.creado_en) ||
        !esTexto(d.vence_en) ||
        !ESTADOS.includes(d.estado as EstadoOrden)
      ) {
        return fallo()
      }
      return {
        ok: true,
        datos: {
          command_id: commandId,
          device_id: dispositivoId,
          command: comando.command,
          params: { ...comando.params },
          creado_en: d.creado_en,
          vence_en: d.vence_en,
          estado: d.estado as EstadoOrden,
          entregado_en: null,
          confirmado_en: null,
          error: null,
        },
      }
    },

    async obtenerUltimaOrden(dispositivoId, comandos) {
      const fallo = (): Resultado<OrdenModulo | null> => ({
        ok: false,
        error: MENSAJE_CONSULTA_ORDEN,
      })
      try {
        const { data, error } = await cliente
          .from(TABLA_ORDENES_MODULO)
          .select(COLUMNAS_ORDEN_MODULO)
          .eq('device_id', dispositivoId)
          .in('command', [...comandos])
          .order('creado_en', { ascending: false })
          .order('command_id', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) return fallo()
        if (data === null || data === undefined) return { ok: true, datos: null }
        const orden = aOrden(data)
        return orden ? { ok: true, datos: orden } : fallo()
      } catch {
        return fallo()
      }
    },

    async obtenerEstado(dispositivoId) {
      const r = await llamar(cliente, 'estado_de_modulo', { p_device_id: dispositivoId })
      if (!r.ok) return r
      const d = r.datos
      const actualizado = esObjeto(d) ? (d.actualizado_en ?? null) : undefined
      if (
        !esObjeto(d) ||
        !esObjeto(d.estado) ||
        (actualizado !== null && !esTexto(actualizado))
      ) {
        return { ok: false, error: MENSAJE_CUENTAS }
      }
      const estado: EstadoModulo = { estado: d.estado, actualizado_en: actualizado }
      return { ok: true, datos: estado }
    },
  }
}

function aLimites(v: unknown): LimitesAmbiente | null {
  if (!esObjeto(v)) return null
  const { temp_min, temp_max, hum_min, hum_max } = v
  if (
    typeof temp_min !== 'number' ||
    typeof temp_max !== 'number' ||
    typeof hum_min !== 'number' ||
    typeof hum_max !== 'number'
  ) {
    return null
  }
  return { temp_min, temp_max, hum_min, hum_max }
}

/** Límites de temperatura y humedad por módulo de ambiente. */
export function crearServicioLimites(cliente: ClienteRpc): ServicioLimites {
  return {
    async obtener(dispositivoId) {
      const r = await llamar(cliente, 'mis_limites', { p_device_id: dispositivoId })
      if (!r.ok) return r
      if (r.datos === null || r.datos === undefined) return { ok: true, datos: null }
      const limites = aLimites(r.datos)
      return limites ? { ok: true, datos: limites } : { ok: false, error: MENSAJE_CUENTAS }
    },

    async guardar(dispositivoId, limites) {
      const r = await llamar(cliente, 'guardar_limites', {
        p_device_id: dispositivoId,
        p_temp_min: limites.temp_min,
        p_temp_max: limites.temp_max,
        p_hum_min: limites.hum_min,
        p_hum_max: limites.hum_max,
      })
      if (!r.ok) return r
      const guardados = aLimites(r.datos)
      return guardados
        ? { ok: true, datos: guardados }
        : { ok: false, error: MENSAJE_CUENTAS }
    },
  }
}

function aHoras(v: unknown): string[] | null {
  if (!Array.isArray(v) || !v.every((h) => typeof h === 'string' && horaValida(h))) return null
  return v as string[]
}

/** Horarios (hora civil de Costa Rica) por módulo y tipo. */
export function crearServicioHorarios(cliente: ClienteRpc): ServicioHorarios {
  return {
    async listar(dispositivoId, tipo) {
      const r = await llamar(cliente, 'mis_horarios', { p_device_id: dispositivoId, p_tipo: tipo })
      if (!r.ok) return r
      const horas = aHoras(r.datos)
      return horas ? { ok: true, datos: horas } : { ok: false, error: MENSAJE_CUENTAS }
    },

    async reemplazar(dispositivoId, tipo, horas) {
      if (!horas.every(horaValida)) {
        return { ok: false, error: MENSAJES_ORDENES.horario_invalido }
      }
      const r = await llamar(cliente, 'reemplazar_horarios', {
        p_device_id: dispositivoId,
        p_tipo: tipo,
        p_horas: horas,
      })
      if (!r.ok) return r
      const guardadas = aHoras(r.datos)
      return guardadas
        ? { ok: true, datos: guardadas }
        : { ok: false, error: MENSAJE_CUENTAS }
    },
  }
}

const ESPERA_CANAL_MS = 8000

/**
 * Voz en vivo por un canal privado de Realtime. La web solo difunde fragmentos
 * PCM; nada se guarda. Contrato: src/shared/contracts/voz.md.
 */
export function crearServicioVoz(cliente: ClienteVoz): ServicioVoz {
  return {
    async abrir(productoId) {
      const fallo = (): Resultado<SesionVoz> => ({
        ok: false,
        error: 'No se pudo abrir el canal de voz.',
      })
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(productoId)) return fallo()
      try {
        const canal = cliente.channel(`voz:${productoId}`, {
          config: { private: true, broadcast: { self: false, ack: false } },
        })
        const listo = await new Promise<boolean>((resolver) => {
          const temporizador = setTimeout(() => resolver(false), ESPERA_CANAL_MS)
          canal.subscribe((estado) => {
            if (estado === 'SUBSCRIBED') {
              clearTimeout(temporizador)
              resolver(true)
            } else if (
              estado === 'CHANNEL_ERROR' ||
              estado === 'TIMED_OUT' ||
              estado === 'CLOSED'
            ) {
              clearTimeout(temporizador)
              resolver(false)
            }
          })
        })
        if (!listo) {
          await cliente.removeChannel(canal).catch(() => undefined)
          return fallo()
        }
        let cerrado = false
        const sesion: SesionVoz = {
          async enviar(seq, pcmBase64) {
            if (cerrado) return false
            try {
              const r = await canal.send({
                type: 'broadcast',
                event: 'voz',
                payload: { seq, pcm: pcmBase64 },
              })
              return r === 'ok'
            } catch {
              return false
            }
          },
          async cerrar() {
            if (cerrado) return
            cerrado = true
            try {
              await canal.send({ type: 'broadcast', event: 'voz_fin', payload: {} })
            } catch {
              // La Pico cierra sola si no llegan fragmentos en 2 s.
            }
            await cliente.removeChannel(canal).catch(() => undefined)
          },
        }
        return { ok: true, datos: sesion }
      } catch {
        return fallo()
      }
    },

    async registrarActividad(dispositivoId, fase: FaseVoz) {
      const r = await llamar(cliente, 'registrar_actividad_voz', {
        p_event_id: crypto.randomUUID(),
        p_device_id: dispositivoId,
        p_fase: fase,
      })
      return r.ok ? { ok: true, datos: null } : r
    },
  }
}
