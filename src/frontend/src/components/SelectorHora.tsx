import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { horaValida } from '../utils/ordenes.ts'
import './SelectorHora.css'

type Props = {
  /** Texto visible y nombre accesible del selector. */
  etiqueta: string
  /** Hora «HH:MM» de 24 h, o '' si todavía no se eligió. */
  valor: string
  alCambiar: (nueva: string) => void
}

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

/** Alto de cada fila de la rueda; debe coincidir con --alto-fila de SelectorHora.css. */
const ALTO_FILA = 38
/** Tras el último desplazamiento, la rueda espera este tiempo para dar por elegida la fila centrada. */
const REPOSO_MS = 100

type RuedaProps = {
  nombre: string
  opciones: string[]
  elegida: string | null
  /** Cuántas filas salta PageUp/PageDown. */
  salto: number
  alElegir: (opcion: string) => void
}

/**
 * Una rueda de desplazamiento vertical con ajuste a la fila centrada, como la
 * de la app de alarma del iPhone. Se elige girándola con el dedo o la rueda
 * del ratón, tocando una fila o con el teclado (flechas, Re Pág, Av Pág,
 * Inicio y Fin).
 */
function Rueda({ nombre, opciones, elegida, salto, alElegir }: RuedaProps) {
  const base = useId()
  const rueda = useRef<HTMLDivElement>(null)
  const girando = useRef(false)
  const montada = useRef(false)
  const reposo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alElegirActual = useRef(alElegir)
  const indice = elegida === null ? 0 : Math.max(0, opciones.indexOf(elegida))

  useEffect(() => {
    alElegirActual.current = alElegir
  }, [alElegir])

  // La rueda sigue al valor cuando este cambia desde fuera (un toque, el teclado o el padre).
  useEffect(() => {
    const el = rueda.current
    if (!el || girando.current) return
    const destino = indice * ALTO_FILA
    const primera = !montada.current
    montada.current = true
    if (Math.abs(el.scrollTop - destino) <= 1) return
    // Al abrir, la rueda aparece ya en su sitio; después se desliza hasta el valor nuevo.
    if (!primera && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: destino, behavior: 'smooth' })
    } else el.scrollTop = destino
  }, [indice])

  useEffect(() => () => clearTimeout(reposo.current), [])

  function alDesplazar() {
    const el = rueda.current
    if (!el) return
    girando.current = true
    clearTimeout(reposo.current)
    reposo.current = setTimeout(() => {
      girando.current = false
      const fila = Math.min(opciones.length - 1, Math.max(0, Math.round(el.scrollTop / ALTO_FILA)))
      if (opciones[fila] !== elegida) alElegirActual.current(opciones[fila])
    }, REPOSO_MS)
  }

  function mover(destino: number) {
    const fila = Math.min(opciones.length - 1, Math.max(0, destino))
    alElegir(opciones[fila])
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const teclas: Record<string, number> = {
      ArrowUp: indice - 1,
      ArrowDown: indice + 1,
      PageUp: indice - salto,
      PageDown: indice + salto,
      Home: 0,
      End: opciones.length - 1,
    }
    const destino = teclas[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    mover(destino)
  }

  return (
    <div
      ref={rueda}
      className="rueda"
      role="listbox"
      tabIndex={0}
      aria-label={nombre}
      aria-activedescendant={elegida === null ? undefined : `${base}-${elegida}`}
      onScroll={alDesplazar}
      onKeyDown={alTeclear}
    >
      {opciones.map((opcion) => (
        <div
          key={opcion}
          id={`${base}-${opcion}`}
          role="option"
          aria-selected={elegida === opcion}
          aria-label={`${nombre} ${opcion}`}
          className="rueda-fila"
          onClick={() => alElegir(opcion)}
        >
          {opcion}
        </div>
      ))}
    </div>
  )
}

/**
 * Elige hora y minutos con dos ruedas lado a lado, como en la app de alarma del
 * iPhone, y muestra la hora elegida debajo. El valor es siempre «HH:MM» de 24 h,
 * el formato que usa el servicio.
 */
function SelectorHora({ etiqueta, valor, alCambiar }: Props) {
  const valida = horaValida(valor)
  const hora = valida ? valor.slice(0, 2) : null
  const minuto = valida ? valor.slice(3, 5) : null

  return (
    <div className="selector-hora" role="group" aria-label={etiqueta}>
      <div className="selector-hora-ruedas">
        <div className="selector-hora-banda" aria-hidden="true" />
        <Rueda
          nombre="Hora"
          opciones={HORAS}
          elegida={hora}
          salto={6}
          alElegir={(h) => alCambiar(`${h}:${minuto ?? '00'}`)}
        />
        <span className="selector-hora-separador" aria-hidden="true">
          :
        </span>
        <Rueda
          nombre="Minutos"
          opciones={MINUTOS}
          elegida={minuto}
          salto={10}
          alElegir={(m) => alCambiar(`${hora ?? '00'}:${m}`)}
        />
      </div>
      <p className="selector-hora-elegida" aria-live="polite">
        {valida ? `Hora elegida: ${valor}` : 'Hora elegida: sin elegir'}
      </p>
    </div>
  )
}

export default SelectorHora
