import { useState } from 'react'
import {
  NOMBRE_CAMPO,
  NOMBRE_ESTADO_TOMA,
  type CorreccionToma,
  type Toma,
} from '../models/alimentacion.ts'
import {
  camposCorregibles,
  duracionVisibleS,
  formatearDuracion,
  formatearGramos,
} from '../utils/alimentacion.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'
import FormularioCorreccionToma from './FormularioCorreccionToma.tsx'

type Props = {
  tomas: Toma[]
  recibidoEn: number
  alCorregir: () => void
}

function textoCorreccion(c: CorreccionToma): string {
  const anterior = c.valor_anterior === null ? 'sin valor' : formatearGramos(c.valor_anterior)
  const autor = c.propia ? 'Tú' : 'Otro dueño'
  return `${NOMBRE_CAMPO[c.campo]}: de ${anterior} a ${formatearGramos(c.valor_nuevo)}. Autor: ${autor}. ${formatearHoraCR(c.creada_en)}. Motivo: ${c.motivo}`
}

/**
 * Tomas registradas con sus gramos, duración activa y correcciones. Las
 * correcciones conservan el valor anterior: nunca se borra el original.
 */
function HistorialTomas({ tomas, recibidoEn, alCorregir }: Props) {
  const [abierta, setAbierta] = useState<string | null>(null)
  if (tomas.length === 0) return <p>Todavía no hay tomas registradas.</p>

  return (
    <ul aria-label="Tomas registradas">
      {tomas.map((t) => {
        const duracion = duracionVisibleS(t, recibidoEn, recibidoEn)
        const puedeCorregir = camposCorregibles(t).length > 0
        return (
          <li key={t.id} data-estado={t.estado}>
            <p>
              <strong>{NOMBRE_ESTADO_TOMA[t.estado]}</strong>
              {t.inicio ? `, inició ${formatearHoraCR(t.inicio)}` : `, creada ${formatearHoraCR(t.creada_en)}`}
            </p>
            <p>
              Peso inicial: {t.peso_inicial_g === null ? 'sin dato' : formatearGramos(t.peso_inicial_g)}.
              {' '}Peso final: {t.peso_final_g === null ? 'sin dato' : formatearGramos(t.peso_final_g)}.
              {t.ingerido_g !== null && <> Ingerido: {formatearGramos(t.ingerido_g)}.</>}
              {duracion !== null && <> Duración activa: {formatearDuracion(duracion)}.</>}
              {t.pausas.length > 0 && <> Pausas: {t.pausas.length}.</>}
            </p>
            {t.correcciones.length > 0 && (
              <ul aria-label="Correcciones de la toma">
                {t.correcciones.map((c, i) => (
                  <li key={i}>{textoCorreccion(c)}</li>
                ))}
              </ul>
            )}
            {puedeCorregir && abierta !== t.id && (
              <button type="button" onClick={() => setAbierta(t.id)}>
                Corregir peso
              </button>
            )}
            {puedeCorregir && abierta === t.id && (
              <FormularioCorreccionToma
                toma={t}
                alCorregir={() => {
                  setAbierta(null)
                  alCorregir()
                }}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default HistorialTomas
