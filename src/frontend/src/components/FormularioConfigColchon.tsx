import { useEffect, useState, type FormEvent } from 'react'
import type { ConfigColchon } from '../models/colchon.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { validarConfigColchon } from '../utils/colchon.ts'

type Props = {
  dispositivoId: string
  /** Avisa la configuración guardada en el servidor (null si no hay). */
  alCambiar: (config: ConfigColchon | null) => void
}

type Textos = { duracion_s: string; tolerancia_pct: string; alarma_s: string }

const VACIOS: Textos = { duracion_s: '', tolerancia_pct: '', alarma_s: '' }

const aTextos = (c: ConfigColchon): Textos => ({
  duracion_s: String(c.duracion_s),
  tolerancia_pct: String(c.tolerancia_pct),
  alarma_s: String(c.alarma_s),
})

/**
 * Duración, tolerancia y duración de la alarma del colchón. Se muestra lo
 * guardado en el servidor; sin configuración guardada los campos quedan
 * vacíos. Un valor inválido no cambia lo guardado.
 */
function FormularioConfigColchon({ dispositivoId, alCambiar }: Props) {
  const { servicios } = useServicios()
  const [guardada, setGuardada] = useState<ConfigColchon | null | undefined>(undefined)
  const [textos, setTextos] = useState<Textos>(VACIOS)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    servicios.colchon.obtenerConfig(dispositivoId).then((r) => {
      if (!vigente) return
      if (!r.ok) return setError(r.error)
      setGuardada(r.datos)
      alCambiar(r.datos)
      if (r.datos) setTextos(aTextos(r.datos))
    })
    return () => {
      vigente = false
    }
  }, [servicios, dispositivoId, alCambiar])

  async function alGuardar(evento: FormEvent) {
    evento.preventDefault()
    if (guardando) return
    setAviso(null)
    const v = validarConfigColchon(textos)
    if (!v.ok) return setError(v.error)
    setError(null)
    setGuardando(true)
    const r = await servicios.colchon.guardarConfig(dispositivoId, v.config)
    setGuardando(false)
    if (!r.ok) return setError(r.error)
    setGuardada(r.datos)
    setTextos(aTextos(r.datos))
    alCambiar(r.datos)
    setAviso('Configuración guardada.')
  }

  return (
    <form onSubmit={alGuardar} noValidate aria-label="Configuración del monitoreo">
      {guardada === undefined && !error && <p role="status">Cargando configuración…</p>}
      {guardada === null && <p>Todavía no hay configuración guardada.</p>}
      <label>
        Duración del monitoreo (segundos)
        <input
          type="text"
          inputMode="numeric"
          value={textos.duracion_s}
          onChange={(e) => setTextos((t) => ({ ...t, duracion_s: e.target.value }))}
        />
      </label>
      <label>
        Tolerancia de pérdida de peso (%)
        <input
          type="text"
          inputMode="decimal"
          value={textos.tolerancia_pct}
          onChange={(e) => setTextos((t) => ({ ...t, tolerancia_pct: e.target.value }))}
        />
      </label>
      <label>
        Duración de la alarma (segundos, hasta 60)
        <input
          type="text"
          inputMode="numeric"
          value={textos.alarma_s}
          onChange={(e) => setTextos((t) => ({ ...t, alarma_s: e.target.value }))}
        />
      </label>
      <button type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar configuración'}
      </button>
      {error && <p role="alert">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </form>
  )
}

export default FormularioConfigColchon
