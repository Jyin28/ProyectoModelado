import { useState, type FormEvent } from 'react'
import type { Bebe } from '../models/cuentas.ts'
import type { Intervalo } from '../models/historial.ts'
import { describirDuracion } from '../utils/calendario.ts'
import {
  crAUtc,
  fechaYHoraCR,
  formatearCortoCR,
  intervaloNoche,
  MS_POR_DIA,
} from '../utils/tiempo.ts'
import CalendarioMes from './CalendarioMes.tsx'

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
const MENSAJE_ORDEN = 'El fin debe ser posterior al inicio.'

/** Fecha y hora de Costa Rica de un instante, como valores de los campos del formulario. */
function camposDe(ms: number): { fecha: string; hora: string } {
  const cr = fechaYHoraCR(new Date(ms).toISOString())
  return { fecha: cr?.fecha ?? '', hora: (cr?.hora ?? '00:00:00').slice(0, 5) }
}

/**
 * Elige bebé e intervalo con un calendario y horas. Si no se elige la fecha de
 * fin, el intervalo termina en la próxima vez que el reloj marque la hora de
 * fin (cruza la medianoche cuando hace falta); al elegirla, manda la elegida.
 * Todo se interpreta en hora de Costa Rica y se resume antes de consultar.
 */
function FormularioIntervaloHistorial({ bebes, ocupado, alConsultar, ahora = Date.now }: Props) {
  const [bebeId, setBebeId] = useState(bebes[0]?.id ?? '')
  const [fecha, setFecha] = useState(() => camposDe(ahora() - MS_POR_DIA).fecha)
  const [horaInicio, setHoraInicio] = useState('19:00')
  const [horaFin, setHoraFin] = useState('07:00')
  // '' = fin automático (próxima vez que el reloj marque la hora de fin).
  const [fechaFinElegida, setFechaFinElegida] = useState('')
  const [modo, setModo] = useState<'inicio' | 'fin'>('inicio')
  const [error, setError] = useState<string | null>(null)
  const bebeEfectivo = bebes.some((b) => b.id === bebeId) ? bebeId : (bebes[0]?.id ?? '')

  const intervalo: Intervalo | null =
    fechaFinElegida === ''
      ? intervaloNoche(fecha, horaInicio, horaFin)
      : (() => {
          const desde = crAUtc(fecha, horaInicio)
          const hasta = crAUtc(fechaFinElegida, horaFin)
          return desde === null || hasta === null ? null : { desde, hasta }
        })()
  const ordenValido = intervalo !== null && intervalo.hasta > intervalo.desde
  const fechaFin = fechaFinElegida !== '' ? fechaFinElegida : intervalo ? camposDe(intervalo.hasta).fecha : ''

  function atajoNoche() {
    setFecha(camposDe(ahora() - MS_POR_DIA).fecha)
    setHoraInicio('19:00')
    setHoraFin('07:00')
    setFechaFinElegida('')
    setError(null)
  }

  function atajoUltimas24() {
    const actual = camposDe(ahora())
    setFecha(camposDe(ahora() - MS_POR_DIA).fecha)
    setHoraInicio(actual.hora)
    setHoraFin(actual.hora)
    setFechaFinElegida('')
    setError(null)
  }

  function alElegirDia(dia: string) {
    setError(null)
    if (modo === 'inicio') {
      setFecha(dia)
      setModo('fin')
    } else {
      setFechaFinElegida(dia)
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!intervalo || bebeEfectivo === '') {
      setError(MENSAJE_INTERVALO)
      return
    }
    if (!ordenValido) {
      setError(MENSAJE_ORDEN)
      return
    }
    setError(null)
    alConsultar({ bebeId: bebeEfectivo, intervalo })
  }

  let resumen: string
  if (!intervalo) resumen = 'Elige una fecha y horas válidas para ver el resumen.'
  else if (!ordenValido) resumen = MENSAJE_ORDEN
  else {
    resumen = `Del ${formatearCortoCR(intervalo.desde)} al ${formatearCortoCR(intervalo.hasta)} (hora de Costa Rica) · ${describirDuracion(intervalo.hasta - intervalo.desde)}`
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

      <div role="group" aria-label="Fecha que cambia el calendario" className="formulario-historial-modo">
        <button type="button" aria-pressed={modo === 'inicio'} onClick={() => setModo('inicio')}>
          Elegir inicio
        </button>
        <button type="button" aria-pressed={modo === 'fin'} onClick={() => setModo('fin')}>
          Elegir fin
        </button>
      </div>
      <CalendarioMes inicio={fecha} fin={fechaFin} modo={modo} alElegir={alElegirDia} />

      <div className="formulario-historial-campos">
        <label>
          Fecha de inicio
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label>
          Hora de inicio
          <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />
        </label>
        <label>
          Fecha de fin
          <input type="date" value={fechaFin} onChange={(e) => setFechaFinElegida(e.target.value)} />
        </label>
        <label>
          Hora de fin
          <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} required />
        </label>
      </div>
      <p className="formulario-historial-ayuda">
        Si no eliges la fecha de fin, el intervalo termina en la próxima hora de fin, al día siguiente si hace falta.
        Horas de Costa Rica.
      </p>
      <p className="formulario-historial-resumen" role="status" data-valido={ordenValido}>
        {resumen}
      </p>
      <div className="formulario-historial-acciones">
        <button type="button" onClick={atajoNoche}>
          Última noche (19:00 a 07:00)
        </button>
        <button type="button" onClick={atajoUltimas24}>
          Últimas 24 horas
        </button>
        <button type="submit" className="boton-primario" disabled={ocupado || bebes.length === 0} aria-busy={ocupado}>
          Consultar
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export default FormularioIntervaloHistorial
