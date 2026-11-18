// Bebés, módulos asociados, dueños e invitaciones (HU-02 a HU-05).
// Las formas coinciden con lo que devuelven las RPC de
// supabase/migrations/20261118000100_cuentas_propiedad.sql.

export type TipoModulo =
  | 'cuna'
  | 'figuras'
  | 'colchon'
  | 'habitacion'
  | 'juego'
  | 'alimentacion'

export const TIPOS_MODULO: readonly TipoModulo[] = [
  'cuna',
  'figuras',
  'colchon',
  'habitacion',
  'juego',
  'alimentacion',
]

export const NOMBRE_TIPO_MODULO: Record<TipoModulo, string> = {
  cuna: 'Cuna',
  figuras: 'Figuras LED',
  colchon: 'Colchón',
  habitacion: 'Habitación',
  juego: 'Juego',
  alimentacion: 'Alimentación',
}

export type Bebe = {
  id: string
  nombre: string
  /** Fecha civil AAAA-MM-DD; puede faltar (CA-02.3). */
  fecha_nacimiento: string | null
}

export type ModuloAsociado = {
  id: string
  tipo: TipoModulo
  producto_id: string
  activo: boolean
  bebe_id: string | null
  bebe_nombre: string | null
}

export type Dueno = {
  usuario_id: string
  correo: string
}

export type InvitacionDueno = {
  id: string
  dispositivo_id: string
  tipo: TipoModulo
  creada_en: string
}
