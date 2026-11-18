import type { SupabaseClient } from '@supabase/supabase-js'
import {
  TIPOS_MODULO,
  type Bebe,
  type Dueno,
  type InvitacionDueno,
  type ModuloAsociado,
  type TipoModulo,
} from '../models/cuentas.ts'
import type { Resultado, ServicioCuentas } from './tipos.ts'

// Solo se necesita `rpc` del cliente (facilita las pruebas).
export type ClienteCuentas = Pick<SupabaseClient, 'rpc'>

// Mensajes seguros: nunca se reenvía el texto del servidor. El servidor
// devuelve identificadores fijos en `message`; aquí se traducen.
export const MENSAJE_CUENTAS = 'No se pudo completar la operación. Intenta de nuevo.'
const MENSAJES_CONOCIDOS: Record<string, string> = {
  nombre_requerido: 'Escribe el nombre del bebé.',
  fecha_invalida: 'La fecha de nacimiento no puede ser futura.',
  correo_invalido: 'Escribe un correo válido.',
  codigo_invalido: 'El módulo o el código de reclamo no son válidos.',
  cuna_ya_asociada: 'Ese bebé ya tiene otra cuna asociada.',
  ultimo_dueno: 'No se puede retirar al último dueño del módulo.',
  no_es_dueno: 'Esa cuenta no es dueña del módulo.',
  no_autorizado: 'No tienes permiso para esta operación.',
  invitacion_no_pendiente: 'La invitación ya no está pendiente.',
}

export function mensajeCuentas(error: unknown): string {
  const mensaje = (error as { message?: unknown } | null)?.message
  return (typeof mensaje === 'string' && MENSAJES_CONOCIDOS[mensaje]) || MENSAJE_CUENTAS
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function esTexto(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function aBebe(v: unknown): Bebe | null {
  if (!esObjeto(v) || !esTexto(v.id) || !esTexto(v.nombre)) return null
  const fecha = v.fecha_nacimiento ?? null
  if (fecha !== null && !esTexto(fecha)) return null
  return { id: v.id, nombre: v.nombre, fecha_nacimiento: fecha }
}

function aModulo(v: unknown): ModuloAsociado | null {
  if (
    !esObjeto(v) ||
    !esTexto(v.id) ||
    !esTexto(v.producto_id) ||
    typeof v.activo !== 'boolean' ||
    !TIPOS_MODULO.includes(v.tipo as TipoModulo)
  ) {
    return null
  }
  const bebeId = v.bebe_id ?? null
  const bebeNombre = v.bebe_nombre ?? null
  if (bebeId !== null && !esTexto(bebeId)) return null
  if (bebeNombre !== null && !esTexto(bebeNombre)) return null
  return {
    id: v.id,
    tipo: v.tipo as TipoModulo,
    producto_id: v.producto_id,
    activo: v.activo,
    bebe_id: bebeId,
    bebe_nombre: bebeNombre,
  }
}

function aDueno(v: unknown): Dueno | null {
  if (!esObjeto(v) || !esTexto(v.usuario_id)) return null
  return { usuario_id: v.usuario_id, correo: typeof v.correo === 'string' ? v.correo : '' }
}

function aInvitacion(v: unknown): InvitacionDueno | null {
  if (
    !esObjeto(v) ||
    !esTexto(v.id) ||
    !esTexto(v.dispositivo_id) ||
    !esTexto(v.creada_en) ||
    !TIPOS_MODULO.includes(v.tipo as TipoModulo)
  ) {
    return null
  }
  return {
    id: v.id,
    dispositivo_id: v.dispositivo_id,
    tipo: v.tipo as TipoModulo,
    creada_en: v.creada_en,
  }
}

function lista<T>(datos: unknown, convertir: (v: unknown) => T | null): T[] | null {
  if (!Array.isArray(datos)) return null
  const salida: T[] = []
  for (const elemento of datos) {
    const convertido = convertir(elemento)
    if (convertido === null) return null
    salida.push(convertido)
  }
  return salida
}

/**
 * Cuentas reales: cada operación es una RPC con la sesión del usuario y la
 * clave publicable. Los permisos los decide la base de datos (RLS y RPC).
 */
export function crearServicioCuentas(cliente: ClienteCuentas): ServicioCuentas {
  async function llamar(
    nombre: string,
    parametros: Record<string, unknown> | undefined,
  ): Promise<Resultado<unknown>> {
    try {
      const { data, error } = await cliente.rpc(nombre, parametros)
      if (error) return { ok: false, error: mensajeCuentas(error) }
      return { ok: true, datos: data }
    } catch {
      return { ok: false, error: MENSAJE_CUENTAS }
    }
  }

  async function llamarLista<T>(
    nombre: string,
    parametros: Record<string, unknown> | undefined,
    convertir: (v: unknown) => T | null,
  ): Promise<Resultado<T[]>> {
    const r = await llamar(nombre, parametros)
    if (!r.ok) return r
    const datos = lista(r.datos, convertir)
    return datos ? { ok: true, datos } : { ok: false, error: MENSAJE_CUENTAS }
  }

  async function llamarSinDatos(
    nombre: string,
    parametros: Record<string, unknown>,
  ): Promise<Resultado<null>> {
    const r = await llamar(nombre, parametros)
    return r.ok ? { ok: true, datos: null } : r
  }

  return {
    listarBebes: () => llamarLista('mis_bebes', undefined, aBebe),

    async crearBebe(nombre, fechaNacimiento) {
      const limpio = nombre.trim()
      // La base de datos también lo exige; esto evita el viaje (CA-02.3).
      if (limpio === '') return { ok: false, error: MENSAJES_CONOCIDOS.nombre_requerido }
      const r = await llamar('crear_bebe', {
        p_nombre: limpio,
        p_fecha_nacimiento: fechaNacimiento || null,
      })
      if (!r.ok) return r
      const bebe = aBebe(r.datos)
      return bebe ? { ok: true, datos: bebe } : { ok: false, error: MENSAJE_CUENTAS }
    },

    listarDispositivos: () => llamarLista('mis_dispositivos', undefined, aModulo),

    reclamarDispositivo: (dispositivoId, codigo) =>
      llamarSinDatos('reclamar_dispositivo', {
        p_device_id: dispositivoId.trim(),
        p_codigo: codigo.trim(),
      }),

    asignarDispositivo: (dispositivoId, bebeId) =>
      llamarSinDatos('asignar_dispositivo', {
        p_device_id: dispositivoId,
        p_bebe_id: bebeId,
      }),

    listarDuenos: (dispositivoId) =>
      llamarLista('duenos_de', { p_device_id: dispositivoId }, aDueno),

    invitarDueno: (dispositivoId, correo) =>
      llamarSinDatos('invitar_dueno', {
        p_device_id: dispositivoId,
        p_correo: correo.trim(),
      }),

    retirarDueno: (dispositivoId, usuarioId) =>
      llamarSinDatos('retirar_dueno', {
        p_device_id: dispositivoId,
        p_usuario_id: usuarioId,
      }),

    listarInvitaciones: () =>
      llamarLista('mis_invitaciones', undefined, aInvitacion),

    aceptarInvitacion: (invitacionId) =>
      llamarSinDatos('aceptar_invitacion', { p_invitacion_id: invitacionId }),
  }
}
