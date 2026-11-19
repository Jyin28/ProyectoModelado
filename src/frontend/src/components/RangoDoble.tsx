import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import './RangoDoble.css'

type Props = {
  /** Título visible del rango, por ejemplo «Temperatura». */
  titulo: string
  /** Nombres accesibles de cada extremo. */
  etiquetaMinimo: string
  etiquetaMaximo: string
  /** Extremos de la escala. */
  desde: number
  hasta: number
  paso: number
  unidad: string
  decimales?: number
  /** Límite inferior y superior elegidos; null si todavía no se eligieron. */
  minimo: number | null
  maximo: number | null
  alCambiar: (minimo: number, maximo: number) => void
}

type Extremo = 'minimo' | 'maximo'

const limitar = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

/**
 * Deslizador con dos extremos para un rango (mínimo y máximo). Cada extremo se
 * mueve arrastrando, con teclado (flechas ±paso, Re Pág/Av Pág ±10 pasos,
 * Inicio/Fin) y nunca cruza al otro. Mientras no haya valores elegidos los
 * extremos están en los bordes de la escala y se dice «sin elegir»: la primera
 * vez que se toca uno, los dos quedan elegidos tal como se ven.
 */
function RangoDoble({
  titulo,
  etiquetaMinimo,
  etiquetaMaximo,
  desde,
  hasta,
  paso,
  unidad,
  decimales = 0,
  minimo,
  maximo,
  alCambiar,
}: Props) {
  const pista = useRef<HTMLDivElement>(null)
  const activo = useRef<Extremo | null>(null)
  const sinElegir = minimo === null || maximo === null
  const bajo = minimo ?? desde
  const alto = maximo ?? hasta
  const pos = (v: number) => ((limitar(v, desde, hasta) - desde) / (hasta - desde)) * 100
  const formato = (v: number) =>
    v.toLocaleString('es-CR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

  function ajustar(valor: number): number {
    const redondeado = Math.round((valor - desde) / paso) * paso + desde
    return Number(limitar(redondeado, desde, hasta).toFixed(4))
  }

  function fijar(extremo: Extremo, valor: number) {
    const v = ajustar(valor)
    if (extremo === 'minimo') alCambiar(Math.min(v, alto - paso), alto)
    else alCambiar(bajo, Math.max(v, bajo + paso))
  }

  function valorDeX(clientX: number): number {
    const caja = pista.current?.getBoundingClientRect()
    if (!caja || caja.width === 0) return bajo
    return desde + limitar((clientX - caja.left) / caja.width, 0, 1) * (hasta - desde)
  }

  function alPresionar(evento: PointerEvent<HTMLDivElement>) {
    const valor = valorDeX(evento.clientX)
    // Se mueve el extremo más cercano; con los dos juntos, el que deja espacio hacia el toque.
    let extremo: Extremo
    if (Math.abs(valor - bajo) < Math.abs(valor - alto)) extremo = 'minimo'
    else if (Math.abs(valor - bajo) > Math.abs(valor - alto)) extremo = 'maximo'
    else extremo = valor < bajo ? 'minimo' : 'maximo'
    activo.current = extremo
    evento.currentTarget.setPointerCapture?.(evento.pointerId)
    fijar(extremo, valor)
  }

  function alMover(evento: PointerEvent<HTMLDivElement>) {
    if (activo.current) fijar(activo.current, valorDeX(evento.clientX))
  }

  function alSoltar(evento: PointerEvent<HTMLDivElement>) {
    activo.current = null
    evento.currentTarget.releasePointerCapture?.(evento.pointerId)
  }

  function alTeclear(extremo: Extremo, evento: KeyboardEvent<HTMLDivElement>) {
    const actual = extremo === 'minimo' ? bajo : alto
    const teclas: Record<string, number> = {
      ArrowRight: actual + paso,
      ArrowUp: actual + paso,
      ArrowLeft: actual - paso,
      ArrowDown: actual - paso,
      PageUp: actual + paso * 10,
      PageDown: actual - paso * 10,
      Home: desde,
      End: hasta,
    }
    const destino = teclas[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    fijar(extremo, destino)
  }

  const texto = (v: number | null) => (v === null ? '—' : `${formato(v)} ${unidad}`)

  return (
    <div className={sinElegir ? 'rango rango-sin-elegir' : 'rango'}>
      <div className="rango-cabecera">
        <h3>{titulo}</h3>
        <p className="rango-valores" aria-hidden="true">
          <span>{texto(minimo)}</span>
          <span className="rango-guion"> a </span>
          <span>{texto(maximo)}</span>
        </p>
      </div>
      <div
        ref={pista}
        className="rango-pista"
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        <div className="rango-riel" />
        <div
          className="rango-relleno"
          style={{ left: `${pos(bajo)}%`, width: `${pos(alto) - pos(bajo)}%` }}
        />
        {(
          [
            ['minimo', etiquetaMinimo, bajo, minimo, desde, alto - paso],
            ['maximo', etiquetaMaximo, alto, maximo, bajo + paso, hasta],
          ] as const
        ).map(([extremo, etiqueta, valor, elegido, vmin, vmax]) => (
          <div
            key={extremo}
            className="rango-tirador"
            role="slider"
            tabIndex={0}
            aria-label={etiqueta}
            aria-valuemin={vmin}
            aria-valuemax={vmax}
            aria-valuenow={valor}
            aria-valuetext={elegido === null ? 'Sin elegir' : `${formato(elegido)} ${unidad}`}
            style={{ left: `${pos(valor)}%` }}
            onKeyDown={(e) => alTeclear(extremo, e)}
          />
        ))}
      </div>
      <div className="rango-escala" aria-hidden="true">
        <span>
          {formato(desde)} {unidad}
        </span>
        <span>
          {formato(hasta)} {unidad}
        </span>
      </div>
      {sinElegir && <p className="rango-aviso">Sin elegir: mueve un extremo para empezar.</p>}
    </div>
  )
}

export default RangoDoble
