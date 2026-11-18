import { nombreTipo, type Intervalo } from '../models/historial.ts'
import type { ResumenNoche as Resumen } from '../utils/historial.ts'
import { formatearCortoCR, MS_POR_HORA } from '../utils/tiempo.ts'

type Props = { resumen: Resumen | null; intervalo: Intervalo }

const numero = (n: number) => new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 }).format(n)

/**
 * Resumen del intervalo elegido, solo en la app (no se envía a Telegram).
 * Sin registros se dice así; no se muestran ceros que parezcan actividad.
 */
function ResumenNoche({ resumen, intervalo }: Props) {
  const desde = formatearCortoCR(intervalo.desde)
  const hasta = formatearCortoCR(intervalo.hasta)
  return (
    <section className="resumen-noche" aria-labelledby="titulo-resumen-noche">
      <h2 id="titulo-resumen-noche">Resumen del intervalo</h2>
      {resumen === null ? (
        <p role="status">
          No hay registros entre {desde} y {hasta}.
        </p>
      ) : (
        <>
          <p>
            Del {desde} al {hasta} (hora de Costa Rica).
          </p>
          <dl className="resumen-noche-datos">
            <dt>Registros</dt>
            <dd>{resumen.totalRegistros}</dd>
            <dt>Movimientos</dt>
            <dd>
              {resumen.movimientos}
              {resumen.horaMasActiva && (
                <>
                  {' '}
                  (más actividad de {formatearCortoCR(resumen.horaMasActiva.inicio)} a{' '}
                  {formatearCortoCR(resumen.horaMasActiva.inicio + MS_POR_HORA)}: {resumen.horaMasActiva.movimientos})
                </>
              )}
            </dd>
            {resumen.temperatura && (
              <>
                <dt>Temperatura ambiente</dt>
                <dd>
                  de {numero(resumen.temperatura.minimo)} a {numero(resumen.temperatura.maximo)}{' '}
                  {resumen.temperatura.unidad}
                </dd>
              </>
            )}
            {resumen.humedad && (
              <>
                <dt>Humedad ambiente</dt>
                <dd>
                  de {numero(resumen.humedad.minimo)} a {numero(resumen.humedad.maximo)} {resumen.humedad.unidad}
                </dd>
              </>
            )}
            {resumen.tomas.cantidad > 0 && (
              <>
                <dt>Tomas completas</dt>
                <dd>
                  {resumen.tomas.cantidad} ({numero(resumen.tomas.gramos)} g en total)
                </dd>
              </>
            )}
            {resumen.fotos > 0 && (
              <>
                <dt>Fotos</dt>
                <dd>{resumen.fotos}</dd>
              </>
            )}
          </dl>
          {resumen.eventosPorTipo.length > 0 && (
            <ul aria-label="Eventos por tipo">
              {resumen.eventosPorTipo.map((e) => (
                <li key={e.tipo}>
                  {nombreTipo(e.tipo)}: {e.cantidad}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export default ResumenNoche
