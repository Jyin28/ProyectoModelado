import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  ajustarAlPaso,
  posicionDeValor,
  valorDePosicion,
  type EscalaPerilla,
} from '../utils/perilla.ts'
import './PerillaIntervalo.css'

type Props = {
  /** Valor del borrador; null si todavía no se eligió. */
  valor: number | null
  minimo: number
  maximo: number
  paso: number
  unidad: string
  /** Nombre accesible de la perilla. */
  etiqueta: string
  /** «log» (por defecto) para segundos; «lineal» para porcentajes como el brillo. */
  escala?: EscalaPerilla
  alCambiar: (nuevo: number) => void
}

// La perilla recorre 270°: de -135° (mínimo) a +135° (máximo), con la zona muerta abajo.
const ARCO = 135
const CENTRO = 60
const RADIO = 48

/** Punto del círculo a `grados` desde arriba, en sentido horario. */
function punto(grados: number) {
  const rad = (grados * Math.PI) / 180
  return { x: CENTRO + RADIO * Math.sin(rad), y: CENTRO - RADIO * Math.cos(rad) }
}

/** Trazo de arco entre dos ángulos (siempre horario). */
function arco(desde: number, hasta: number): string {
  const a = punto(desde)
  const b = punto(hasta)
  const grande = hasta - desde > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${RADIO} ${RADIO} 0 ${grande} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

/**
 * Perilla de un valor numérico con unidad: un dial con arco de progreso y el
 * valor al centro. Se opera con arrastre, con teclado (flechas ±paso,
 * PageUp/PageDown ±10 pasos, Inicio/Fin) o con los botones −/+. Solo cambia el
 * borrador: enviar la orden es otra acción.
 */
function PerillaIntervalo({
  valor,
  minimo,
  maximo,
  paso,
  unidad,
  etiqueta,
  escala = 'log',
  alCambiar,
}: Props) {
  const dial = useRef<HTMLDivElement>(null)
  const arrastrando = useRef(false)
  const actual = valor ?? minimo
  const angulo = (posicionDeValor(actual, minimo, maximo, escala) * 2 - 1) * ARCO
  const extremo = punto(angulo)

  function desdePuntero(evento: PointerEvent<HTMLDivElement>) {
    const caja = dial.current?.getBoundingClientRect()
    if (!caja) return
    const dx = evento.clientX - (caja.left + caja.width / 2)
    const dy = evento.clientY - (caja.top + caja.height / 2)
    // 0° es arriba; positivo hacia la derecha. La zona muerta inferior se pega al extremo más cercano.
    let grados = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (grados > ARCO) grados = ARCO
    if (grados < -ARCO) grados = -ARCO
    alCambiar(valorDePosicion((grados + ARCO) / (2 * ARCO), minimo, maximo, paso, escala))
  }

  function alPresionar(evento: PointerEvent<HTMLDivElement>) {
    arrastrando.current = true
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
    evento.currentTarget.focus()
    desdePuntero(evento)
  }

  function alMover(evento: PointerEvent<HTMLDivElement>) {
    if (arrastrando.current) desdePuntero(evento)
  }

  function alSoltar(evento: PointerEvent<HTMLDivElement>) {
    arrastrando.current = false
    evento.currentTarget.releasePointerCapture?.(evento.pointerId)
  }

  function mover(delta: number) {
    alCambiar(ajustarAlPaso(actual + delta, minimo, maximo, paso))
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const teclas: Record<string, () => void> = {
      ArrowUp: () => mover(paso),
      ArrowRight: () => mover(paso),
      ArrowDown: () => mover(-paso),
      ArrowLeft: () => mover(-paso),
      PageUp: () => mover(paso * 10),
      PageDown: () => mover(-paso * 10),
      Home: () => alCambiar(minimo),
      End: () => alCambiar(maximo),
    }
    const accion = teclas[evento.key]
    if (!accion) return
    evento.preventDefault()
    accion()
  }

  return (
    <div className="perilla">
      <div className="perilla-caja">
        <div
          ref={dial}
          className="perilla-dial"
          role="slider"
          tabIndex={0}
          aria-label={etiqueta}
          aria-valuemin={minimo}
          aria-valuemax={maximo}
          aria-valuenow={actual}
          aria-valuetext={valor === null ? 'Sin elegir' : `${valor} ${unidad}`}
          onKeyDown={alTeclear}
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <svg className="perilla-svg" viewBox="0 0 120 120" aria-hidden="true">
            <path className="perilla-pista" d={arco(-ARCO, ARCO)} />
            {valor !== null && angulo > -ARCO && (
              <path className="perilla-progreso" d={arco(-ARCO, angulo)} />
            )}
            <circle
              className={valor === null ? 'perilla-tirador perilla-tirador-vacio' : 'perilla-tirador'}
              cx={extremo.x}
              cy={extremo.y}
              r="8"
            />
          </svg>
        </div>
        <output className="perilla-lectura" aria-live="off">
          <span className="perilla-numero">{valor === null ? '—' : valor}</span>
          <span className="perilla-unidad">{unidad}</span>
        </output>
      </div>
      <div className="perilla-ajuste">
        <button
          type="button"
          aria-label={`Disminuir ${paso} ${unidad}`}
          onClick={() => mover(-paso)}
          disabled={valor !== null && valor <= minimo}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Aumentar ${paso} ${unidad}`}
          onClick={() => mover(paso)}
          disabled={valor !== null && valor >= maximo}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default PerillaIntervalo
