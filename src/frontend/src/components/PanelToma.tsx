import { useState } from 'react'
import { useAhora } from '../hooks/useAhora.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { useTomas } from '../hooks/useTomas.ts'
import {
  ESTADOS_ABIERTOS,
  NOMBRE_ESTADO_TOMA,
  TEXTO_ERROR_PESO,
  type AccionToma,
  type MomentoPeso,
  type Toma,
} from '../models/alimentacion.ts'
import { duracionVisibleS, formatearDuracion, formatearGramos } from '../utils/alimentacion.ts'
import EstadoPesaje from './EstadoPesaje.tsx'
import HistorialTomas from './HistorialTomas.tsx'

type Props = {
  dispositivoId: string
  /** Muestra los botones que piden un pesaje a la Pico (VITE_ORDENES_HABILITADAS). */
  controles: boolean
}

const PASO: Record<Toma['estado'], string> = {
  preparando: 'Paso 1: pesa el biberón lleno y luego inicia la toma.',
  en_curso: 'La toma está en curso. Puedes pausarla o finalizarla.',
  pausada: 'La toma está en pausa: el tiempo de pausa no cuenta.',
  por_cerrar: 'Paso final: pesa el biberón al terminar y cierra la toma.',
  completa: 'Toma completa.',
  cancelada: 'Toma cancelada.',
}

/**
 * Toma abierta del módulo: pasos según su estado. La web conduce la toma; la
 * Pico solo pesa cuando se lo piden y el peso llega como evento. Lo mostrado
 * viene del servidor: ningún peso se calcula ni se inventa aquí.
 */
function PanelToma({ dispositivoId, controles }: Props) {
  const { servicios } = useServicios()
  const { activo, cargando, fallo, tomas, recibidoEn, refrescar } = useTomas(dispositivoId)
  const ahora = useAhora(1000)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!activo) return null

  const abierta = tomas.find((t) => ESTADOS_ABIERTOS.includes(t.estado)) ?? null

  async function ejecutar(operacion: () => Promise<{ ok: boolean; error?: string }>) {
    if (enviando) return
    setEnviando(true)
    setError(null)
    let r
    try {
      r = await operacion()
    } catch {
      r = { ok: false, error: 'No se pudo completar la acción.' }
    }
    setEnviando(false)
    if (!r.ok) setError(r.error ?? 'No se pudo completar la acción.')
    refrescar()
  }

  const cambiar = (toma: Toma, accion: AccionToma) =>
    ejecutar(() => servicios.alimentacion.cambiarEstado(toma.id, accion))
  const pesar = (toma: Toma, momento: MomentoPeso) =>
    ejecutar(() => servicios.alimentacion.pedirPeso(toma.id, momento, crypto.randomUUID()))

  const duracion = abierta ? duracionVisibleS(abierta, recibidoEn, ahora.getTime()) : null

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-toma">
      <h2 id="titulo-panel-toma">Toma</h2>
      {cargando && <p role="status">Consultando las tomas…</p>}
      {fallo && <p role="alert">No se pudieron consultar las tomas.</p>}
      {error && <p role="alert">{error}</p>}

      {!cargando && abierta === null && (
        <>
          <p>No hay una toma abierta.</p>
          <button
            type="button"
            disabled={enviando}
            onClick={() =>
              void ejecutar(() =>
                servicios.alimentacion.crearToma(dispositivoId, crypto.randomUUID()),
              )
            }
          >
            Nueva toma
          </button>
        </>
      )}

      {abierta && (
        <div data-estado={abierta.estado} aria-label="Toma abierta" role="group">
          <p role="status" data-testid="estado-toma">
            Estado: {NOMBRE_ESTADO_TOMA[abierta.estado]}. {PASO[abierta.estado]}
          </p>
          <p>
            Peso inicial:{' '}
            {abierta.peso_inicial_g === null ? 'sin dato' : formatearGramos(abierta.peso_inicial_g)}.
            {' '}Peso final:{' '}
            {abierta.peso_final_g === null ? 'sin dato' : formatearGramos(abierta.peso_final_g)}.
          </p>
          {duracion !== null && (
            <p data-testid="duracion-toma">Duración activa: {formatearDuracion(duracion)}.</p>
          )}
          {abierta.peso_error && (
            <p role="alert">
              El último pesaje falló: {TEXTO_ERROR_PESO[abierta.peso_error]}.
            </p>
          )}

          {abierta.estado === 'preparando' && (
            <>
              {controles ? (
                <button type="button" disabled={enviando} onClick={() => void pesar(abierta, 'inicial')}>
                  Pesar biberón lleno
                </button>
              ) : (
                <p>Pesar con la Pico requiere habilitar las órdenes de la web.</p>
              )}
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'iniciar')}>
                Iniciar toma
              </button>
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'cancelar')}>
                Cancelar toma
              </button>
            </>
          )}

          {abierta.estado === 'en_curso' && (
            <>
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'pausar')}>
                Pausar toma
              </button>
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'finalizar')}>
                Finalizar toma
              </button>
              {controles && (
                <button type="button" disabled={enviando} onClick={() => void pesar(abierta, 'control')}>
                  Pesar de control
                </button>
              )}
            </>
          )}

          {abierta.estado === 'pausada' && (
            <>
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'reanudar')}>
                Reanudar toma
              </button>
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'finalizar')}>
                Finalizar toma
              </button>
              {controles && (
                <button type="button" disabled={enviando} onClick={() => void pesar(abierta, 'control')}>
                  Pesar de control
                </button>
              )}
            </>
          )}

          {abierta.estado === 'por_cerrar' && (
            <>
              {controles ? (
                <button type="button" disabled={enviando} onClick={() => void pesar(abierta, 'final')}>
                  Pesar biberón al terminar
                </button>
              ) : (
                <p>Pesar con la Pico requiere habilitar las órdenes de la web.</p>
              )}
              <button type="button" disabled={enviando} onClick={() => void cambiar(abierta, 'cerrar')}>
                Cerrar toma
              </button>
            </>
          )}

          {controles && <EstadoPesaje dispositivoId={dispositivoId} />}
        </div>
      )}

      <h3>Historial de tomas</h3>
      <HistorialTomas tomas={tomas} recibidoEn={recibidoEn} alCorregir={refrescar} />
    </section>
  )
}

export default PanelToma
