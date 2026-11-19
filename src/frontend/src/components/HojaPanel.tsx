import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './HojaPanel.css'

type Props = {
  titulo: string
  alCerrar: () => void
  children: ReactNode
}

const FOCALIZABLES =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [role="slider"], [tabindex]:not([tabindex="-1"])'

function esCelular(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 899px)').matches
}

/**
 * Panel de una función. En celular es una hoja inferior modal con cierre
 * visible; en escritorio queda junto a la imagen. Al abrir mueve el foco al
 * panel, Escape lo cierra y el foco vuelve al control que lo abrió. El
 * contenido se desplaza dentro de la hoja si hay varios ajustes.
 */
function HojaPanel({ titulo, alCerrar, children }: Props) {
  const idTitulo = useId()
  const hoja = useRef<HTMLElement>(null)
  const cierre = useRef(alCerrar)

  useEffect(() => {
    cierre.current = alCerrar
  }, [alCerrar])

  useEffect(() => {
    const origen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    hoja.current?.focus()
    const overflowPrevio = document.body.style.overflow
    if (esCelular()) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflowPrevio
      // El control que abrió la hoja puede haberse desmontado (cambio de página).
      if (origen?.isConnected) origen.focus()
    }
  }, [])

  function alTeclear(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      cierre.current()
      return
    }
    if (evento.key !== 'Tab' || !esCelular() || !hoja.current) return
    const items = Array.from(hoja.current.querySelectorAll<HTMLElement>(FOCALIZABLES))
    if (items.length === 0) return
    const primero = items[0]
    const ultimo = items[items.length - 1]
    const activo = document.activeElement
    if (evento.shiftKey && (activo === primero || activo === hoja.current)) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault()
      primero.focus()
    }
  }

  return (
    <>
      <div className="hoja-fondo" onClick={alCerrar} aria-hidden="true" />
      <section
        ref={hoja}
        className="hoja"
        role="dialog"
        aria-modal="false"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <header className="hoja-cabecera">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="hoja-cerrar" onClick={alCerrar}>
            Cerrar
          </button>
        </header>
        <div className="hoja-cuerpo">{children}</div>
        <p className="hoja-vacia">
          Este panel necesita el backend configurado y una sesión iniciada; sin
          ellos no hay nada que consultar ni controlar.
        </p>
      </section>
    </>
  )
}

export default HojaPanel
