import { createContext, useContext } from 'react'
import { serviciosNoConfigurados } from '../services/noConfigurado.ts'
import type { Servicios } from '../services/tipos.ts'

export type ValorServicios = {
  servicios: Servicios
  backendConfigurado: boolean
}

// Valor por defecto seguro: sin proveedor, el backend cuenta como no configurado.
export const ContextoServicios = createContext<ValorServicios>({
  servicios: serviciosNoConfigurados,
  backendConfigurado: false,
})

export function useServicios(): ValorServicios {
  return useContext(ContextoServicios)
}
