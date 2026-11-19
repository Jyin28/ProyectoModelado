const limitar = (n: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, n))

/** «log»: los valores pequeños tienen más recorrido (segundos). «lineal»: recorrido parejo (porcentajes). */
export type EscalaPerilla = 'log' | 'lineal'

/** Entero más cercano al valor que cae en la rejilla de `paso`, dentro de [minimo, maximo]. */
export function ajustarAlPaso(valor: number, minimo: number, maximo: number, paso: number): number {
  return limitar(Math.round(valor / paso) * paso, minimo, maximo)
}

/** Posición 0..1 de un valor. Por defecto logarítmica: los segundos cortos tienen más recorrido. */
export function posicionDeValor(
  valor: number,
  minimo: number,
  maximo: number,
  escala: EscalaPerilla = 'log',
): number {
  if (escala === 'lineal') return (limitar(valor, minimo, maximo) - minimo) / (maximo - minimo)
  return Math.log(limitar(valor, minimo, maximo) / minimo) / Math.log(maximo / minimo)
}

export function valorDePosicion(
  posicion: number,
  minimo: number,
  maximo: number,
  paso: number,
  escala: EscalaPerilla = 'log',
): number {
  const p = limitar(posicion, 0, 1)
  const crudo = escala === 'lineal' ? minimo + p * (maximo - minimo) : minimo * Math.pow(maximo / minimo, p)
  return ajustarAlPaso(crudo, minimo, maximo, paso)
}
