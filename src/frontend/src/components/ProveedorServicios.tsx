import { useMemo, type ReactNode } from 'react'
import { ContextoServicios } from '../hooks/useServicios.ts'
import { crearServicioAuth } from '../services/auth.ts'
import { crearServicioLecturas } from '../services/lecturas.ts'
import { serviciosNoConfigurados } from '../services/noConfigurado.ts'
import { backendConfigurado, supabase } from '../services/supabase.ts'
import type { Servicios } from '../services/tipos.ts'

interface Props {
  children: ReactNode
  /** Solo para pruebas; por defecto se usa `backendConfigurado`. */
  configurado?: boolean
  /** Solo para pruebas: reemplaza los servicios. */
  servicios?: Servicios
}

function ProveedorServicios({
  children,
  configurado = backendConfigurado,
  servicios,
}: Props) {
  const valor = useMemo(() => {
    // TODO: comandos con Supabase cuando existan las tablas.
    const efectivos: Servicios =
      servicios ??
      (configurado && supabase
        ? {
            ...serviciosNoConfigurados,
            auth: crearServicioAuth(supabase),
            lecturas: crearServicioLecturas(supabase),
          }
        : serviciosNoConfigurados)
    return { servicios: efectivos, backendConfigurado: configurado }
  }, [servicios, configurado])
  return (
    <ContextoServicios.Provider value={valor}>
      {children}
    </ContextoServicios.Provider>
  )
}

export default ProveedorServicios
