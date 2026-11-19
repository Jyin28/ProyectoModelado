const limitar = (n: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, n))

/** Entero más cercano al valor que cae en la rejilla de `paso`, dentro de [minimo, maximo]. */
export function ajustarAlPaso(valor: number, minimo: number, maximo: number, paso: number): number {
  return limitar(Math.round(valor / paso) * paso, minimo, maximo)
}

/** Posición 0..1 de un valor. Escala logarítmica: los segundos cortos tienen más recorrido. */
export function posicionDeValor(valor: number, minimo: number, maximo: number): number {
  return Math.log(limitar(valor, minimo, maximo) / minimo) / Math.log(maximo / minimo)
}

export function valorDePosicion(posicion: number, minimo: number, maximo: number, paso: number): number {
  const crudo = minimo * Math.pow(maximo / minimo, limitar(posicion, 0, 1))
  return ajustarAlPaso(crudo, minimo, maximo, paso)
}
