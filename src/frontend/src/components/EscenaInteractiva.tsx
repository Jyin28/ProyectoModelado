import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import type { ImagenProducto, PuntoEscena } from '../models/productos.ts'
import Icono from './Icono.tsx'
import './EscenaInteractiva.css'

export type PuntoActivable = PuntoEscena & {
  /** Con ruta, el botón es un enlace; sin ruta, llama a alSeleccionar. */
  ruta?: string
  alSeleccionar?: () => void
  /** Marca el punto como el panel abierto. */
  activo?: boolean
}

type Props = {
  imagen: ImagenProducto
  puntos: PuntoActivable[]
  /** Se llama si la imagen no carga; el padre debe ofrecer la lista de funciones. */
  alFallar?: () => void
}

type EstiloPunto = CSSProperties & Record<`--${string}`, string>

function estiloPunto(p: PuntoEscena): EstiloPunto {
  const estilo: EstiloPunto = { '--x': `${p.x}%`, '--y': `${p.y}%` }
  if (p.compacto) {
    estilo['--xc'] = `${p.compacto.x}%`
    estilo['--yc'] = `${p.compacto.y}%`
  }
  return estilo
}

/**
 * Imagen con botones HTML superpuestos. El contenedor tiene la misma
 * proporción que la imagen (aspect-ratio) y la imagen lo llena sin recorte,
 * así que los porcentajes apuntan siempre a la misma pieza, también al rotar
 * el teléfono. Los botones miden al menos 44 × 44 px.
 */
function EscenaInteractiva({ imagen, puntos, alFallar }: Props) {
  const [fallo, setFallo] = useState(false)
  if (fallo) return null

  return (
    <div
      className="escena"
      style={{ aspectRatio: `${imagen.ancho} / ${imagen.alto}` }}
    >
      <img
        className="escena-imagen"
        src={imagen.src}
        width={imagen.ancho}
        height={imagen.alto}
        alt={imagen.alt}
        draggable={false}
        onError={() => {
          setFallo(true)
          alFallar?.()
        }}
      />
      {puntos.map((p) => {
        const contenido = (
          <>
            <Icono nombre={p.icono} tamano={22} />
            <span className="escena-etiqueta" aria-hidden="true">
              {p.etiqueta}
            </span>
          </>
        )
        return p.ruta ? (
          <Link
            key={p.id}
            to={p.ruta}
            className="escena-punto"
            style={estiloPunto(p)}
            aria-label={p.etiqueta}
            data-punto={p.id}
          >
            {contenido}
          </Link>
        ) : (
          <button
            key={p.id}
            type="button"
            className="escena-punto"
            style={estiloPunto(p)}
            aria-label={p.etiqueta}
            aria-haspopup="dialog"
            aria-pressed={p.activo ?? false}
            data-punto={p.id}
            onClick={p.alSeleccionar}
          >
            {contenido}
          </button>
        )
      })}
    </div>
  )
}

export default EscenaInteractiva
