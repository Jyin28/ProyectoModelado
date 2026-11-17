import { useAhora } from '../hooks/useAhora.ts'
import {
  antiguedadSegundos,
  describirAntiguedad,
  estaDesactualizado,
  formatearHoraCR,
} from '../utils/tiempo.ts'
import './TarjetaLectura.css'

interface Props {
  etiqueta: string
  valor: number | null
  unidad: string
  decimales: number
  registradoEn: string | null
  umbralDesactualizadoS: number
}

type Estado = 'sin-datos' | 'actual' | 'desactualizado'

const INSIGNIA: Record<Estado, { icono: string; texto: string }> = {
  'sin-datos': { icono: '—', texto: 'Sin datos' },
  actual: { icono: '●', texto: 'Actual' },
  desactualizado: { icono: '⚠', texto: 'Desactualizado' },
}

function TarjetaLectura({
  etiqueta,
  valor,
  unidad,
  decimales,
  registradoEn,
  umbralDesactualizadoS,
}: Props) {
  const ahora = useAhora()

  let estado: Estado = 'sin-datos'
  if (valor !== null && registradoEn !== null) {
    estado = estaDesactualizado(registradoEn, ahora, umbralDesactualizadoS)
      ? 'desactualizado'
      : 'actual'
  }

  const insignia = INSIGNIA[estado]
  const tieneLectura = valor !== null && registradoEn !== null

  return (
    <article
      className="tarjeta-lectura"
      aria-label={etiqueta}
      data-estado={estado}
    >
      <h2 className="tarjeta-lectura-etiqueta">{etiqueta}</h2>
      <p className="tarjeta-lectura-insignia">
        <span aria-hidden="true">{insignia.icono}</span> {insignia.texto}
      </p>
      {tieneLectura && (
        <>
          {estado === 'desactualizado' && (
            <p className="tarjeta-lectura-aviso">Último valor</p>
          )}
          <p className="tarjeta-lectura-valor">
            {valor.toLocaleString('es-CR', {
              minimumFractionDigits: decimales,
              maximumFractionDigits: decimales,
            })}{' '}
            <span className="tarjeta-lectura-unidad">{unidad}</span>
          </p>
          <p className="tarjeta-lectura-meta">
            Registrado: {formatearHoraCR(registradoEn)}
          </p>
          <p className="tarjeta-lectura-meta">
            {describirAntiguedad(antiguedadSegundos(registradoEn, ahora))}
          </p>
        </>
      )}
    </article>
  )
}

export default TarjetaLectura
