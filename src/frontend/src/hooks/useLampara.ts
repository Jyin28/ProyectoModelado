import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrdenLampara } from '../models/lampara.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_CONSULTA_LAMPARA_MS = 2_000

export type Lampara = {
  /** false cuando no hay consulta real (backend sin configurar o sin sesión). */
  activo: boolean
  /** Primera consulta de esta cuenta y módulo todavía pendiente. */
  cargando: boolean
  /** La consulta más reciente falló. */
  fallo: boolean
  /** Solicitud en curso. */
  enviando: boolean
  /** La última solicitud falló. */
  falloEnvio: boolean
  /** Última orden conocida de esta cuenta y módulo. */
  orden: OrdenLampara | null
  solicitar: (nivel: number) => Promise<void>
}

type Estado = {
  // Identifica usuario + módulo: un estado de otra clave nunca se muestra.
  clave: string
  resuelta: boolean
  fallo: boolean
  enviando: boolean
  falloEnvio: boolean
  orden: OrdenLampara | null
}

const vacio = (clave: string): Estado => ({
  clave,
  resuelta: false,
  fallo: false,
  enviando: false,
  falloEnvio: false,
  orden: null,
})

// Parte del estado previo solo si es de la misma cuenta y módulo.
const base = (previo: Estado | null, clave: string): Estado =>
  previo?.clave === clave ? previo : vacio(clave)

const noop = () => Promise.resolve()

export function useLampara(dispositivoId: string): Lampara {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const lampara = servicios.lampara
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const habilitado = backendConfigurado && usuarioId !== null
  const clave = habilitado ? JSON.stringify([usuarioId, dispositivoId]) : ''
  const [estado, setEstado] = useState<Estado | null>(null)

  // Clave vigente (vacía al desmontar), solicitud en curso y versión de la
  // orden: una consulta iniciada antes de una solicitud no la pisa.
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
    const control = { vigente: true, enCurso: false }

    const consultar = async () => {
      if (!control.vigente || control.enCurso) return // sin consultas superpuestas
      control.enCurso = true
      const versionInicial = version.current
      let r
      try {
        r = await lampara.obtenerUltimaOrdenLampara(dispositivoId)
      } catch {
        r = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      // Desmontaje, cambio de cuenta o módulo, o solicitud posterior.
      if (!control.vigente || version.current !== versionInicial) return
      setEstado((previo) => {
        const b = base(previo, clave)
        if (r.ok) return { ...b, resuelta: true, fallo: false, orden: r.datos }
        // Conserva la última orden de esta misma cuenta, nunca de otra.
        return { ...b, resuelta: true, fallo: true }
      })
    }

    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_CONSULTA_LAMPARA_MS)
    return () => {
      control.vigente = false
      clearInterval(id)
    }
  }, [habilitado, lampara, dispositivoId, clave])

  const solicitar = useCallback(
    async (nivel: number) => {
      if (!habilitado || claveEnviando.current === clave) return
      claveEnviando.current = clave
      setEstado((previo) => ({
        ...base(previo, clave),
        enviando: true,
        falloEnvio: false,
      }))
      let r
      try {
        r = await lampara.solicitarLampara(dispositivoId, nivel)
      } catch {
        r = { ok: false as const, error: '' }
      }
      if (claveEnviando.current === clave) claveEnviando.current = null
      if (claveVigente.current !== clave) return // otra cuenta o desmontado
      const nueva = r.ok ? r.datos : null
      if (nueva) version.current += 1
      setEstado((previo) => {
        const b = base(previo, clave)
        return nueva
          ? { ...b, enviando: false, falloEnvio: false, fallo: false, orden: nueva }
          : { ...b, enviando: false, falloEnvio: true }
      })
    },
    [habilitado, clave, lampara, dispositivoId],
  )

  if (!habilitado) {
    return {
      activo: false,
      cargando: false,
      fallo: false,
      enviando: false,
      falloEnvio: false,
      orden: null,
      solicitar: noop,
    }
  }
  const e = estado === null || estado.clave !== clave ? vacio(clave) : estado
  return {
    activo: true,
    cargando: !e.resuelta && e.orden === null,
    fallo: e.fallo,
    enviando: e.enviando,
    falloEnvio: e.falloEnvio,
    orden: e.orden,
    solicitar,
  }
}
