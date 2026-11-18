import { useCallback, useEffect, useState } from 'react'
import type { EventoHabitacion, FotoHabitacion } from '../models/habitacion.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_HABITACION_MS = 5_000
export const LIMITE_HABITACION = 20

type Interno = {
  // Usuario + módulo: los datos de otra clave nunca se muestran.
  clave: string
  resuelto: boolean
  fallo: boolean
  eventos: EventoHabitacion[]
  fotos: FotoHabitacion[]
}

/**
 * Eventos y solicitudes de foto de la habitación, con consulta cada 5 s
 * mientras hay sesión. `refrescar` vuelve a consultar de inmediato.
 */
export function useHabitacion(dispositivoId: string) {
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
      let eventos
      let fotos
      try {
        ;[eventos, fotos] = await Promise.all([
          servicios.habitacion.listarEventos(dispositivoId, LIMITE_HABITACION),
          servicios.habitacion.listarFotos(dispositivoId, LIMITE_HABITACION),
        ])
      } catch {
        eventos = { ok: false as const, error: '' }
        fotos = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente) return
      setInterno((previo) => {
        const base: Interno =
          previo?.clave === clave
            ? previo
            : { clave, resuelto: false, fallo: false, eventos: [], fotos: [] }
        return {
          ...base,
          resuelto: true,
          fallo: !eventos.ok || !fotos.ok,
          eventos: eventos.ok ? eventos.datos : base.eventos,
          fotos: fotos.ok ? fotos.datos : base.fotos,
        }
      })
    }
    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_HABITACION_MS)
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
      eventos: [] as EventoHabitacion[],
      fotos: [] as FotoHabitacion[],
      refrescar,
    }
  }
  const e = interno !== null && interno.clave === clave ? interno : null
  return {
    activo: true,
    cargando: e === null || !e.resuelto,
    fallo: e?.fallo ?? false,
    eventos: e?.eventos ?? [],
    fotos: e?.fotos ?? [],
    refrescar,
  }
}
