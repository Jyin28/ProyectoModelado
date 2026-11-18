import { useOrdenModulo } from '../hooks/useOrdenModulo.ts'
import { COMANDOS_MOVIMIENTO } from '../models/ordenes.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'
import EstadoOrdenModulo from './EstadoOrdenModulo.tsx'
import PanelHorarios from './PanelHorarios.tsx'

type Props = { dispositivoId: string }

/**
 * Activación del monitoreo de movimiento. Solo se monta con
 * VITE_ORDENES_HABILITADAS=true. El estado mostrado es el último que la Pico
 * confirmó; la Pico arranca con el monitoreo apagado y, si se reinicia,
 * vuelve a ese estado sin avisar (limitación conocida, ver contratos).
 */
function PanelMonitoreoMovimiento({ dispositivoId }: Props) {
  const { activo, cargando, fallo, enviando, errorEnvio, orden, estado, solicitar } =
    useOrdenModulo(dispositivoId, COMANDOS_MOVIMIENTO)

  if (!activo) return null

  const monitoreo = estado?.estado.monitoreo
  const texto =
    typeof monitoreo !== 'boolean' || estado?.actualizado_en == null
      ? 'Sin confirmación de la Pico.'
      : `Monitoreo ${monitoreo ? 'activado' : 'desactivado'}, confirmado por la Pico el ${formatearHoraCR(estado.actualizado_en)}.`

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-monitoreo">
      <h2 id="titulo-panel-monitoreo">Monitoreo de movimiento</h2>
      <p>
        Con el monitoreo activado, cada movimiento detectado genera un aviso por
        Telegram con su hora. Desactivado, no se registra ni se avisa.
      </p>
      <p role="status">{texto}</p>
      <button
        type="button"
        disabled={enviando}
        onClick={() => void solicitar({ command: 'motion_set', params: { enabled: true } })}
      >
        Activar monitoreo
      </button>
      <button
        type="button"
        disabled={enviando}
        onClick={() => void solicitar({ command: 'motion_set', params: { enabled: false } })}
      >
        Desactivar monitoreo
      </button>
      <EstadoOrdenModulo orden={orden} cargando={cargando} fallo={fallo} errorEnvio={errorEnvio} />
      <PanelHorarios
        dispositivoId={dispositivoId}
        tipo="movimiento_activar"
        titulo="Activar monitoreo"
        descripcion="A cada hora se pide activar el monitoreo."
      />
      <PanelHorarios
        dispositivoId={dispositivoId}
        tipo="movimiento_desactivar"
        titulo="Desactivar monitoreo"
        descripcion="A cada hora se pide desactivar el monitoreo."
      />
    </section>
  )
}

export default PanelMonitoreoMovimiento
