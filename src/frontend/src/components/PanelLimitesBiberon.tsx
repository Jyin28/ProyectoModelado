import { useEffect, useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import type { LimitesBiberon } from '../models/alimentacion.ts'
import { validarLimitesBiberon } from '../utils/alimentacion.ts'

type Props = { dispositivoId: string }

/**
 * Límites de frío y de calor del biberón. Al salir de rango se avisa por
 * Telegram una sola vez por episodio y por lado. No hay límites por defecto:
 * sin límites guardados no hay avisos. Un valor inválido no cambia los guardados.
 */
function PanelLimitesBiberon({ dispositivoId }: Props) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const activo = backendConfigurado && sesion.tipo === 'autenticado'
  const [guardados, setGuardados] = useState<LimitesBiberon | null | undefined>(undefined)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!activo) return
    let vigente = true
    servicios.alimentacion.obtenerLimites(dispositivoId).then((r) => {
      if (!vigente) return
      if (!r.ok) return setError(r.error)
      setGuardados(r.datos)
      if (r.datos) {
        setMin(String(r.datos.temp_min))
        setMax(String(r.datos.temp_max))
      }
    })
    return () => {
      vigente = false
    }
  }, [activo, servicios, dispositivoId])

  if (!activo) return null

  async function alGuardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setAviso(null)
    const v = validarLimitesBiberon(min, max)
    if (!v.ok) return setError(v.error)
    setError(null)
    setGuardando(true)
    let r
    try {
      r = await servicios.alimentacion.guardarLimites(dispositivoId, v.limites)
    } catch {
      r = { ok: false as const, error: 'No se pudieron guardar los límites.' }
    }
    setGuardando(false)
    if (!r.ok) return setError(r.error)
    setGuardados(r.datos)
    setMin(String(r.datos.temp_min))
    setMax(String(r.datos.temp_max))
    setAviso('Límites guardados.')
  }

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-limites-biberon">
      <h2 id="titulo-panel-limites-biberon">Límites de temperatura del biberón</h2>
      <p>
        Si el biberón queda por debajo del mínimo o por encima del máximo, los
        destinatarios de Telegram reciben un aviso. Mientras siga fuera de ese
        lado no se repite; si pasa al otro lado, se avisa de nuevo. El
        dispositivo solo mide: no calienta ni enfría el biberón.
      </p>
      {guardados === undefined && !error && <p role="status">Cargando límites…</p>}
      {guardados === null && <p>Todavía no hay límites guardados.</p>}
      <form onSubmit={alGuardar} noValidate aria-label="Límites del biberón">
        <label>
          Temperatura mínima (°C)
          <input type="text" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        <label>
          Temperatura máxima (°C)
          <input type="text" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar límites del biberón'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  )
}

export default PanelLimitesBiberon
