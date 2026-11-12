import { useEffect, useState } from 'react'
import type { LecturaAmbiental } from '../models/contrato.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_CONSULTA_MS = 10_000

export type UltimaAmbiental = {
  /** false cuando no hay consulta real (maqueta o sin sesión). */
  activo: boolean
  /** Primera consulta de esta sesión y dispositivo todavía pendiente. */
  cargando: boolean
  /** La consulta más reciente falló. */
  fallo: boolean
  lectura: LecturaAmbiental | null
}

type Estado = {
  // Identifica usuario + dispositivo: un estado de otra clave nunca se muestra.
  clave: string
  resuelta: boolean
  fallo: boolean
  lectura: LecturaAmbiental | null
}

const INACTIVO: UltimaAmbiental = {
  activo: false,
  cargando: false,
  fallo: false,
  lectura: null,
}

export function useUltimaAmbiental(dispositivoId: string): UltimaAmbiental {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const lecturas = servicios.lecturas
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const habilitado = backendConfigurado && usuarioId !== null
  const clave = habilitado ? JSON.stringify([usuarioId, dispositivoId]) : ''
  const [estado, setEstado] = useState<Estado | null>(null)

  useEffect(() => {
    if (!habilitado) return
    const control = { vigente: true, enCurso: false }

    const consultar = async () => {
      if (!control.vigente || control.enCurso) return // sin consultas superpuestas
      control.enCurso = true
      let r
      try {
        r = await lecturas.obtenerUltimaAmbiental(dispositivoId)
      } catch {
        r = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente) return // desmontaje, cambio de sesión o de dispositivo
      setEstado((previo) => {
        const mismaClave = previo?.clave === clave
        if (r.ok) {
          return { clave, resuelta: true, fallo: false, lectura: r.datos }
        }
        return {
          clave,
          resuelta: true,
          fallo: true,
          // Conserva la última lectura de esta misma sesión, nunca de otra.
          lectura: mismaClave ? previo.lectura : null,
        }
      })
    }

    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_CONSULTA_MS)
    return () => {
      control.vigente = false
      clearInterval(id)
    }
  }, [habilitado, lecturas, dispositivoId, clave])

  if (!habilitado) return INACTIVO
  if (estado === null || estado.clave !== clave) {
    return { activo: true, cargando: true, fallo: false, lectura: null }
  }
  return {
    activo: true,
    cargando: !estado.resuelta,
    fallo: estado.fallo,
    lectura: estado.lectura,
  }
}
