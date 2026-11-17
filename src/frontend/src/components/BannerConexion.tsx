import type { EstadoConexion } from '../models/conexion.ts'
import './BannerConexion.css'

const CONTENIDO: Record<EstadoConexion, { icono: string; texto: string }> = {
  'sin-configurar': {
    icono: '○',
    texto: 'Backend no configurado.',
  },
  conectando: { icono: '…', texto: 'Conectando con el servidor…' },
  conectado: { icono: '✓', texto: 'Conectado con el servidor.' },
  desconectado: {
    icono: '✕',
    texto:
      'Sin conexión con el servidor. Los datos mostrados pueden estar desactualizados.',
  },
}

interface Props {
  estado: EstadoConexion
  /** Reemplaza el texto por defecto del estado. */
  texto?: string
}

function BannerConexion({ estado, texto: textoPropio }: Props) {
  const { icono, texto: textoBase } = CONTENIDO[estado]
  const texto = textoPropio ?? textoBase
  return (
    <p className="banner-conexion" role="status" data-estado={estado}>
      <span aria-hidden="true" className="banner-conexion-icono">
        {icono}
      </span>
      <span>{texto}</span>
    </p>
  )
}

export default BannerConexion
