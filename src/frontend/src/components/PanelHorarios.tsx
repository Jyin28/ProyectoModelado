import { useEffect, useState } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import { horaValida } from '../utils/ordenes.ts'
import SelectorHora from './SelectorHora.tsx'

// Las ruedas siempre muestran una hora; no se agrega nada hasta pulsar «Agregar».
const HORA_INICIAL = '08:00'

type Props = {
  dispositivoId: string
  /** Tipo de horario del backend, por ejemplo figuras_encender. */
  tipo: string
  titulo: string
  /** Qué ocurre a cada hora; se muestra como aclaración. */
  descripcion: string
  /** true si la hora solo genera un aviso (no una orden para la Pico). */
  soloAviso?: boolean
}

/**
 * Horas del día (hora de Costa Rica) en las que el backend genera una orden.
 * La lista que se muestra es la guardada en el servidor. Si la Pico no está
 * conectada en ese minuto, la orden vence y no se recupera.
 */
function PanelHorarios({ dispositivoId, tipo, titulo, descripcion, soloAviso = false }: Props) {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const activo = backendConfigurado && sesion.tipo === 'autenticado'
  const [guardadas, setGuardadas] = useState<string[] | null>(null)
  const [borrador, setBorrador] = useState<string[]>([])
  const [nueva, setNueva] = useState(HORA_INICIAL)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const idTitulo = `horarios-${tipo}`

  useEffect(() => {
    if (!activo) return
    let vigente = true
    servicios.horarios.listar(dispositivoId, tipo).then((r) => {
      if (!vigente) return
      if (r.ok) {
        setGuardadas(r.datos)
        setBorrador(r.datos)
      } else setError(r.error)
    })
    return () => {
      vigente = false
    }
  }, [activo, servicios, dispositivoId, tipo])

  if (!activo) return null

  function agregar() {
    if (!horaValida(nueva)) {
      setError('Escribe una hora válida (HH:MM).')
      return
    }
    setError(null)
    setBorrador((b) => (b.includes(nueva) ? b : [...b, nueva].sort()))
  }

  async function guardar() {
    if (guardando) return
    setGuardando(true)
    setError(null)
    const r = await servicios.horarios.reemplazar(dispositivoId, tipo, borrador)
    setGuardando(false)
    if (!r.ok) return setError(r.error)
    setGuardadas(r.datos)
    setBorrador(r.datos)
  }

  const sinCambios =
    guardadas !== null &&
    guardadas.length === borrador.length &&
    guardadas.every((h, i) => h === borrador[i])

  return (
    <div role="group" aria-labelledby={idTitulo} className="panel-horarios">
      <h3 id={idTitulo}>{titulo}</h3>
      <p>
        {descripcion} Hora de Costa Rica.
        {soloAviso
          ? ' Es solo un aviso: no envía ninguna orden a la Pico.'
          : ' Si la Pico no está conectada en ese minuto, la orden no se recupera.'}
      </p>
      {guardadas === null && !error && <p role="status">Cargando horarios…</p>}
      {guardadas !== null && borrador.length === 0 && <p>Sin horas programadas.</p>}
      {borrador.length > 0 && (
        <ul>
          {borrador.map((hora) => (
            <li key={hora}>
              <span>{hora}</span>
              <button
                type="button"
                onClick={() => setBorrador((b) => b.filter((h) => h !== hora))}
                aria-label={`Quitar ${hora} de ${titulo}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <SelectorHora etiqueta={`Nueva hora para ${titulo}`} valor={nueva} alCambiar={setNueva} />
      <div className="panel-horarios-acciones">
        <button type="button" onClick={agregar} aria-label={`Agregar hora a ${titulo}`}>
          Agregar
        </button>
        <button
          type="button"
          className="boton-primario"
          onClick={guardar}
          disabled={guardando || sinCambios}
          aria-busy={guardando}
          aria-label={`Guardar horarios de ${titulo}`}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default PanelHorarios
