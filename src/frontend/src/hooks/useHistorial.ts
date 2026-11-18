import { useEffect, useState } from 'react'
import type { Intervalo, RespuestaHistorial } from '../models/historial.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

type Interno = {
  // Usuario + bebé + intervalo + intento: una respuesta de otra clave nunca se muestra.
  clave: string
  error: string | null
  datos: RespuestaHistorial | null
}

export interface ConsultaHistorial {
  bebeId: string
  intervalo: Intervalo
}

/**
 * Historial de un bebé en un intervalo. Consulta una vez cada vez que cambia la
 * consulta (o se pide recargar); no hay actualización periódica, porque el
 * resumen de una noche no cambia mientras se lee.
 */
export function useHistorial(consulta: ConsultaHistorial | null) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const [intento, setIntento] = useState(0)
  const activo = backendConfigurado && usuarioId !== null && consulta !== null
  const clave = activo
    ? JSON.stringify([usuarioId, consulta.bebeId, consulta.intervalo.desde, consulta.intervalo.hasta, intento])
    : ''
  const [interno, setInterno] = useState<Interno | null>(null)

  useEffect(() => {
    if (!activo || consulta === null) return
    let vigente = true
    const { bebeId, intervalo } = consulta
    void (async () => {
      let r
      try {
        r = await servicios.historial.consultar(bebeId, intervalo.desde, intervalo.hasta)
      } catch {
        r = { ok: false as const, error: 'No se pudo consultar el historial.' }
      }
      if (!vigente) return
      setInterno(
        r.ok
          ? { clave, error: null, datos: r.datos }
          : { clave, error: r.error, datos: null },
      )
    })()
    return () => {
      vigente = false
    }
    // `consulta` se resume en `clave`; no debe reiniciar la consulta si solo cambia su identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, servicios, clave])

  const recargar = () => setIntento((n) => n + 1)
  if (!activo) return { activo: false, cargando: false, error: null, datos: null, recargar }
  const actual = interno !== null && interno.clave === clave ? interno : null
  return {
    activo: true,
    cargando: actual === null,
    error: actual?.error ?? null,
    datos: actual?.datos ?? null,
    recargar,
  }
}
