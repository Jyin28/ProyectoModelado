import { useState, type FormEvent } from 'react'
import type { Bebe } from '../models/cuentas.ts'
import type { Intervalo } from '../models/historial.ts'
import { fechaYHoraCR, intervaloNoche, MS_POR_DIA } from '../utils/tiempo.ts'

export interface ConsultaElegida {
  bebeId: string
  intervalo: Intervalo
}

type Props = {
  bebes: Bebe[]
  ocupado: boolean
  alConsultar: (consulta: ConsultaElegida) => void
  /** Instante de referencia para los atajos; solo lo cambian las pruebas. */
  ahora?: () => number
}

const MENSAJE_INTERVALO = 'Revisa la fecha y las horas: no forman un intervalo válido.'

/** Fecha y hora de Costa Rica de un instante, como valores de los campos del formulario. */
function camposDe(ms: number): { fecha: string; hora: string } {
  const cr = fechaYHoraCR(new Date(ms).toISOString())
  return { fecha: cr?.fecha ?? '', hora: (cr?.hora ?? '00:00:00').slice(0, 5) }
}

/**
 * Elige bebé y noche. El inicio es una fecha y una hora; el fin es solo una
 * hora y, si no es posterior al inicio, cae al día siguiente (cruza la
 * medianoche). Todo se interpreta en hora de Costa Rica.
 */
function FormularioIntervaloHistorial({ bebes, ocupado, alConsultar, ahora = Date.now }: Props) {
  const [bebeId, setBebeId] = useState(bebes[0]?.id ?? '')
  const [fecha, setFecha] = useState(() => camposDe(ahora() - MS_POR_DIA).fecha)
  const [horaInicio, setHoraInicio] = useState('19:00')
  const [horaFin, setHoraFin] = useState('07:00')
  const [error, setError] = useState<string | null>(null)
  const bebeEfectivo = bebes.some((b) => b.id === bebeId) ? bebeId : (bebes[0]?.id ?? '')

  function atajoNoche() {
    setFecha(camposDe(ahora() - MS_POR_DIA).fecha)
    setHoraInicio('19:00')
    setHoraFin('07:00')
  }

  function atajoUltimas24() {
    const actual = camposDe(ahora())
    setFecha(camposDe(ahora() - MS_POR_DIA).fecha)
    setHoraInicio(actual.hora)
    setHoraFin(actual.hora)
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    const intervalo = intervaloNoche(fecha, horaInicio, horaFin)
    if (!intervalo || bebeEfectivo === '') {
      setError(MENSAJE_INTERVALO)
      return
    }
    setError(null)
    alConsultar({ bebeId: bebeEfectivo, intervalo })
  }

  return (
    <form className="formulario-historial" onSubmit={enviar} aria-label="Elegir bebé e intervalo">
      <label>
        Bebé
        <select value={bebeEfectivo} onChange={(e) => setBebeId(e.target.value)}>
          {bebes.map((bebe) => (
            <option key={bebe.id} value={bebe.id}>
              {bebe.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Fecha de inicio
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <label>
        Hora de inicio
        <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />
      </label>
      <label>
        Hora de fin
        <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} required />
      </label>
      <p className="formulario-historial-ayuda">
        Si la hora de fin no es posterior a la de inicio, el intervalo termina al día siguiente. Horas de Costa Rica.
      </p>
      <div className="formulario-historial-acciones">
        <button type="button" onClick={atajoNoche}>
          Última noche (19:00 a 07:00)
        </button>
        <button type="button" onClick={atajoUltimas24}>
          Últimas 24 horas
        </button>
        <button type="submit" disabled={ocupado || bebes.length === 0}>
          Consultar
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default FormularioIntervaloHistorial
