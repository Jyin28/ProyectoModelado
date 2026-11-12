import { useEffect, useState } from 'react'
import type { EventoMovimiento } from '../models/contrato.ts'
import { INTERVALO_CONSULTA_MS } from './useUltimaAmbiental.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export type UltimoMovimiento = {
  /** false cuando no hay consulta real (deshabilitado, maqueta o sin sesión). */
  activo: boolean
  /** Primera consulta de esta sesión y dispositivo todavía pendiente. */
  cargando: boolean
  /** La consulta más reciente falló. */
  fallo: boolean
  evento: EventoMovimiento | null
}

type Estado = {
  // Identifica usuario + dispositivo: un estado de otra clave nunca se muestra.
  clave: string
  fallo: boolean
  evento: EventoMovimiento | null
}

const INACTIVO: UltimoMovimiento = {
  activo: false,
  cargando: false,
  fallo: false,
  evento: null,
}

export function useUltimoMovimiento(
  dispositivoId: string,
  habilitadoPorConfiguracion: boolean,
): UltimoMovimiento {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const lecturas = servicios.lecturas
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const habilitado =
    habilitadoPorConfiguracion && backendConfigurado && usuarioId !== null
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
        r = await lecturas.obtenerUltimoMovimiento(dispositivoId)
      } catch {
        r = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente) return // desmontaje, cambio de sesión o de dispositivo
      setEstado((previo) => {
        if (r.ok) return { clave, fallo: false, evento: r.datos }
        return {
          clave,
          fallo: true,
          // Conserva el último evento de esta misma sesión, nunca de otra.
          evento: previo?.clave === clave ? previo.evento : null,
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
    return { activo: true, cargando: true, fallo: false, evento: null }
  }
  return { activo: true, cargando: false, fallo: estado.fallo, evento: estado.evento }
}
