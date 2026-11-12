import { Navigate, Outlet, useLocation } from 'react-router'
import { useSesion } from '../hooks/useSesion.ts'

// Sin backend configurado no hay sesión: se conserva la navegación de maqueta.
function RutaProtegida() {
  const { estado } = useSesion()
  const ubicacion = useLocation()

  switch (estado.tipo) {
    case 'sin-configurar':
      return <Outlet />
    case 'verificando':
      return <p role="status">Verificando sesión…</p>
    case 'anonimo':
      return (
        <Navigate
          to="/login"
          replace
          state={{
            desde: ubicacion.pathname + ubicacion.search + ubicacion.hash,
          }}
        />
      )
    case 'autenticado':
      // La clave remonta las pantallas si cambia el usuario: no se arrastra
      // contenido de otra cuenta.
      return <Outlet key={estado.sesion.usuario_id} />
  }
}

export default RutaProtegida
