import { useState } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import { esMedicion, nombreTipo, type RegistroHistorial } from '../models/historial.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'

type Props = { registros: RegistroHistorial[] }

/** Máximo de filas que se dibujan; el Excel lleva todos los registros. */
export const FILAS_MAXIMAS_LISTA = 500

type FotoAbierta = { id: string; url: string }

const numero = (n: number) => new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 }).format(n)

/**
 * Eventos del intervalo, del más antiguo al más reciente. Las mediciones
 * continuas (ambiente) se ven en los gráficos. La foto de un evento de
 * habitación solo llega a las personas dueñas del módulo y se abre con un
 * enlace que caduca a los 60 s.
 */
function ListaRegistros({ registros }: Props) {
  const { servicios } = useServicios()
  const [abierta, setAbierta] = useState<FotoAbierta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState<string | null>(null)

  const eventos = registros.filter((r) => !esMedicion(r.tipo))
  const visibles = eventos.slice(0, FILAS_MAXIMAS_LISTA)

  async function abrir(id: string, ruta: string) {
    setError(null)
    setAbriendo(id)
    let r
    try {
      r = await servicios.habitacion.urlFoto(ruta)
    } catch {
      r = { ok: false as const, error: 'No se pudo abrir la fotografía.' }
    }
    setAbriendo(null)
    if (r.ok) setAbierta({ id, url: r.datos })
    else setError(r.error)
  }

  return (
    <section className="lista-registros" aria-labelledby="titulo-lista-registros">
      <h2 id="titulo-lista-registros">Eventos</h2>
      {eventos.length === 0 ? (
        <p role="status">No hay eventos en este intervalo.</p>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          <ul aria-label="Eventos del intervalo">
            {visibles.map((r) => (
              <li key={r.registro_id}>
                <span>
                  {formatearHoraCR(r.ts)} · {nombreTipo(r.tipo)}
                  {r.descripcion && r.descripcion !== nombreTipo(r.tipo) ? ` · ${r.descripcion}` : ''}
                  {r.valor !== null && ` · ${numero(r.valor)}${r.unidad ? ` ${r.unidad}` : ''}`}
                  {r.toma?.duracion_s != null && ` · ${Math.round(r.toma.duracion_s / 60)} min de toma`}
                </span>
                {r.foto && (
                  <span>
                    {' '}
                    {r.foto.estado === 'guardada' && r.foto.ruta !== null ? (
                      abierta?.id === r.registro_id ? (
                        <button type="button" onClick={() => setAbierta(null)}>
                          Ocultar foto
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={abriendo === r.registro_id}
                          onClick={() => void abrir(r.registro_id, r.foto?.ruta as string)}
                        >
                          Ver foto
                        </button>
                      )
                    ) : r.foto.estado === 'pendiente' ? (
                      'Foto pendiente'
                    ) : (
                      'Foto no disponible'
                    )}
                  </span>
                )}
                {abierta?.id === r.registro_id && (
                  <div>
                    <img
                      src={abierta.url}
                      alt={`Fotografía del evento del ${formatearHoraCR(r.ts)}`}
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {eventos.length > visibles.length && (
            <p role="status">
              Se muestran los primeros {visibles.length} de {eventos.length} eventos. El Excel incluye todos los
              registros.
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default ListaRegistros
