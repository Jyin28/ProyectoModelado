import { useState } from 'react'
import {
  celdasDelMes,
  DIAS_SEMANA,
  mesDeFecha,
  nombreMes,
  sumarMeses,
  type MesCalendario,
} from '../utils/calendario.ts'
import { formatearFechaCivil } from '../utils/tiempo.ts'
import './CalendarioMes.css'

type Props = {
  /** Fecha de inicio elegida (AAAA-MM-DD) o ''. */
  inicio: string
  /** Fecha de fin elegida (AAAA-MM-DD) o ''. */
  fin: string
  /** Qué fecha cambia el próximo toque. */
  modo: 'inicio' | 'fin'
  alElegir: (fecha: string) => void
}

const MES_POR_DEFECTO: MesCalendario = { anio: 2026, mes: 0 }

/**
 * Calendario de un mes (en español, semana desde el lunes) con navegación
 * entre meses. Marca el inicio, el fin y los días intermedios. No conoce las
 * horas: solo fechas civiles.
 */
function CalendarioMes({ inicio, fin, modo, alElegir }: Props) {
  const [mes, setMes] = useState<MesCalendario>(
    () => mesDeFecha(inicio) ?? mesDeFecha(fin) ?? MES_POR_DEFECTO,
  )
  const celdas = celdasDelMes(mes)
  const hayRango = inicio !== '' && fin !== '' && inicio <= fin

  return (
    <div className="calendario" role="group" aria-label="Calendario">
      <div className="calendario-cabecera">
        <button type="button" aria-label="Mes anterior" onClick={() => setMes((m) => sumarMeses(m, -1))}>
          ‹
        </button>
        <p className="calendario-mes" aria-live="polite">
          {nombreMes(mes)}
        </p>
        <button type="button" aria-label="Mes siguiente" onClick={() => setMes((m) => sumarMeses(m, 1))}>
          ›
        </button>
      </div>
      <div className="calendario-rejilla">
        {DIAS_SEMANA.map((d) => (
          <span key={d.largo} className="calendario-dia-semana" aria-hidden="true" title={d.largo}>
            {d.corto}
          </span>
        ))}
        {celdas.map((fecha, i) => {
          if (fecha === null) return <span key={`h${i}`} aria-hidden="true" />
          const esInicio = fecha === inicio
          const esFin = fecha === fin
          const dentro = hayRango && fecha > inicio && fecha < fin
          const clases = ['calendario-dia']
          if (esInicio) clases.push('calendario-dia-inicio')
          if (esFin) clases.push('calendario-dia-fin')
          if (dentro) clases.push('calendario-dia-dentro')
          const nombre = [
            formatearFechaCivil(fecha),
            esInicio ? 'inicio' : null,
            esFin ? 'fin' : null,
          ]
            .filter(Boolean)
            .join(', ')
          return (
            <button
              key={fecha}
              type="button"
              className={clases.join(' ')}
              aria-label={nombre}
              aria-pressed={esInicio || esFin}
              onClick={() => alElegir(fecha)}
              title={modo === 'inicio' ? 'Elegir como inicio' : 'Elegir como fin'}
            >
              {Number(fecha.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CalendarioMes
