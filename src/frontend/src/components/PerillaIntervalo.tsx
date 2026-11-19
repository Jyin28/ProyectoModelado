import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { ajustarAlPaso, posicionDeValor, valorDePosicion } from '../utils/perilla.ts'
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
  alCambiar: (nuevo: number) => void
}

// La perilla recorre 270°: de -135° (mínimo) a +135° (máximo), con la zona muerta abajo.
const ARCO = 135

/**
 * Perilla de un valor numérico con unidad. Se opera con arrastre, con teclado
 * (flechas ±paso, PageUp/PageDown ±10 pasos, Inicio/Fin) o con los botones −/+.
 * Solo cambia el borrador: enviar la orden es otra acción.
 */
function PerillaIntervalo({ valor, minimo, maximo, paso, unidad, etiqueta, alCambiar }: Props) {
  const dial = useRef<HTMLDivElement>(null)
  const arrastrando = useRef(false)
  const actual = valor ?? minimo
  const angulo = (posicionDeValor(actual, minimo, maximo) * 2 - 1) * ARCO

  function desdePuntero(evento: PointerEvent<HTMLDivElement>) {
    const caja = dial.current?.getBoundingClientRect()
    if (!caja) return
    const dx = evento.clientX - (caja.left + caja.width / 2)
    const dy = evento.clientY - (caja.top + caja.height / 2)
    // 0° es arriba; positivo hacia la derecha. La zona muerta inferior se pega al extremo más cercano.
    let grados = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (grados > ARCO) grados = ARCO
    if (grados < -ARCO) grados = -ARCO
    alCambiar(valorDePosicion((grados + ARCO) / (2 * ARCO), minimo, maximo, paso))
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
        <span
          className="perilla-aguja"
          style={{ transform: `rotate(${angulo}deg)` }}
          aria-hidden="true"
        />
      </div>
      <div className="perilla-valor">
        <button
          type="button"
          aria-label={`Disminuir ${paso} ${unidad}`}
          onClick={() => mover(-paso)}
          disabled={valor !== null && valor <= minimo}
        >
          −
        </button>
        <output aria-live="off">{valor === null ? '— ' : valor} {unidad}</output>
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
