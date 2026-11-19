import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nombreTipo } from '../models/historial.ts'
import type { CuboHora } from '../utils/historial.ts'
import { MS_POR_HORA, ZONA_CR } from '../utils/tiempo.ts'

type Props = { cubos: CuboHora[] }

const formatoHora = new Intl.DateTimeFormat('es-CR', {
  timeZone: ZONA_CR,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const etiquetaHora = (ms: number) => formatoHora.format(new Date(ms))
const rangoHora = (ms: number) => `${etiquetaHora(ms)} a ${etiquetaHora(ms + MS_POR_HORA)}`

/**
 * Eventos por hora en intervalos [inicio, fin). Una hora sin ningún registro
 * es «sin datos» (sin barra y con ese texto), distinta de una hora con datos y
 * cero eventos (que se muestra como 0). La tabla repite el gráfico en texto.
 */
function GraficoEventosPorHora({ cubos }: Props) {
  if (cubos.length === 0) return null
  const datos = cubos.map((c) => ({
    etiqueta: etiquetaHora(c.inicio),
    eventos: c.estado === 'sin_datos' ? null : c.eventos,
  }))
  return (
    <section className="grafico-historial" aria-labelledby="titulo-grafico-eventos">
      <h2 id="titulo-grafico-eventos">Eventos por hora</h2>
      <div className="grafico-historial-lienzo" role="img" aria-label="Gráfico de barras de eventos por hora">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="etiqueta" interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} width={40} />
            <Tooltip formatter={(v) => [v === null || v === undefined ? 'Sin datos' : String(v), 'Eventos']} />
            <Bar dataKey="eventos" fill="var(--accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>Ver eventos por hora como tabla</summary>
        <div className="tabla-historial-contenedor">
          <table className="tabla-historial">
            <caption>Eventos por hora (hora de Costa Rica; cada hora incluye su inicio y excluye su fin)</caption>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Eventos</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {cubos.map((c) => (
                <tr key={c.inicio}>
                  <td>{rangoHora(c.inicio)}</td>
                  <td>{c.estado === 'sin_datos' ? 'Sin datos' : c.eventos}</td>
                  <td>
                    {Object.entries(c.porTipo)
                      .map(([tipo, n]) => `${nombreTipo(tipo)}: ${n}`)
                      .join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export default GraficoEventosPorHora
