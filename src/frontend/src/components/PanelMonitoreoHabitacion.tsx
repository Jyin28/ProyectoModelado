import { useOrdenModulo } from '../hooks/useOrdenModulo.ts'
import {
  NOMBRE_SENSOR,
  SENSORES_HABITACION,
  type SensorHabitacion,
} from '../models/habitacion.ts'
import { COMANDOS_HABITACION } from '../models/ordenes.ts'
import { leerMonitoreoSensor } from '../utils/habitacion.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'
import EstadoOrdenModulo from './EstadoOrdenModulo.tsx'
import PanelHorarios from './PanelHorarios.tsx'

type Props = { dispositivoId: string }

const DESCRIPCION: Record<SensorHabitacion, string> = {
  puerta: 'Con el monitoreo activado, abrir la puerta genera un evento y un aviso por Telegram.',
  movimiento:
    'Con el monitoreo activado, detectar movimiento genera un evento y un aviso por Telegram.',
}

/**
 * Activación del monitoreo de puerta y de movimiento de la habitación. Solo se
 * monta con VITE_ORDENES_HABILITADAS=true. El estado mostrado es el último que
 * la Pico confirmó. No hay alarma sonora y no se distingue entrar de salir.
 */
function PanelMonitoreoHabitacion({ dispositivoId }: Props) {
  const { activo, cargando, fallo, enviando, errorEnvio, orden, estado, solicitar } =
    useOrdenModulo(dispositivoId, COMANDOS_HABITACION)

  if (!activo) return null

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-habitacion">
      <h2 id="titulo-panel-habitacion">Monitoreo de la habitación</h2>
      {SENSORES_HABITACION.map((sensor) => {
        const monitoreo = leerMonitoreoSensor(estado, sensor)
        const hora = estado?.actualizado_en ?? null
        const texto =
          monitoreo === null || hora === null
            ? 'Sin confirmación de la Pico.'
            : `Monitoreo ${monitoreo ? 'activado' : 'desactivado'}, confirmado por la Pico el ${formatearHoraCR(hora)}.`
        const nombre = NOMBRE_SENSOR[sensor]
        return (
          <div key={sensor} role="group" aria-label={`Sensor de ${nombre.toLowerCase()}`}>
            <h3>{nombre}</h3>
            <p>{DESCRIPCION[sensor]}</p>
            <p role="status" data-testid={`estado-${sensor}`}>
              {texto}
            </p>
            <button
              type="button"
              disabled={enviando}
              onClick={() =>
                void solicitar({ command: 'room_monitor_set', params: { sensor, enabled: true } })
              }
            >
              Activar monitoreo de {nombre.toLowerCase()}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() =>
                void solicitar({ command: 'room_monitor_set', params: { sensor, enabled: false } })
              }
            >
              Desactivar monitoreo de {nombre.toLowerCase()}
            </button>
            <PanelHorarios
              dispositivoId={dispositivoId}
              tipo={`habitacion_${sensor}_activar`}
              titulo={`Activar ${nombre.toLowerCase()}`}
              descripcion="A cada hora se pide activar el monitoreo."
            />
            <PanelHorarios
              dispositivoId={dispositivoId}
              tipo={`habitacion_${sensor}_desactivar`}
              titulo={`Desactivar ${nombre.toLowerCase()}`}
              descripcion="A cada hora se pide desactivar el monitoreo."
            />
          </div>
        )
      })}
      <EstadoOrdenModulo orden={orden} cargando={cargando} fallo={fallo} errorEnvio={errorEnvio} />
    </section>
  )
}

export default PanelMonitoreoHabitacion
