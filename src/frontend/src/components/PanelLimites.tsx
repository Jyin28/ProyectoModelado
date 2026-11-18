import { useEffect, useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import type { LimitesAmbiente } from '../models/ordenes.ts'
import { validarLimites } from '../utils/ordenes.ts'

type Props = { dispositivoId: string }

const CAMPOS = [
  { clave: 'temp_min', etiqueta: 'Temperatura mínima (°C)' },
  { clave: 'temp_max', etiqueta: 'Temperatura máxima (°C)' },
  { clave: 'hum_min', etiqueta: 'Humedad mínima (%)' },
  { clave: 'hum_max', etiqueta: 'Humedad máxima (%)' },
] as const

type Textos = Record<(typeof CAMPOS)[number]['clave'], string>

const aTextos = (l: LimitesAmbiente): Textos => ({
  temp_min: String(l.temp_min),
  temp_max: String(l.temp_max),
  hum_min: String(l.hum_min),
  hum_max: String(l.hum_max),
})

/**
 * Límites de temperatura y humedad del módulo de ambiente. Al salir de rango
 * se envía un aviso por Telegram una sola vez por episodio. No hay límites
 * por defecto: sin límites guardados no hay avisos por rango. Un valor
 * inválido no cambia los límites guardados.
 */
function PanelLimites({ dispositivoId }: Props) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const activo = backendConfigurado && sesion.tipo === 'autenticado'
  const [guardados, setGuardados] = useState<LimitesAmbiente | null | undefined>(undefined)
  const [textos, setTextos] = useState<Textos>({ temp_min: '', temp_max: '', hum_min: '', hum_max: '' })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!activo) return
    let vigente = true
    servicios.limites.obtener(dispositivoId).then((r) => {
      if (!vigente) return
      if (!r.ok) return setError(r.error)
      setGuardados(r.datos)
      if (r.datos) setTextos(aTextos(r.datos))
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
    const v = validarLimites(textos)
    if (!v.ok) return setError(v.error)
    setError(null)
    setGuardando(true)
    const r = await servicios.limites.guardar(dispositivoId, v.limites)
    setGuardando(false)
    if (!r.ok) return setError(r.error)
    setGuardados(r.datos)
    setTextos(aTextos(r.datos))
    setAviso('Límites guardados.')
  }

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-limites">
      <h2 id="titulo-panel-limites">Límites de ambiente</h2>
      <p>
        Cuando la temperatura o la humedad salen de estos límites, los
        destinatarios de Telegram reciben un aviso. Mientras siga fuera de rango
        no se repite; si vuelve al rango y sale otra vez, se avisa de nuevo.
      </p>
      {guardados === undefined && !error && <p role="status">Cargando límites…</p>}
      {guardados === null && <p>Todavía no hay límites guardados.</p>}
      <form onSubmit={alGuardar} noValidate aria-label="Límites de ambiente">
        {CAMPOS.map(({ clave, etiqueta }) => (
          <label key={clave}>
            {etiqueta}
            <input
              type="text"
              inputMode="decimal"
              value={textos[clave]}
              onChange={(e) => setTextos((t) => ({ ...t, [clave]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar límites'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  )
}

export default PanelLimites
