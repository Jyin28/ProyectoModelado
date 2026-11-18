import { useState } from 'react'
import { useHabitacion } from '../hooks/useHabitacion.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import { textoFoto } from '../utils/habitacion.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'

type Props = { dispositivoId: string }

type FotoAbierta = { eventId: string; url: string }

/**
 * Eventos recientes de la habitación con el estado de su foto. La foto se ve
 * con un enlace que caduca a los 60 s y que solo obtiene un dueño del módulo.
 * Telegram solo avisa que se tomó una foto: nunca recibe la imagen.
 */
function PanelEventosHabitacion({ dispositivoId }: Props) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const activo = backendConfigurado && sesion.tipo === 'autenticado'
  const { cargando, fallo, eventos, fotos } = useHabitacion(dispositivoId)
  const [abierta, setAbierta] = useState<FotoAbierta | null>(null)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState<string | null>(null)

  if (!activo) return null

  const fotoDe = (eventId: string) => fotos.find((f) => f.event_id === eventId)

  async function abrir(eventId: string, ruta: string) {
    setErrorFoto(null)
    setAbriendo(eventId)
    let r
    try {
      r = await servicios.habitacion.urlFoto(ruta)
    } catch {
      r = { ok: false as const, error: 'No se pudo abrir la fotografía.' }
    }
    setAbriendo(null)
    if (r.ok) setAbierta({ eventId, url: r.datos })
    else setErrorFoto(r.error)
  }

  return (
    <section className="panel-modulo" aria-labelledby="titulo-eventos-habitacion">
      <h2 id="titulo-eventos-habitacion">Eventos de la habitación</h2>
      <p>
        Cada evento con el monitoreo activo pide una fotografía. La cámara no
        graba video y las fotos son privadas: solo las ven los dueños del módulo.
      </p>
      {cargando && <p role="status">Consultando los eventos…</p>}
      {fallo && <p role="alert">No se pudieron consultar los eventos de la habitación.</p>}
      {!cargando && !fallo && eventos.length === 0 && (
        <p>Todavía no hay eventos de la habitación.</p>
      )}
      {errorFoto && <p role="alert">{errorFoto}</p>}
      {eventos.length > 0 && (
        <ul>
          {eventos.map((e) => {
            const foto = fotoDe(e.event_id)
            return (
              <li key={e.event_id}>
                {e.descripcion} · {formatearHoraCR(e.ts)}
                {foto && (
                  <>
                    {' '}
                    <span data-testid={`foto-${e.event_id}`}>{textoFoto(foto)}</span>
                    {foto.estado === 'guardada' && foto.ruta !== null && (
                      <>
                        {' '}
                        {abierta?.eventId === e.event_id ? (
                          <button type="button" onClick={() => setAbierta(null)}>
                            Ocultar foto
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={abriendo === e.event_id}
                            onClick={() => void abrir(e.event_id, foto.ruta as string)}
                          >
                            Ver foto
                          </button>
                        )}
                      </>
                    )}
                    {abierta?.eventId === e.event_id && (
                      <div>
                        <img
                          src={abierta.url}
                          alt={`Fotografía del evento del ${formatearHoraCR(e.ts)}`}
                          style={{ maxWidth: '100%', height: 'auto' }}
                        />
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default PanelEventosHabitacion
