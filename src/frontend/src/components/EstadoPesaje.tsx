import { useOrdenModulo } from '../hooks/useOrdenModulo.ts'
import { COMANDOS_ALIMENTACION } from '../models/ordenes.ts'
import EstadoOrdenModulo from './EstadoOrdenModulo.tsx'

type Props = { dispositivoId: string }

/**
 * Estado de la última orden de pesaje. «Confirmada por la Pico» dice que la
 * Pico recibió la orden; el peso medido aparece en la toma cuando llega su
 * evento. Solo se monta con VITE_ORDENES_HABILITADAS=true.
 */
function EstadoPesaje({ dispositivoId }: Props) {
  const { activo, cargando, fallo, errorEnvio, orden } = useOrdenModulo(
    dispositivoId,
    COMANDOS_ALIMENTACION,
  )
  if (!activo) return null
  return (
    <div aria-label="Estado del último pesaje" role="group">
      <EstadoOrdenModulo orden={orden} cargando={cargando} fallo={fallo} errorEnvio={errorEnvio} />
    </div>
  )
}

export default EstadoPesaje
