import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Icono from './Icono.tsx'
import type { NombreIcono } from '../utils/iconos.ts'
import './FuncionesProducto.css'

export type FuncionProducto = {
  id: string
  etiqueta: string
  icono: NombreIcono
  /** Panel de la pestaña. Siempre es un componente que ya resuelve la operación. */
  contenido: ReactNode
}

type Props = {
  funciones: FuncionProducto[]
}

/**
 * Las funciones de un producto como pestañas: una barra con todas a la vista y,
 * debajo, el panel de la elegida, que ocupa casi todo el alto. Solo la pestaña
 * activa está montada; elegir una pestaña no envía ninguna orden: eso ocurre
 * únicamente cuando la persona pulsa la acción del panel.
 */
function FuncionesProducto({ funciones }: Props) {
  const base = useId()
  const [elegida, setElegida] = useState<string | null>(null)
  const botones = useRef<Array<HTMLButtonElement | null>>([])
  const indiceActual = Math.max(
    0,
    funciones.findIndex((f) => f.id === elegida),
  )
  const actual = funciones[indiceActual] ?? null

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    const ultimo = funciones.length - 1
    const destinos: Record<string, number> = {
      ArrowRight: indiceActual === ultimo ? 0 : indiceActual + 1,
      ArrowLeft: indiceActual === 0 ? ultimo : indiceActual - 1,
      Home: 0,
      End: ultimo,
    }
    const destino = destinos[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    setElegida(funciones[destino].id)
    botones.current[destino]?.focus()
  }

  if (!actual) return null

  return (
    <div className="producto">
      <div role="tablist" aria-label="Funciones" className="producto-pestanas" onKeyDown={alTeclear}>
        {funciones.map((f, i) => {
          const activa = f.id === actual.id
          return (
            <button
              key={f.id}
              ref={(el) => {
                botones.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${base}-pestana-${f.id}`}
              aria-selected={activa}
              aria-controls={`${base}-panel`}
              tabIndex={activa ? 0 : -1}
              onClick={() => setElegida(f.id)}
            >
              <Icono nombre={f.icono} tamano={22} />
              <span>{f.etiqueta}</span>
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-pestana-${actual.id}`}
        className="producto-panel"
      >
        <div key={actual.id} className="producto-cuerpo">
          {actual.contenido}
        </div>
        <p className="producto-vacio">
          Este panel necesita el backend configurado y una sesión iniciada; sin
          ellos no hay nada que consultar ni controlar.
        </p>
      </div>
    </div>
  )
}

export default FuncionesProducto
