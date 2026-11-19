import { formatearHoraCR } from '../utils/tiempo.ts'
import './FechasOrden.css'

type Props = {
  creadoEn: string
  venceEn: string
}

/**
 * Cuándo se pidió la orden y cuándo vence. Es información de apoyo, no la
 * parte principal: se muestra pequeña y apagada, en una sola línea.
 */
function FechasOrden({ creadoEn, venceEn }: Props) {
  return (
    <p className="fechas-orden">
      <span>Solicitada: {formatearHoraCR(creadoEn)}</span>
      <span aria-hidden="true"> · </span>
      <span>Vence: {formatearHoraCR(venceEn)}</span>
    </p>
  )
}

export default FechasOrden
