import { useState } from 'react'
import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import BannerConexion from '../components/BannerConexion.tsx'
import { useColchonPico } from '../hooks/useColchonPico.ts'
import type {
  DatosAlarmStarted,
  DatosAlarmStopped,
  DatosMonitoringStarted,
  DatosMonitoringStopped,
  EventoColchonPico,
} from '../models/colchonPico.ts'
import { dispositivoColchonPicoId } from '../services/configuracion.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'
import './PaginaColchon.css'
import './paginas.css'

function formatearDetalleEvento(evento: EventoColchonPico): string {
  switch (evento.tipo) {
    case 'monitoring_started': {
      const d = evento.datos as DatosMonitoringStarted
      return `Ref: ${d.reference_g ?? '--'} g | Tol: ${d.tolerance_pct ?? 10}% | Dur: ${d.duration_s ?? '--'} s`
    }
    case 'alarm_started': {
      const d = evento.datos as DatosAlarmStarted
      const peso = d.weight_g !== undefined ? `${d.weight_g.toFixed(1)} g` : '--'
      const umbral = d.threshold_g !== undefined ? `${d.threshold_g.toFixed(1)} g` : '--'
      return `Peso: ${peso} (Umbral violado: < ${umbral})`
    }
    case 'alarm_stopped': {
      const d = evento.datos as DatosAlarmStopped
      return `Motivo: ${d.reason ?? 'manual'}`
    }
    case 'monitoring_stopped': {
      const d = evento.datos as DatosMonitoringStopped
      return `Motivo: ${d.reason ?? 'finalizado'}`
    }
    default:
      return JSON.stringify(evento.datos)
  }
}

function etiquetaTipoEvento(tipo: string): string {
  switch (tipo) {
    case 'monitoring_started':
      return 'Monitoreo iniciado'
    case 'alarm_started':
      return 'Alarma disparada'
    case 'alarm_stopped':
      return 'Alarma detenida'
    case 'monitoring_stopped':
      return 'Monitoreo finalizado'
    default:
      return tipo
  }
}

function PaginaColchon() {
  const colchonId = dispositivoColchonPicoId()
  const {
    activo,
    cargando,
    fallo,
    estado,
    ultimoEvento,
    eventos,
    referencia_g,
    tolerancia_pct,
    umbral_g,
    pesoAlarma_g,
    motivoDetencion,
    enviandoComando,
    errorComando,
    mensajeExito,
    iniciarMonitoreo,
    detenerMonitoreo,
    detenerAlarma,
    capturarReferencia,
    tararBalanza,
    calibrarBalanza,
  } = useColchonPico(colchonId)

  const [duracionS, setDuracionS] = useState(120)
  const [toleranciaPct, setToleranciaPct] = useState(10)
  const [alarmaS, setAlarmaS] = useState(60)
  const [pesoConocido, setPesoConocido] = useState<number | ''>('')
  const [pesoReferenciaInput, setPesoReferenciaInput] = useState<number | ''>(referencia_g ?? 200)

  const manejarIniciar = () => {
    const refNum = typeof pesoReferenciaInput === 'number' && pesoReferenciaInput > 0 ? pesoReferenciaInput : undefined
    void iniciarMonitoreo(duracionS, toleranciaPct, alarmaS, refNum)
  }

  const pesoConocidoValido =
    typeof pesoConocido === 'number' && pesoConocido >= 1 && pesoConocido <= 5000

  const manejarCalibrar = () => {
    if (typeof pesoConocido === 'number') void calibrarBalanza(pesoConocido)
  }

  const manejarCapturar = () => {
    const refNum = typeof pesoReferenciaInput === 'number' && pesoReferenciaInput > 0 ? pesoReferenciaInput : undefined
    void capturarReferencia(refNum)
  }

  return (
    <section className="pagina" aria-labelledby="titulo-colchon">
      <h1 id="titulo-colchon">Colchón</h1>

      {activo && fallo && <BannerConexion estado="desconectado" />}

      {activo && cargando && (
        <p role="status">Cargando estado del colchón…</p>
      )}

      {!cargando && ultimoEvento === null && <AvisoSinDatos />}

      {activo && !cargando && (
        <div className="colchon-contenedor">
          {/* Badge de Estado Actual */}
          <div>
            <span
              className={`colchon-badge-estado ${estado}`}
              role="status"
              aria-label={`Estado actual del colchón: ${estado}`}
            >
              {estado === 'alarma' && '🚨 ¡Alarma Activa (Pérdida de Peso)!'}
              {estado === 'monitoreando' && '🟢 Monitoreando Presencia'}
              {estado === 'detenido' && '⏹️ Monitoreo Inactivo'}
            </span>
          </div>

          {/* Banner crítico en caso de alarma */}
          {estado === 'alarma' && (
            <div className="colchon-banner-alarma" role="alert">
              <h2>⚠️ Pérdida de peso detectada</h2>
              <p>
                El colchón ha detectado una reducción del peso superior a la
                tolerancia ({tolerancia_pct ?? 10}%). El buzzer del colchón está
                sonando.
              </p>
              {pesoAlarma_g !== null && (
                <p>
                  <strong>Peso registrado:</strong> {pesoAlarma_g.toFixed(1)} g
                  (Umbral mínimo: {umbral_g ?? '--'} g).
                </p>
              )}
              <div className="colchon-botones-grupo">
                <button
                  type="button"
                  className="btn-colchon peligro"
                  onClick={() => void detenerAlarma()}
                  disabled={enviandoComando}
                >
                  Detener Alarma (Silenciar y Apagar)
                </button>
              </div>
            </div>
          )}

          {/* Tarjetas de Métricas de Monitoreo */}
          <div className="colchon-tarjetas-grid">
            <div className="colchon-tarjeta-metrica">
              <div className="etiqueta">Peso de Referencia</div>
              <div className="valor">
                {referencia_g !== null ? `${referencia_g.toFixed(1)} g` : '--'}
              </div>
            </div>
            <div className="colchon-tarjeta-metrica">
              <div className="etiqueta">Tolerancia</div>
              <div className="valor">
                {tolerancia_pct !== null ? `${tolerancia_pct} %` : '10 %'}
              </div>
            </div>
            <div className="colchon-tarjeta-metrica">
              <div className="etiqueta">Umbral de Disparo</div>
              <div className="valor">
                {umbral_g !== null ? `${umbral_g.toFixed(1)} g` : '--'}
              </div>
            </div>
            {estado === 'alarma' && pesoAlarma_g !== null && (
              <div className="colchon-tarjeta-metrica">
                <div className="etiqueta">Peso Disparo</div>
                <div className="valor" style={{ color: '#dc2626' }}>
                  {pesoAlarma_g.toFixed(1)} g
                </div>
              </div>
            )}
          </div>

          {/* Aviso de Rearme si fue detenido */}
          {estado === 'detenido' && ultimoEvento && (
            <div className="colchon-aviso-rearme">
              ℹ️ Monitoreo detenido{' '}
              {motivoDetencion ? `(motivo: ${motivoDetencion})` : ''}. Según la
              norma de seguridad (DEC-03), el monitoreo requiere un{' '}
              <strong>rearme explícito</strong>: capture una nueva referencia
              con el bebé acostado para reiniciar.
            </div>
          )}

          {/* Panel de Controles y Parámetros */}
          <div className="colchon-panel-controles">
            <h3>Controles del Colchón</h3>

            {errorComando && (
              <p style={{ color: '#dc2626' }} role="alert">
                {errorComando}
              </p>
            )}

            {mensajeExito && (
              <p
                style={{
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10b981',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                }}
                role="status"
              >
                ✓ {mensajeExito}
              </p>
            )}

            {estado === 'monitoreando' && (
              <div className="colchon-botones-grupo">
                <button
                  type="button"
                  className="btn-colchon peligro"
                  onClick={() => void detenerMonitoreo()}
                  disabled={enviandoComando}
                >
                  Detener Monitoreo
                </button>
              </div>
            )}

            {estado === 'detenido' && (
              <>
                <div className="colchon-formulario-parametros">
                  <div className="colchon-campo">
                    <label htmlFor="input-referencia">Peso de Referencia (g)</label>
                    <input
                      id="input-referencia"
                      type="number"
                      min="10"
                      max="20000"
                      step="0.1"
                      value={pesoReferenciaInput}
                      onChange={(e) =>
                        setPesoReferenciaInput(
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                      }
                      placeholder="Ej: 200"
                    />
                  </div>
                  <div className="colchon-campo">
                    <label htmlFor="input-duracion">Duración (segundos)</label>
                    <input
                      id="input-duracion"
                      type="number"
                      min="10"
                      max="86400"
                      value={duracionS}
                      onChange={(e) => setDuracionS(Number(e.target.value))}
                    />
                  </div>
                  <div className="colchon-campo">
                    <label htmlFor="input-tolerancia">Tolerancia (%)</label>
                    <input
                      id="input-tolerancia"
                      type="number"
                      min="1"
                      max="50"
                      value={toleranciaPct}
                      onChange={(e) => setToleranciaPct(Number(e.target.value))}
                    />
                  </div>
                  <div className="colchon-campo">
                    <label htmlFor="input-alarma">Alarma sonora (s)</label>
                    <input
                      id="input-alarma"
                      type="number"
                      min="5"
                      max="600"
                      value={alarmaS}
                      onChange={(e) => setAlarmaS(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="colchon-botones-grupo">
                  <button
                    type="button"
                    className="btn-colchon secundario"
                    onClick={manejarCapturar}
                    disabled={enviandoComando}
                  >
                    Capturar Referencia de Peso
                  </button>
                  <button
                    type="button"
                    className="btn-colchon primario"
                    onClick={manejarIniciar}
                    disabled={enviandoComando}
                  >
                    Iniciar Monitoreo
                  </button>
                  <button
                    type="button"
                    className="btn-colchon secundario"
                    onClick={() => void tararBalanza()}
                    disabled={enviandoComando}
                  >
                    Tarar Balanza (Vacío)
                  </button>
                </div>

                <div className="colchon-formulario-parametros">
                  <div className="colchon-campo">
                    <label htmlFor="input-peso-conocido">Peso conocido para calibrar (g)</label>
                    <input
                      id="input-peso-conocido"
                      type="number"
                      min="1"
                      max="5000"
                      step="0.1"
                      value={pesoConocido}
                      onChange={(e) =>
                        setPesoConocido(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Ej: 1000"
                    />
                  </div>
                </div>
                <p>
                  Primero tare con la balanza vacía y luego apoye una pesa de masa verificada
                  antes de calibrar. Sin calibración la Pico usa un factor provisional y los
                  gramos no son reales.
                </p>
                <div className="colchon-botones-grupo">
                  <button
                    type="button"
                    className="btn-colchon secundario"
                    onClick={manejarCalibrar}
                    disabled={enviandoComando || !pesoConocidoValido}
                  >
                    Calibrar con Peso Conocido
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Historial de Eventos Recientes */}
          {eventos.length > 0 && (
            <div className="colchon-historial-seccion">
              <h3>Historial de Eventos del Colchón</h3>
              <div className="colchon-tabla-contenedor">
                <table className="colchon-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Fecha y Hora</th>
                      <th scope="col">Evento</th>
                      <th scope="col">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventos.map((ev) => (
                      <tr key={ev.event_id}>
                        <td>{formatearHoraCR(ev.ts)}</td>
                        <td>
                          <span className={`evento-badge ${ev.tipo}`}>
                            {etiquetaTipoEvento(ev.tipo)}
                          </span>
                        </td>
                        <td>{formatearDetalleEvento(ev)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!activo && (
        <p>
          Sección reservada para la información del colchón. La conexión con el
          dispositivo y el backend está pendiente de implementación.
        </p>
      )}
    </section>
  )
}

export default PaginaColchon
