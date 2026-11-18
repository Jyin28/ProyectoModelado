import { useMemo, type ReactNode } from 'react'
import { ContextoServicios } from '../hooks/useServicios.ts'
import { crearServicioAuth } from '../services/auth.ts'
import { crearServicioCuentas } from '../services/cuentas.ts'
import { crearServicioLampara } from '../services/lampara.ts'
import { crearServicioColchon } from '../services/colchon.ts'
import { crearServicioLecturas } from '../services/lecturas.ts'
import {
  crearServicioHorarios,
  crearServicioLimites,
  crearServicioOrdenes,
  crearServicioVoz,
} from '../services/ordenes.ts'
import { serviciosNoConfigurados } from '../services/noConfigurado.ts'
import { crearServicioTelegram } from '../services/telegram.ts'
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
            cuentas: crearServicioCuentas(supabase),
            lecturas: crearServicioLecturas(supabase),
            lampara: crearServicioLampara(supabase),
            ordenes: crearServicioOrdenes(supabase),
            limites: crearServicioLimites(supabase),
            horarios: crearServicioHorarios(supabase),
            voz: crearServicioVoz(supabase),
            colchon: crearServicioColchon(supabase),
            telegram: crearServicioTelegram(supabase),
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
