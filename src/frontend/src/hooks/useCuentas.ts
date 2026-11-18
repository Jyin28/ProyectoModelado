import { useCallback, useEffect, useState } from 'react'
import type {
  Bebe,
  InvitacionDueno,
  ModuloAsociado,
} from '../models/cuentas.ts'
import { useServicios } from './useServicios.ts'

export type EstadoCuentas = {
  cargando: boolean
  /** Mensaje seguro si alguna consulta falló; no se muestran datos parciales. */
  error: string | null
  bebes: Bebe[]
  modulos: ModuloAsociado[]
  invitaciones: InvitacionDueno[]
}

const INICIAL: EstadoCuentas = {
  cargando: true,
  error: null,
  bebes: [],
  modulos: [],
  invitaciones: [],
}

const MENSAJE_CONSULTA = 'No se pudo consultar.'

/** Carga bebés, módulos asociados e invitaciones de la cuenta. */
export function useCuentas(): EstadoCuentas & { recargar: () => void } {
  const { servicios, backendConfigurado } = useServicios()
  const cuentas = servicios.cuentas
  const [estado, setEstado] = useState<EstadoCuentas>(INICIAL)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!backendConfigurado) return
    let activo = true
    Promise.all([
      cuentas.listarBebes(),
      cuentas.listarDispositivos(),
      cuentas.listarInvitaciones(),
    ])
      .then(([bebes, modulos, invitaciones]) => {
        if (!activo) return
        if (!bebes.ok || !modulos.ok || !invitaciones.ok) {
          const fallo = [bebes, modulos, invitaciones].find((r) => !r.ok)
          setEstado({
            ...INICIAL,
            cargando: false,
            error: fallo && !fallo.ok ? fallo.error : MENSAJE_CONSULTA,
          })
          return
        }
        setEstado({
          cargando: false,
          error: null,
          bebes: bebes.datos,
          modulos: modulos.datos,
          invitaciones: invitaciones.datos,
        })
      })
      .catch(() => {
        if (activo) {
          setEstado({ ...INICIAL, cargando: false, error: MENSAJE_CONSULTA })
        }
      })
    return () => {
      activo = false
    }
  }, [cuentas, backendConfigurado, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { ...estado, recargar }
}
