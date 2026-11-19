import { useId } from 'react'
import { horaValida } from '../utils/ordenes.ts'
import './SelectorHora.css'

type Props = {
  /** Texto visible y nombre accesible del campo de hora. */
  etiqueta: string
  /** Hora «HH:MM» de 24 h, o '' si todavía no se eligió. */
  valor: string
  alCambiar: (nueva: string) => void
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/**
 * Elige hora y minutos con el dedo (rejillas de botones grandes) o escribiendo
 * en el campo de hora con el teclado. Muestra la hora elegida en grande. El
 * valor es siempre «HH:MM», el formato que usa el servicio.
 */
function SelectorHora({ etiqueta, valor, alCambiar }: Props) {
  const idCampo = useId()
  const valida = horaValida(valor)
  const hora = valida ? valor.slice(0, 2) : null
  const minuto = valida ? valor.slice(3, 5) : null

  function elegirHora(h: string) {
    alCambiar(`${h}:${minuto ?? '00'}`)
  }

  function elegirMinuto(m: string) {
    alCambiar(`${hora ?? '00'}:${m}`)
  }

  return (
    <div className="selector-hora">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <div className="selector-hora-fila">
        <input
          id={idCampo}
          type="time"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
        />
        <p className="selector-hora-elegida" aria-live="polite">
          {valida ? `Hora elegida: ${valor}` : 'Hora elegida: sin elegir'}
        </p>
      </div>
      <div role="group" aria-label="Hora" className="selector-hora-rejilla selector-hora-horas">
        {HORAS.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={hora === h}
            aria-label={`Hora ${h}`}
            onClick={() => elegirHora(h)}
          >
            {h}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Minutos" className="selector-hora-rejilla selector-hora-minutos">
        {MINUTOS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={minuto === m}
            aria-label={`Minutos ${m}`}
            onClick={() => elegirMinuto(m)}
          >
            :{m}
          </button>
        ))}
      </div>
      <p className="selector-hora-ayuda">
        Para otro minuto, escríbelo en el campo de hora.
      </p>
    </div>
  )
}

export default SelectorHora
