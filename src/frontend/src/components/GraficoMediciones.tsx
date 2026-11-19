import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nombreTipo } from '../models/historial.ts'
import { reducirSerie, type SerieMedicion } from '../utils/historial.ts'
import { formatearHoraCR, ZONA_CR } from '../utils/tiempo.ts'

type Props = { series: SerieMedicion[] }

/** Máximo de puntos que se dibujan por serie (la lista y el Excel llevan todos). */
export const PUNTOS_MAXIMOS_GRAFICO = 600

const formatoEje = new Intl.DateTimeFormat('es-CR', {
  timeZone: ZONA_CR,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const numero = (n: number) => new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 }).format(n)
const textoCR = (t: number) => formatearHoraCR(new Date(t).toISOString())

function GraficoSerie({ serie }: { serie: SerieMedicion }) {
  const puntos = reducirSerie(serie.puntos, PUNTOS_MAXIMOS_GRAFICO)
  const reducida = puntos.length < serie.puntos.length
  const reales = serie.puntos.filter((p) => p.valor !== null)
  const primera = reales[0]
  const ultima = reales[reales.length - 1]
  const nombre = nombreTipo(serie.tipo)
  return (
    <section className="grafico-historial" aria-labelledby={`titulo-serie-${serie.tipo}`}>
      <h3 id={`titulo-serie-${serie.tipo}`}>
        {nombre} ({serie.unidad})
      </h3>
      <div className="grafico-historial-lienzo" role="img" aria-label={`Línea de ${nombre} en ${serie.unidad}`}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={puntos} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t: number) => formatoEje.format(new Date(t))}
              minTickGap={32}
            />
            <YAxis
              domain={['auto', 'auto']}
              unit={` ${serie.unidad}`}
              width={80}
              tickFormatter={(v: number) => numero(v)}
            />
            <Tooltip
              labelFormatter={(t) => textoCR(Number(t))}
              formatter={(v) => [`${numero(Number(v))} ${serie.unidad}`, nombre]}
            />
            <Line
              type="linear"
              dataKey="valor"
              stroke="var(--accent)"
              dot={serie.total <= 60}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p>
        {serie.total} lecturas
        {primera && ultima && ` de ${textoCR(primera.t)} a ${textoCR(ultima.t)}`}. Los tramos sin lecturas quedan
        cortados, no unidos.
        {reducida &&
          ' El gráfico conserva el mínimo y el máximo de cada tramo; la lista y el Excel llevan todas las lecturas.'}
      </p>
    </section>
  )
}

/** Mediciones como líneas, una por tipo, con fecha, hora y unidad. */
function GraficoMediciones({ series }: Props) {
  if (series.length === 0) return null
  return (
    <section aria-labelledby="titulo-mediciones">
      <h2 id="titulo-mediciones">Mediciones</h2>
      {series.map((s) => (
        <GraficoSerie key={s.tipo} serie={s} />
      ))}
    </section>
  )
}

export default GraficoMediciones
