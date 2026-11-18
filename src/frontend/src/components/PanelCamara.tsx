import { useState, type ChangeEvent } from 'react'
import { useHabitacion } from '../hooks/useHabitacion.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import { textoFoto } from '../utils/habitacion.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'

type Props = { dispositivoId: string }

/**
 * Este teléfono como cámara de la habitación. Lista las fotos pendientes (o
 * fallidas, para reintentar) y sube la imagen al almacén privado. Si la cámara
 * no está disponible se deja constancia: el estado de la foto lo muestra.
 */
function PanelCamara({ dispositivoId }: Props) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const activo = backendConfigurado && sesion.tipo === 'autenticado'
  const { cargando, fallo, eventos, fotos, refrescar } = useHabitacion(dispositivoId)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  if (!activo) return null

  const solicitudes = fotos.filter((f) => f.estado !== 'guardada')

  async function subir(eventId: string, evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setMensaje(null)
    setTrabajando(eventId)
    let r
    try {
      r = await servicios.habitacion.subirFoto(dispositivoId, eventId, archivo)
    } catch {
      r = { ok: false as const, error: 'No se pudo guardar la fotografía.' }
    }
    setTrabajando(null)
    setMensaje(r.ok ? { tipo: 'ok', texto: 'Foto guardada.' } : { tipo: 'error', texto: r.error })
    refrescar()
  }

  async function noSePudo(eventId: string) {
    setMensaje(null)
    setTrabajando(eventId)
    let r
    try {
      r = await servicios.habitacion.marcarFallida(eventId, 'camara_no_disponible')
    } catch {
      r = { ok: false as const, error: 'No se pudo registrar el motivo.' }
    }
    setTrabajando(null)
    setMensaje(
      r.ok
        ? { tipo: 'ok', texto: 'Quedó registrado que la cámara no estuvo disponible.' }
        : { tipo: 'error', texto: r.error },
    )
    refrescar()
  }

  return (
    <section className="panel-modulo" aria-labelledby="titulo-camara">
      <h2 id="titulo-camara">Cámara de la habitación</h2>
      <p>
        Usa este teléfono como cámara: toma la foto de cada evento pendiente. Solo
        se guardan fotografías (sin video) y solo las ven los dueños del módulo.
      </p>
      {cargando && <p role="status">Consultando las fotos pendientes…</p>}
      {fallo && <p role="alert">No se pudieron consultar las fotografías.</p>}
      {mensaje && <p role={mensaje.tipo === 'ok' ? 'status' : 'alert'}>{mensaje.texto}</p>}
      {!cargando && !fallo && solicitudes.length === 0 && <p>No hay fotos pendientes.</p>}
      {solicitudes.length > 0 && (
        <ul>
          {solicitudes.map((foto) => {
            const evento = eventos.find((e) => e.event_id === foto.event_id)
            const nombre = evento
              ? `${evento.descripcion} · ${formatearHoraCR(evento.ts)}`
              : `Solicitada el ${formatearHoraCR(foto.solicitada_en)}`
            return (
              <li key={foto.event_id}>
                <p>
                  {nombre}. {textoFoto(foto)}
                </p>
                <label>
                  Tomar o elegir foto de {nombre}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    disabled={trabajando !== null}
                    onChange={(e) => void subir(foto.event_id, e)}
                  />
                </label>
                {foto.estado === 'pendiente' && (
                  <button
                    type="button"
                    disabled={trabajando !== null}
                    onClick={() => void noSePudo(foto.event_id)}
                  >
                    No se pudo tomar la foto de {nombre}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default PanelCamara
