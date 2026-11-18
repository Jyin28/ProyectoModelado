import { useState, type FormEvent } from 'react'
import { useOrdenModulo } from '../hooks/useOrdenModulo.ts'
import {
  COMANDOS_FIGURAS,
  LED_INDICE_MAX,
  NOMBRE_SECUENCIA,
  SECUENCIAS_LED,
  type SecuenciaLed,
} from '../models/ordenes.ts'
import { MENSAJE_INTERVALO, parsearIntervalo } from '../utils/ordenes.ts'
import EstadoOrdenModulo from './EstadoOrdenModulo.tsx'
import PanelHorarios from './PanelHorarios.tsx'

type Props = { dispositivoId: string }

const LEDS = Array.from({ length: LED_INDICE_MAX + 1 }, (_, i) => i)

/**
 * Control de las figuras LED. Solo se monta con VITE_ORDENES_HABILITADAS=true.
 * Los LED se muestran solo como lo que la Pico confirmó; nunca como luz
 * física comprobada.
 */
function PanelFiguras({ dispositivoId }: Props) {
  const { activo, cargando, fallo, enviando, errorEnvio, orden, estado, solicitar } =
    useOrdenModulo(dispositivoId, COMANDOS_FIGURAS)
  const [nombre, setNombre] = useState<SecuenciaLed>('chase')
  const [intervalo, setIntervalo] = useState('')
  const [invalido, setInvalido] = useState(false)
  const [indice, setIndice] = useState('0')

  if (!activo) return null

  const secuencia = estado?.estado.secuencia
  const confirmada =
    estado === null || estado.actualizado_en === null
      ? 'Sin confirmación de la Pico.'
      : typeof secuencia === 'string'
        ? `Secuencia activa confirmada por la Pico: ${NOMBRE_SECUENCIA[secuencia as SecuenciaLed] ?? secuencia}.`
        : 'La Pico confirmó que no hay una secuencia activa.'

  function alSecuencia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const paso = parsearIntervalo(intervalo)
    setInvalido(paso === null)
    if (paso === null) return
    void solicitar({ command: 'led_sequence', params: { name: nombre, step_s: paso } })
  }

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-figuras">
      <h2 id="titulo-panel-figuras">Control de las figuras</h2>
      <p>
        Las órdenes llegan a la Pico y se muestran como confirmadas solo cuando
        ella lo informa. Una confirmación no comprueba que la luz esté
        encendida.
      </p>
      <div role="group" aria-label="Todos los LED">
        <button type="button" disabled={enviando}
          onClick={() => void solicitar({ command: 'led_all', params: { on: true } })}>
          Encender todos
        </button>
        <button type="button" disabled={enviando}
          onClick={() => void solicitar({ command: 'led_all', params: { on: false } })}>
          Apagar todos
        </button>
        <button type="button" disabled={enviando}
          onClick={() => void solicitar({ command: 'led_stop', params: {} })}>
          Detener secuencia
        </button>
      </div>
      <div role="group" aria-label="Un LED">
        <label>
          LED
          <select value={indice} onChange={(e) => setIndice(e.target.value)}>
            {LEDS.map((i) => (
              <option key={i} value={i}>
                Figura {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={enviando}
          onClick={() => void solicitar({ command: 'led_set', params: { index: Number(indice), on: true } })}>
          Encender la figura
        </button>
        <button type="button" disabled={enviando}
          onClick={() => void solicitar({ command: 'led_set', params: { index: Number(indice), on: false } })}>
          Apagar la figura
        </button>
      </div>
      <form onSubmit={alSecuencia} noValidate aria-label="Secuencia">
        <label>
          Secuencia
          <select value={nombre} onChange={(e) => setNombre(e.target.value as SecuenciaLed)}>
            {SECUENCIAS_LED.map((s) => (
              <option key={s} value={s}>
                {NOMBRE_SECUENCIA[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Intervalo entre pasos (segundos, mínimo 2)
          <input
            type="text"
            inputMode="decimal"
            value={intervalo}
            onChange={(e) => setIntervalo(e.target.value)}
            aria-invalid={invalido}
          />
        </label>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Iniciar secuencia'}
        </button>
        {invalido && <p role="alert">{MENSAJE_INTERVALO}</p>}
      </form>
      <p role="status">{confirmada}</p>
      <EstadoOrdenModulo orden={orden} cargando={cargando} fallo={fallo} errorEnvio={errorEnvio} />
      <PanelHorarios
        dispositivoId={dispositivoId}
        tipo="figuras_encender"
        titulo="Encender figuras"
        descripcion="A cada hora se pide encender todas las figuras."
      />
      <PanelHorarios
        dispositivoId={dispositivoId}
        tipo="figuras_apagar"
        titulo="Apagar figuras"
        descripcion="A cada hora se pide apagar todas las figuras."
      />
    </section>
  )
}

export default PanelFiguras
