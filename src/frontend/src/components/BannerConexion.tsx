import type { EstadoConexion } from '../models/conexion.ts'
import './BannerConexion.css'

const CONTENIDO: Record<EstadoConexion, { icono: string; texto: string }> = {
  'sin-configurar': {
    icono: '○',
    texto: 'Conexión con el servidor sin configurar.',
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
}

function BannerConexion({ estado }: Props) {
  const { icono, texto } = CONTENIDO[estado]
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
