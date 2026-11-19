import { useEffect, useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import type { LimitesAmbiente } from '../models/ordenes.ts'
import { validarLimites } from '../utils/ordenes.ts'
import RangoDoble from './RangoDoble.tsx'
import './PanelLimites.css'

type Props = { dispositivoId: string }

const CAMPOS = [
  { clave: 'temp_min', etiqueta: 'Temperatura mínima (°C)' },
  { clave: 'temp_max', etiqueta: 'Temperatura máxima (°C)' },
  { clave: 'hum_min', etiqueta: 'Humedad mínima (%)' },
  { clave: 'hum_max', etiqueta: 'Humedad máxima (%)' },
] as const

type Textos = Record<(typeof CAMPOS)[number]['clave'], string>

/** Número de un texto escrito (acepta coma decimal); null si no es un número. */
function aNumeroLibre(texto: string): number | null {
  const n = Number(texto.trim().replace(',', '.'))
  return texto.trim() === '' || Number.isNaN(n) ? null : n
}

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
  const [manual, setManual] = useState(false)

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

  const cambiar = (min: keyof Textos, max: keyof Textos) => (a: number, b: number) => {
    setAviso(null)
    setError(null)
    setTextos((t) => ({ ...t, [min]: String(a), [max]: String(b) }))
  }

  return (
    <section className="panel-modulo panel-limites" aria-labelledby="titulo-panel-limites">
      <h2 id="titulo-panel-limites">Límites de ambiente</h2>
      <p className="panel-limites-ayuda">
        Cuando la temperatura o la humedad salen de estos límites, los
        destinatarios de Telegram reciben un aviso. Mientras siga fuera de rango
        no se repite; si vuelve al rango y sale otra vez, se avisa de nuevo.
      </p>
      {guardados === undefined && !error && <p role="status">Cargando límites…</p>}
      {guardados === null && <p>Todavía no hay límites guardados.</p>}
      <form onSubmit={alGuardar} noValidate aria-label="Límites de ambiente">
        <div className="panel-limites-rangos">
          <RangoDoble
            titulo="Temperatura"
            etiquetaMinimo="Límite inferior de temperatura"
            etiquetaMaximo="Límite superior de temperatura"
            desde={0}
            hasta={50}
            paso={0.5}
            decimales={1}
            unidad="°C"
            minimo={aNumeroLibre(textos.temp_min)}
            maximo={aNumeroLibre(textos.temp_max)}
            alCambiar={cambiar('temp_min', 'temp_max')}
          />
          <RangoDoble
            titulo="Humedad"
            etiquetaMinimo="Límite inferior de humedad"
            etiquetaMaximo="Límite superior de humedad"
            desde={0}
            hasta={100}
            paso={1}
            unidad="%"
            minimo={aNumeroLibre(textos.hum_min)}
            maximo={aNumeroLibre(textos.hum_max)}
            alCambiar={cambiar('hum_min', 'hum_max')}
          />
        </div>
        <div className="panel-limites-acciones">
          <button
            type="button"
            aria-expanded={manual}
            aria-controls="limites-manuales"
            onClick={() => setManual((m) => !m)}
          >
            {manual ? 'Ocultar valores escritos' : 'Escribir valores'}
          </button>
          <button type="submit" className="boton-primario" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar límites'}
          </button>
        </div>
        {manual && (
          <div id="limites-manuales" className="panel-limites-manual">
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
          </div>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  )
}

export default PanelLimites
