import { useState } from 'react'
import { useOrdenModulo } from '../hooks/useOrdenModulo.ts'
import { CATALOGO_AUDIO, COMANDOS_AUDIO } from '../models/ordenes.ts'
import EstadoOrdenModulo from './EstadoOrdenModulo.tsx'

type Props = { dispositivoId: string }

/**
 * Audio de la cuna. Solo se monta con VITE_ORDENES_HABILITADAS=true. El
 * catálogo es el que la Pico tiene hoy (un tono sintetizado). La reproducción
 * confirmada queda registrada como actividad, sin guardar sonido.
 */
function PanelAudio({ dispositivoId }: Props) {
  const { activo, cargando, fallo, enviando, errorEnvio, orden, solicitar } =
    useOrdenModulo(dispositivoId, COMANDOS_AUDIO)
  const [sonido, setSonido] = useState<string>(CATALOGO_AUDIO[0].id)

  if (!activo) return null

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-audio">
      <h2 id="titulo-panel-audio">Audio de la cuna</h2>
      <p>
        La Pico confirma cuándo empieza a reproducir. Una confirmación no
        comprueba que el parlante suene.
      </p>
      <label>
        Sonido
        <select value={sonido} onChange={(e) => setSonido(e.target.value)}>
          {CATALOGO_AUDIO.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={enviando}
        onClick={() => void solicitar({ command: 'audio_play', params: { sound: sonido } })}
      >
        Reproducir
      </button>
      <button
        type="button"
        disabled={enviando}
        onClick={() => void solicitar({ command: 'audio_stop', params: {} })}
      >
        Detener audio
      </button>
      <EstadoOrdenModulo orden={orden} cargando={cargando} fallo={fallo} errorEnvio={errorEnvio} />
    </section>
  )
}

export default PanelAudio
