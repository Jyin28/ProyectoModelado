import { useEffect, useState } from 'react'
import { useAhora } from '../hooks/useAhora.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import { TEMP_BIBERON_UMBRAL_S, type LecturaTemperatura } from '../models/alimentacion.ts'
import { formatearGrados } from '../utils/alimentacion.ts'
import { antiguedadSegundos, describirAntiguedad, estaDesactualizado, formatearHoraCR } from '../utils/tiempo.ts'

type Props = { dispositivoId: string }

export const INTERVALO_TEMPERATURA_MS = 10_000

type Interno = { clave: string; resuelto: boolean; fallo: boolean; lectura: LecturaTemperatura | null }

/**
 * Última temperatura del biberón que informó la Pico. Sin lectura se muestra
 * «Sin datos»; con una lectura vieja, «Desactualizado» (la Pico mide cada 30 s).
 * La web nunca estima ni rellena un valor.
 */
function PanelTemperaturaBiberon({ dispositivoId }: Props) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const usuarioId = sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const activo = backendConfigurado && usuarioId !== null
  const clave = activo ? JSON.stringify([usuarioId, dispositivoId]) : ''
  const [interno, setInterno] = useState<Interno | null>(null)
  const ahora = useAhora(1000)

  useEffect(() => {
    if (!activo) return
    const control = { vigente: true, enCurso: false }
    const consultar = async () => {
      if (!control.vigente || control.enCurso) return
      control.enCurso = true
      let r
      try {
        r = await servicios.alimentacion.ultimaTemperatura(dispositivoId)
      } catch {
        r = { ok: false as const, error: '' }
      } finally {
        control.enCurso = false
      }
      if (!control.vigente) return
      setInterno((previo) => {
        const base = previo?.clave === clave ? previo : { clave, resuelto: false, fallo: false, lectura: null }
        return {
          ...base,
          resuelto: true,
          fallo: !r.ok,
          lectura: r.ok ? r.datos : base.lectura,
        }
      })
    }
    void consultar()
    const id = setInterval(() => void consultar(), INTERVALO_TEMPERATURA_MS)
    return () => {
      control.vigente = false
      clearInterval(id)
    }
  }, [activo, servicios, dispositivoId, clave])

  if (!activo) return null
  const e = interno !== null && interno.clave === clave ? interno : null
  const lectura = e?.lectura ?? null
  const viejo = lectura !== null && estaDesactualizado(lectura.ts, ahora, TEMP_BIBERON_UMBRAL_S)

  return (
    <section className="panel-modulo" aria-labelledby="titulo-temperatura-biberon">
      <h2 id="titulo-temperatura-biberon">Temperatura del biberón</h2>
      {e === null || !e.resuelto ? (
        <p role="status">Consultando la temperatura…</p>
      ) : (
        <>
          {e.fallo && <p role="alert">No se pudo consultar la temperatura del biberón.</p>}
          {lectura === null ? (
            <p data-testid="temperatura-biberon">Sin datos</p>
          ) : (
            <p data-testid="temperatura-biberon" data-desactualizado={viejo}>
              {viejo && <strong>Desactualizado. </strong>}
              Última lectura: {formatearGrados(lectura.valor)}, {formatearHoraCR(lectura.ts)} (
              {describirAntiguedad(antiguedadSegundos(lectura.ts, ahora))}).
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default PanelTemperaturaBiberon
