import type { NombreIcono } from '../utils/iconos.ts'

/** Punto sobre una imagen: coordenadas porcentuales desde la esquina superior izquierda. */
export type PuntoEscena = {
  id: string
  etiqueta: string
  icono: NombreIcono
  /** Centro del botón en % del ancho y del alto de la imagen completa. */
  x: number
  y: number
  /**
   * Centro alternativo cuando la escena mide menos de 500 px de ancho: ahí los
   * botones de 44 px de la cuna, el colchón y el sensor se tocarían.
   */
  compacto?: { x: number; y: number }
}

export type ImagenProducto = {
  src: string
  ancho: number
  alto: number
  alt: string
}

/** Escena de inicio de Productos: public/productos/habitacion-interactiva.png (1672 × 941). */
export const IMAGEN_HABITACION: ImagenProducto = {
  src: '/productos/habitacion-interactiva.png',
  ancho: 1672,
  alto: 941,
  alt: 'Habitación de bebé con una cuna de madera, el colchón, luces de estrella, luna y nube, un sensor blanco en la pared y un biberón sobre la cómoda.',
}

export type AccesoProducto = PuntoEscena & {
  /** Ruta que abre el acceso. */
  ruta: string
  descripcion: string
}

/**
 * Los cinco accesos de la escena y de la lista «Productos». Los centros son los
 * definidos en docs/prompts/claude-rediseno-interfaz.md. La cuna se desplaza a
 * lo largo del barrote izquierdo en pantallas estrechas para no tocar al
 * colchón ni al sensor.
 */
export const ACCESOS_PRODUCTOS: AccesoProducto[] = [
  {
    id: 'cuna',
    etiqueta: 'Cuna',
    descripcion: 'Lámpara, parlante y sensor de la cuna',
    icono: 'productos',
    x: 53,
    y: 48,
    compacto: { x: 38, y: 56 },
    ruta: '/cuna',
  },
  {
    id: 'colchon',
    etiqueta: 'Colchón',
    descripcion: 'Pesaje y monitoreo del colchón',
    icono: 'peso',
    x: 52,
    y: 65,
    ruta: '/colchon',
  },
  {
    id: 'figuras',
    etiqueta: 'Figuras LED',
    descripcion: 'Secuencias y tiempos de las luces',
    icono: 'figuras',
    x: 88,
    y: 28,
    ruta: '/figuras',
  },
  {
    id: 'habitacion',
    etiqueta: 'Habitación',
    descripcion: 'Sensor de movimiento del kit',
    icono: 'movimiento',
    x: 36,
    y: 32,
    ruta: '/habitacion',
  },
  {
    id: 'alimentacion',
    etiqueta: 'Alimentación',
    descripcion: 'Tomas y temperatura del biberón',
    icono: 'toma',
    x: 82,
    y: 50,
    ruta: '/alimentacion',
  },
]

/** Vistas especializadas que no tienen un objeto en la escena. */
export const VISTAS_ESPECIALIZADAS = [
  { ruta: '/colchon-pico', etiqueta: 'Colchón (Pico)', descripcion: 'Lecturas de la Pico del colchón' },
  { ruta: '/habitacion/camara', etiqueta: 'Cámara del teléfono', descripcion: 'Usar este teléfono como cámara' },
]
