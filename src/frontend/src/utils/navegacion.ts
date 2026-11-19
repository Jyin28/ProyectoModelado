export type DestinoId = 'productos' | 'historial' | 'usuario'

/** Sección resaltada: todo módulo cuelga de Productos; Bebés y dispositivos, de Usuario. */
export function destinoDeRuta(ruta: string): DestinoId {
  if (ruta === '/historial' || ruta.startsWith('/historial/')) return 'historial'
  if (ruta === '/usuario' || ruta.startsWith('/usuario/') || ruta === '/bebes') return 'usuario'
  return 'productos'
}
