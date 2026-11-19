import { useState, type ReactNode } from 'react'
import type { ImagenProducto, PuntoEscena } from '../models/productos.ts'
import EscenaInteractiva from './EscenaInteractiva.tsx'
import HojaPanel from './HojaPanel.tsx'
import Icono from './Icono.tsx'
import type { NombreIcono } from '../utils/iconos.ts'
import './FuncionesProducto.css'

export type FuncionProducto = {
  id: string
  etiqueta: string
  icono: NombreIcono
  /** Panel que abre. Siempre es un componente que ya resuelve la operación. */
  contenido: ReactNode
  /** Posición sobre la imagen; sin ella, la función solo está en la lista. */
  punto?: Pick<PuntoEscena, 'x' | 'y' | 'compacto'>
}

type Props = {
  funciones: FuncionProducto[]
  /** Imagen del producto con sus puntos. Opcional: la lista funciona sin ella. */
  imagen?: ImagenProducto
  /** Contenido que no debe esconderse (lecturas, alarmas activas). */
  children?: ReactNode
}

/**
 * Un producto: imagen con botones (si hay arte), lista compacta «Funciones» y
 * el panel de la función elegida. Tocar un botón solo abre el panel; ninguna
 * orden sale hasta que la persona pulse la acción del panel.
 */
function FuncionesProducto({ funciones, imagen, children }: Props) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const [imagenRota, setImagenRota] = useState(false)
  const actual = funciones.find((f) => f.id === abierta) ?? null
  const alternar = (id: string) => setAbierta((a) => (a === id ? null : id))
  const puntos = funciones.flatMap((f) =>
    f.punto
      ? [
          {
            id: f.id,
            etiqueta: f.etiqueta,
            icono: f.icono,
            ...f.punto,
            activo: abierta === f.id,
            alSeleccionar: () => alternar(f.id),
          },
        ]
      : [],
  )

  return (
    <div className={actual ? 'producto producto-con-panel' : 'producto'}>
      <div className="producto-principal">
        {imagen && !imagenRota && puntos.length > 0 && (
          <EscenaInteractiva imagen={imagen} puntos={puntos} alFallar={() => setImagenRota(true)} />
        )}
        {children}
        <nav aria-label="Funciones" className="producto-funciones">
          <h2>Funciones</h2>
          <ul>
            {funciones.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={abierta === f.id}
                  onClick={() => alternar(f.id)}
                >
                  <Icono nombre={f.icono} />
                  <span>{f.etiqueta}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {actual && (
        <HojaPanel key={actual.id} titulo={actual.etiqueta} alCerrar={() => setAbierta(null)}>
          {actual.contenido}
        </HojaPanel>
      )}
    </div>
  )
}

export default FuncionesProducto
