import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ContextoSesion,
  type EstadoSesion,
  type ValorSesion,
} from '../hooks/useSesion.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { MENSAJE_SESION } from '../services/auth.ts'

const SIN_CONFIGURAR: EstadoSesion = { tipo: 'sin-configurar' }

function ProveedorSesion({ children }: { children: ReactNode }) {
  const { servicios, backendConfigurado } = useServicios()
  const auth = servicios.auth
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'verificando' })

  useEffect(() => {
    if (!backendConfigurado) return
    let activo = true
    // Si Auth ya avisó un cambio, es más reciente que la consulta inicial.
    let hayCambio = false

    // Callback síncrono: solo guarda el estado.
    const cancelar = auth.suscribirCambiosSesion((sesion) => {
      if (!activo) return
      hayCambio = true
      setEstado(
        sesion ? { tipo: 'autenticado', sesion } : { tipo: 'anonimo' },
      )
    })

    const alFallar = () => {
      if (!activo || hayCambio) return
      setEstado({ tipo: 'anonimo', error: MENSAJE_SESION })
    }
    auth
      .obtenerSesion()
      .then((r) => {
        if (!activo || hayCambio) return
        if (!r.ok) return alFallar()
        setEstado(
          r.datos
            ? { tipo: 'autenticado', sesion: r.datos }
            : { tipo: 'anonimo' },
        )
      })
      .catch(alFallar)

    return () => {
      activo = false
      cancelar()
    }
  }, [auth, backendConfigurado])

  const iniciarSesion = useCallback<ValorSesion['iniciarSesion']>(
    async (correo, contrasena) => {
      const r = await auth.iniciarSesion(correo, contrasena)
      if (r.ok) setEstado({ tipo: 'autenticado', sesion: r.datos })
      return r
    },
    [auth],
  )

  const cerrarSesion = useCallback<ValorSesion['cerrarSesion']>(async () => {
    const r = await auth.cerrarSesion()
    if (r.ok) setEstado({ tipo: 'anonimo' })
    return r
  }, [auth])

  const valor = useMemo<ValorSesion>(
    () => ({
      estado: backendConfigurado ? estado : SIN_CONFIGURAR,
      iniciarSesion,
      cerrarSesion,
    }),
    [backendConfigurado, estado, iniciarSesion, cerrarSesion],
  )

  return (
    <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
  )
}

export default ProveedorSesion
