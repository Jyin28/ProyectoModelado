import { useCallback, useEffect, useState } from 'react'
import type { Toma } from '../models/alimentacion.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_TOMAS_MS = 5_000
export const LIMITE_TOMAS = 20

type Interno = {
  // Usuario + módulo: los datos de otra clave nunca se muestran.
  clave: string
  resuelto: boolean
  fallo: boolean
  tomas: Toma[]
  /** Hora del reloj local en que llegó la última consulta buena. */
  recibidoEn: number
}

/**
 * Tomas del módulo de alimentación, con consulta cada 5 s mientras hay sesión.
 * `refrescar` vuelve a consultar de inmediato (por ejemplo tras una acción).
 */
export function useTomas(dispositivoId: string) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const activo = backendConfigurado && usuarioId !== null
  const clave = activo ? JSON.stringify([usuarioId, dispositivoId]) : ''
  const [interno, setInterno] = useState<Interno | null>(null)
  const [version, setVersion] = useState(0)
  const refrescar = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!activo) return
    const control = { vigente: true, enCurso: false }
    const consultar = async () => {
      if (!control.vigente || control.enCurso) return
      control.enCurso = true
      let r
      try {
        r = await servicios.alimentacion.listarTomas(dispositivoId, LIMITE_TOMAS)
      } catch {
        r = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente) return
      setInterno((previo) => {
        const base: Interno =
          previo?.clave === clave
            ? previo
            : { clave, resuelto: false, fallo: false, tomas: [], recibidoEn: 0 }
        return {
          ...base,
          resuelto: true,
          fallo: !r.ok,
          tomas: r.ok ? r.datos.tomas : base.tomas,
          recibidoEn: r.ok ? Date.now() : base.recibidoEn,
        }
      })
    }
    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_TOMAS_MS)
    return () => {
      control.vigente = false
      clearInterval(id)
    }
  }, [activo, servicios, dispositivoId, clave, version])

  if (!activo) {
    return {
      activo: false,
      cargando: false,
      fallo: false,
      tomas: [] as Toma[],
      recibidoEn: 0,
      refrescar,
    }
  }
  const e = interno !== null && interno.clave === clave ? interno : null
  return {
    activo: true,
    cargando: e === null || !e.resuelto,
    fallo: e?.fallo ?? false,
    tomas: e?.tomas ?? [],
    recibidoEn: e?.recibidoEn ?? 0,
    refrescar,
  }
}
