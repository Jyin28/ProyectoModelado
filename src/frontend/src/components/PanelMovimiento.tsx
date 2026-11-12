import { useUltimoMovimiento } from '../hooks/useUltimoMovimiento.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'

interface Props {
  dispositivoId: string
  /** Opt-in (VITE_MOVIMIENTO_HABILITADO); apagado, no renderiza ni consulta. */
  habilitado: boolean
}

// Solo muestra el último movimiento registrado; no hay alertas ni controles.
function PanelMovimiento({ dispositivoId, habilitado }: Props) {
  const { activo, cargando, fallo, evento } = useUltimoMovimiento(
    dispositivoId,
    habilitado,
  )
  if (!activo) return null

  return (
    <section aria-labelledby="titulo-movimiento" className="panel-movimiento">
      <h2 id="titulo-movimiento">Último movimiento</h2>
      {fallo && (
        <p role="status">
          No se pudo actualizar el último movimiento
          {evento ? '; se muestra el último dato conocido.' : '.'}
        </p>
      )}
      {cargando ? (
        <p role="status">Cargando el último movimiento…</p>
      ) : evento ? (
        <p>
          <time dateTime={evento.registrado_en}>
            {formatearHoraCR(evento.registrado_en)}
          </time>
        </p>
      ) : (
        <p>Sin datos</p>
      )}
    </section>
  )
}

export default PanelMovimiento
