import { useEffect, useState } from 'react'
import { urlIcono, type NombreIcono } from '../utils/iconos.ts'
import './Icono.css'

// Cada archivo se comprueba una sola vez; todas las instancias comparten el resultado.
const comprobaciones = new Map<string, Promise<boolean>>()

function existe(nombre: NombreIcono): Promise<boolean> {
  let promesa = comprobaciones.get(nombre)
  if (!promesa) {
    promesa = new Promise<boolean>((resolver) => {
      if (typeof Image === 'undefined') return resolver(true)
      const imagen = new Image()
      imagen.onload = () => resolver(true)
      imagen.onerror = () => resolver(false)
      imagen.src = urlIcono(nombre)
    })
    comprobaciones.set(nombre, promesa)
  }
  return promesa
}

type Props = { nombre: NombreIcono; tamano?: number }

/**
 * Icono decorativo: el nombre accesible lo da el texto o el aria-label del
 * control que lo contiene. Se pinta con máscara para tomar el color del texto.
 * Si el archivo no existe muestra un punto neutro, nunca un icono inventado.
 */
function Icono({ nombre, tamano = 24 }: Props) {
  const [falta, setFalta] = useState(false)

  useEffect(() => {
    let vigente = true
    void existe(nombre).then((hay) => {
      if (vigente) setFalta(!hay)
    })
    return () => {
      vigente = false
    }
  }, [nombre])

  const estilo = {
    width: tamano,
    height: tamano,
    ...(falta ? {} : { '--icono': `url(${urlIcono(nombre)})` }),
  } as React.CSSProperties

  return (
    <span
      className={falta ? 'icono icono-falta' : 'icono'}
      style={estilo}
      aria-hidden="true"
      data-icono={nombre}
    />
  )
}

export default Icono
