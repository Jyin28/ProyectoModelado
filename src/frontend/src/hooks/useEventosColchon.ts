import { useEffect, useState } from 'react'
import type { EventoColchon } from '../models/colchon.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_EVENTOS_COLCHON_MS = 5_000
export const LIMITE_EVENTOS_COLCHON = 10

type Interno = {
  // Usuario + módulo: los eventos de otra clave nunca se muestran.
  clave: string
  resuelto: boolean
  fallo: boolean
  eventos: EventoColchon[]
}

/** Eventos recientes del colchón, con consulta cada 5 s mientras hay sesión. */
export function useEventosColchon(dispositivoId: string) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const activo = backendConfigurado && usuarioId !== null
  const clave = activo ? JSON.stringify([usuarioId, dispositivoId]) : ''
  const [interno, setInterno] = useState<Interno | null>(null)

  useEffect(() => {
    if (!activo) return
    const control = { vigente: true, enCurso: false }
    const consultar = async () => {
      if (!control.vigente || control.enCurso) return
      control.enCurso = true
      let r
      try {
        r = await servicios.colchon.listarEventos(dispositivoId, LIMITE_EVENTOS_COLCHON)
      } catch {
        r = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente) return
      setInterno((previo) => {
        const base = previo?.clave === clave ? previo : { clave, resuelto: false, fallo: false, eventos: [] }
        return {
          ...base,
          resuelto: true,
          fallo: !r.ok,
          eventos: r.ok ? r.datos : base.eventos,
        }
      })
    }
    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_EVENTOS_COLCHON_MS)
    return () => {
      control.vigente = false
      clearInterval(id)
    }
  }, [activo, servicios, dispositivoId, clave])

  if (!activo) return { activo: false, cargando: false, fallo: false, eventos: [] as EventoColchon[] }
  const e = interno !== null && interno.clave === clave ? interno : null
  return {
    activo: true,
    cargando: e === null || !e.resuelto,
    fallo: e?.fallo ?? false,
    eventos: e?.eventos ?? [],
  }
}
