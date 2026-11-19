import { useAhora } from '../hooks/useAhora.ts'
import type { EstadoVisibleOrden, OrdenModulo } from '../models/ordenes.ts'
import { estadoVisibleOrden } from '../utils/ordenes.ts'
import FechasOrden from './FechasOrden.tsx'

const ETIQUETA: Record<EstadoVisibleOrden, string> = {
  pendiente: 'Solicitud registrada',
  enviada: 'Orden enviada',
  confirmado: 'Confirmada por la Pico',
  error: 'Error',
  'sin-respuesta': 'Sin respuesta',
}

const DETALLE: Record<EstadoVisibleOrden, string> = {
  pendiente: 'Esperando que la orden llegue a la Pico.',
  enviada: 'La orden se entregó a la Pico; falta su confirmación.',
  confirmado: 'La Pico informó que ejecutó el comando.',
  error: 'La Pico informó un error al ejecutar la orden.',
  'sin-respuesta': 'La orden venció sin confirmación de la Pico.',
}

type Props = {
  orden: OrdenModulo | null
  cargando: boolean
  fallo: boolean
  errorEnvio: string | null
}

/**
 * Estado de la última orden con las etiquetas del contrato. «Confirmada»
 * significa que la Pico lo informó; no comprueba el efecto físico.
 */
function EstadoOrdenModulo({ orden, cargando, fallo, errorEnvio }: Props) {
  const ahora = useAhora(1000)
  const estado = orden ? estadoVisibleOrden(orden, ahora) : null
  return (
    <div className="estado-orden">
      {errorEnvio && <p role="alert">{errorEnvio}</p>}
      {cargando && <p role="status">Consultando la última orden…</p>}
      {fallo && <p role="alert">No se pudo consultar la última orden.</p>}
      {!cargando && orden === null && <p>No hay órdenes registradas.</p>}
      {orden && estado && (
        <dl data-estado={estado}>
          <dt>Estado de la última orden</dt>
          <dd role="status">
            {ETIQUETA[estado]}. {DETALLE[estado]}
          </dd>
        </dl>
      )}
      {orden && estado && <FechasOrden creadoEn={orden.creado_en} venceEn={orden.vence_en} />}
    </div>
  )
}

export default EstadoOrdenModulo
