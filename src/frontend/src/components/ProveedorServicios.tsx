import type { ReactNode } from 'react'
import { ContextoServicios } from '../hooks/useServicios.ts'
import { serviciosNoConfigurados } from '../services/noConfigurado.ts'
import { backendConfigurado } from '../services/supabase.ts'

interface Props {
  children: ReactNode
  /** Solo para pruebas; por defecto se usa `backendConfigurado`. */
  configurado?: boolean
}

function ProveedorServicios({
  children,
  configurado = backendConfigurado,
}: Props) {
  // TODO: cuando existan las tablas, entregar aquí la implementación con
  // Supabase (basada en `supabase` de services/supabase.ts) si `configurado`.
  // Mientras tanto siempre se usa la implementación sin datos.
  const valor = { servicios: serviciosNoConfigurados, backendConfigurado: configurado }
  return (
    <ContextoServicios.Provider value={valor}>
      {children}
    </ContextoServicios.Provider>
  )
}

export default ProveedorServicios
