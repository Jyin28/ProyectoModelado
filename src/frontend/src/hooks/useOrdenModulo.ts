import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ComandoModulo,
  EstadoModulo,
  OrdenModulo,
} from '../models/ordenes.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_CONSULTA_ORDEN_MS = 2_000

export type OrdenDeModulo = {
  /** false cuando no hay consulta real (backend sin configurar o sin sesión). */
  activo: boolean
  /** Primera consulta de esta cuenta y módulo todavía pendiente. */
  cargando: boolean
  /** La consulta más reciente falló. */
  fallo: boolean
  enviando: boolean
  /** Texto del último fallo al solicitar, o null. */
  errorEnvio: string | null
  /** Última orden conocida de esta cuenta y módulo entre los comandos pedidos. */
  orden: OrdenModulo | null
  /** Última confirmación real de la Pico (vacía si nunca confirmó). */
  estado: EstadoModulo | null
  solicitar: (comando: ComandoModulo) => Promise<void>
}

type Interno = {
  // Identifica usuario + módulo: un estado de otra clave nunca se muestra.
  clave: string
  resuelta: boolean
  fallo: boolean
  enviando: boolean
  errorEnvio: string | null
  orden: OrdenModulo | null
  estado: EstadoModulo | null
}

const vacio = (clave: string): Interno => ({
  clave,
  resuelta: false,
  fallo: false,
  enviando: false,
  errorEnvio: null,
  orden: null,
  estado: null,
})

const base = (previo: Interno | null, clave: string): Interno =>
  previo?.clave === clave ? previo : vacio(clave)

const noop = () => Promise.resolve()

/**
 * Última orden y último estado confirmado de un módulo, con consulta cada 2 s.
 * Nunca hay estado optimista: lo que se muestra como aplicado viene de la
 * confirmación de la Pico.
 */
export function useOrdenModulo(
  dispositivoId: string,
  comandos: readonly string[],
): OrdenDeModulo {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const ordenes = servicios.ordenes
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const habilitado = backendConfigurado && usuarioId !== null
  const filtro = comandos.join(',')
  const clave = habilitado ? JSON.stringify([usuarioId, dispositivoId, filtro]) : ''
  const [interno, setInterno] = useState<Interno | null>(null)

  const claveVigente = useRef('')
  const claveEnviando = useRef<string | null>(null)
  const version = useRef(0)

  useEffect(() => {
    claveVigente.current = clave
    return () => {
      claveVigente.current = ''
    }
  }, [clave])

  useEffect(() => {
    if (!habilitado) return
    const lista = filtro.split(',')
    const control = { vigente: true, enCurso: false }

    const consultar = async () => {
      if (!control.vigente || control.enCurso) return
      control.enCurso = true
      const versionInicial = version.current
      let rOrden
      let rEstado
      try {
        ;[rOrden, rEstado] = await Promise.all([
          ordenes.obtenerUltimaOrden(dispositivoId, lista),
          ordenes.obtenerEstado(dispositivoId),
        ])
      } catch {
        rOrden = { ok: false as const, error: '' }
        rEstado = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente || version.current !== versionInicial) return
      setInterno((previo) => {
        const b = base(previo, clave)
        return {
          ...b,
          resuelta: true,
          fallo: !rOrden.ok || !rEstado.ok,
          orden: rOrden.ok ? rOrden.datos : b.orden,
          estado: rEstado.ok ? rEstado.datos : b.estado,
        }
      })
    }

    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_CONSULTA_ORDEN_MS)
    return () => {
      control.vigente = false
      clearInterval(id)
    }
  }, [habilitado, ordenes, dispositivoId, filtro, clave])

  const solicitar = useCallback(
    async (comando: ComandoModulo) => {
      if (!habilitado || claveEnviando.current === clave) return
      claveEnviando.current = clave
      setInterno((previo) => ({ ...base(previo, clave), enviando: true, errorEnvio: null }))
      let r
      try {
        r = await ordenes.solicitar(dispositivoId, comando)
      } catch {
        r = { ok: false as const, error: 'No se pudo registrar la solicitud.' }
      }
      if (claveEnviando.current === clave) claveEnviando.current = null
      if (claveVigente.current !== clave) return
      if (r.ok) version.current += 1
      setInterno((previo) => {
        const b = base(previo, clave)
        return r.ok
          ? { ...b, enviando: false, errorEnvio: null, fallo: false, orden: r.datos }
          : { ...b, enviando: false, errorEnvio: r.error }
      })
    },
    [habilitado, clave, ordenes, dispositivoId],
  )

  if (!habilitado) {
    return {
      activo: false,
      cargando: false,
      fallo: false,
      enviando: false,
      errorEnvio: null,
      orden: null,
      estado: null,
      solicitar: noop,
    }
  }
  const e = interno === null || interno.clave !== clave ? vacio(clave) : interno
  return {
    activo: true,
    cargando: !e.resuelta && e.orden === null,
    fallo: e.fallo,
    enviando: e.enviando,
    errorEnvio: e.errorEnvio,
    orden: e.orden,
    estado: e.estado,
    solicitar,
  }
}
