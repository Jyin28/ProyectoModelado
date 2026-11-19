import { useState } from 'react'
import { Link } from 'react-router'
import InvitacionesPendientes from '../components/InvitacionesPendientes.tsx'
import { useCuentas } from '../hooks/useCuentas.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import './paginas.css'
import './PaginaUsuario.css'

/**
 * Cuenta de la sesión actual: correo, cierre de sesión y acceso a «Bebés y
 * dispositivos». Los dueños y los destinatarios de Telegram se administran por
 * módulo allí, con los permisos que ya aplica el servidor.
 */
function PaginaUsuario() {
  const { backendConfigurado } = useServicios()
  const { estado, cerrarSesion } = useSesion()
  const { cargando, invitaciones, recargar } = useCuentas()
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)

  async function alCerrarSesion() {
    if (cerrando) return
    setCerrando(true)
    setErrorCierre(null)
    const r = await cerrarSesion()
    // Si salió bien, la ruta protegida redirige y este componente se desmonta.
    if (!r.ok) {
      setErrorCierre(r.error)
      setCerrando(false)
    }
  }

  return (
    <section className="pagina" aria-labelledby="titulo-usuario">
      <h1 id="titulo-usuario">Usuario</h1>

      <section aria-labelledby="titulo-usuario-sesion" className="usuario-bloque">
        <h2 id="titulo-usuario-sesion">Sesión actual</h2>
        {estado.tipo === 'autenticado' ? (
          <>
            <p>
              Sesión iniciada como <strong>{estado.sesion.correo}</strong>.
            </p>
            <button
              type="button"
              onClick={alCerrarSesion}
              disabled={cerrando}
              aria-busy={cerrando}
            >
              {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
            {errorCierre && <p role="alert">{errorCierre}</p>}
          </>
        ) : (
          <p role="status">No hay una sesión iniciada.</p>
        )}
      </section>

      <section aria-labelledby="titulo-usuario-cuenta" className="usuario-bloque">
        <h2 id="titulo-usuario-cuenta">Bebés y dispositivos</h2>
        <p>
          Registra bebés, asocia los módulos, administra los dueños de cada
          dispositivo y los destinatarios de Telegram.
        </p>
        <p>
          <Link to="/bebes" className="usuario-enlace">
            Abrir «Bebés y dispositivos»
          </Link>
        </p>
      </section>

      {backendConfigurado && !cargando && invitaciones.length > 0 && (
        <InvitacionesPendientes invitaciones={invitaciones} alAceptar={recargar} />
      )}
    </section>
  )
}

export default PaginaUsuario
