import { useState } from 'react'
import { useEventosColchon } from '../hooks/useEventosColchon.ts'
import { useOrdenModulo } from '../hooks/useOrdenModulo.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import { TEXTO_MOTIVO, type ConfigColchon, type EstadoColchon } from '../models/colchon.ts'
import { COMANDOS_COLCHON } from '../models/ordenes.ts'
import { leerEstadoColchon } from '../utils/colchon.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'
import EstadoOrdenModulo from './EstadoOrdenModulo.tsx'
import FormularioConfigColchon from './FormularioConfigColchon.tsx'

type Props = {
  dispositivoId: string
  /** Muestra activar, detener y rearmar. Va tras VITE_ORDENES_HABILITADAS. */
  controles: boolean
}

function textoEstado(estado: EstadoColchon | null): string {
  if (estado === null) return 'Sin confirmación de la Pico.'
  const hora = formatearHoraCR(estado.desde)
  if (estado.situacion === 'activo') {
    const referencia =
      estado.referencia_g === null ? '' : ` Referencia medida por la Pico: ${estado.referencia_g} g.`
    return `Monitoreo activo.${referencia} Informado por la Pico el ${hora}.`
  }
  if (estado.situacion === 'alarma') {
    return `ALARMA: el peso bajó más que la tolerancia. Informado por la Pico el ${hora}.`
  }
  const motivo = estado.motivo === null ? '' : ` ${TEXTO_MOTIVO[estado.motivo]}`
  return `Monitoreo detenido${motivo}. Informado por la Pico el ${hora}.`
}

/**
 * Colchón. La configuración y los eventos vienen del servidor; el estado es lo
 * último que la Pico informó. La web nunca muestra pesos: se miden solo en la
 * Pico. Los controles que operan el hardware son opt-in.
 */
function PanelColchon({ dispositivoId, controles }: Props) {
  const { backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const activo = backendConfigurado && sesion.tipo === 'autenticado'
  const [config, setConfig] = useState<ConfigColchon | null>(null)
  const { cargando, fallo, enviando, errorEnvio, orden, estado, solicitar } = useOrdenModulo(
    dispositivoId,
    COMANDOS_COLCHON,
  )
  const eventos = useEventosColchon(dispositivoId)

  if (!activo) return null

  const parametros = config
    ? {
        duration_s: config.duracion_s,
        tolerance_pct: config.tolerancia_pct,
        alarm_s: config.alarma_s,
      }
    : null

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-colchon">
      <h2 id="titulo-panel-colchon">Monitoreo del colchón</h2>
      <p>
        El peso se mide solo en la Pico y no se envía a la nube. Aquí se ve lo
        que la Pico informa: cuándo se activa, si suena la alarma y cuándo se
        detiene.
      </p>
      <p role="status" data-testid="estado-colchon">
        {textoEstado(leerEstadoColchon(estado))}
      </p>
      <p>
        Es el último estado informado. Si la Pico se reinició, puede no
        reflejarlo hasta su siguiente aviso.
      </p>

      <h3>Configuración</h3>
      <FormularioConfigColchon dispositivoId={dispositivoId} alCambiar={setConfig} />

      {controles && (
        <div role="group" aria-label="Control del monitoreo">
          <p>
            Al activar, la Pico toma como referencia el peso de ese momento. Si
            la orden termina en error, la Pico no pudo medir o activar (por
            ejemplo, si le falta la calibración local).
          </p>
          {parametros === null && (
            <p>Guarda la configuración para poder activar el monitoreo.</p>
          )}
          <button
            type="button"
            disabled={enviando || parametros === null}
            onClick={() =>
              parametros && void solicitar({ command: 'mattress_arm', params: parametros })
            }
          >
            Activar monitoreo
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => void solicitar({ command: 'mattress_stop', params: {} })}
          >
            Detener monitoreo
          </button>
          <button
            type="button"
            disabled={enviando || parametros === null}
            onClick={() =>
              parametros && void solicitar({ command: 'mattress_rearm', params: parametros })
            }
          >
            Rearmar con una referencia nueva
          </button>
          <EstadoOrdenModulo
            orden={orden}
            cargando={cargando}
            fallo={fallo}
            errorEnvio={errorEnvio}
          />
        </div>
      )}

      <h3>Eventos recientes</h3>
      {eventos.cargando && <p role="status">Consultando los eventos…</p>}
      {eventos.fallo && <p role="alert">No se pudieron consultar los eventos del colchón.</p>}
      {!eventos.cargando && eventos.eventos.length === 0 && !eventos.fallo && (
        <p>Todavía no hay eventos del colchón.</p>
      )}
      {eventos.eventos.length > 0 && (
        <ul>
          {eventos.eventos.map((e) => (
            <li key={e.event_id}>
              {e.descripcion} · {formatearHoraCR(e.ts)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PanelColchon
