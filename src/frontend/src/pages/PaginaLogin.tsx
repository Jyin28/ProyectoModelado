import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSesion } from '../hooks/useSesion.ts'
import './paginas.css'
import './PaginaLogin.css'

const DESTINO_POR_DEFECTO = '/cuna'

// Solo se acepta una ruta interna; cualquier otra cosa lleva a Cuna.
function destinoSeguro(estado: unknown): string {
  const desde = (estado as { desde?: unknown } | null)?.desde
  if (
    typeof desde !== 'string' ||
    !desde.startsWith('/') ||
    desde.startsWith('//') ||
    desde.startsWith('/\\') ||
    /^\/login([/?#]|$)/.test(desde)
  ) {
    return DESTINO_POR_DEFECTO
  }
  return desde
}

function PaginaLogin() {
  const { estado, iniciarSesion } = useSesion()
  const ubicacion = useLocation()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (estado.tipo === 'autenticado') {
    return <Navigate to={destinoSeguro(ubicacion.state)} replace />
  }

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await iniciarSesion(correo.trim(), contrasena)
    if (r.ok) return // la redirección ocurre al pasar a "autenticado"
    setContrasena('')
    setError(r.error)
    setEnviando(false)
  }

  const errorMostrado = error ?? (estado.tipo === 'anonimo' ? estado.error : null)

  return (
    <div className="login">
      <p className="login-marca">Cuna Inteligente IoT</p>
      <section className="pagina" aria-labelledby="titulo-login">
        <h1 id="titulo-login">Inicio de sesión</h1>
        {estado.tipo === 'sin-configurar' ? (
          <p role="status">
            Inicio de sesión no disponible: el backend no está configurado.
          </p>
        ) : estado.tipo === 'verificando' ? (
          <p role="status">Verificando sesión…</p>
        ) : (
          <form className="login-formulario" onSubmit={alEnviar}>
            <label>
              Correo
              <input
                type="email"
                name="correo"
                autoComplete="username"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                name="contrasena"
                autoComplete="current-password"
                required
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </label>
            {errorMostrado && <p role="alert">{errorMostrado}</p>}
            <button type="submit" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

export default PaginaLogin
