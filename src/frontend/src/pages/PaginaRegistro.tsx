import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useServicios } from '../hooks/useServicios.ts'
import { useSesion } from '../hooks/useSesion.ts'
import './paginas.css'
import './PaginaLogin.css'

function PaginaRegistro() {
  const { estado } = useSesion()
  const { servicios } = useServicios()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  if (estado.tipo === 'autenticado') return <Navigate to="/productos" replace />

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await servicios.auth.registrarse(correo, contrasena)
    setContrasena('')
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    // Sin confirmación pendiente, la sesión llega por el cambio de estado.
    if (r.datos.requiereConfirmacion) setConfirmar(true)
  }

  return (
    <div className="login">
      <p className="login-marca">Cuna Inteligente IoT</p>
      <section className="pagina" aria-labelledby="titulo-registro">
        <h1 id="titulo-registro">Crear cuenta</h1>
        {estado.tipo === 'sin-configurar' ? (
          <p role="status">
            Registro no disponible: el backend no está configurado.
          </p>
        ) : confirmar ? (
          <p role="status">
            Cuenta creada. Revisa tu correo para confirmarla y luego{' '}
            <Link to="/login">inicia sesión</Link>.
          </p>
        ) : (
          <form className="login-formulario" onSubmit={alEnviar}>
            <label>
              Correo
              <input
                type="email"
                name="correo"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                name="contrasena"
                autoComplete="new-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={enviando}>
              {enviando ? 'Creando…' : 'Crear cuenta'}
            </button>
            <p>
              ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
            </p>
          </form>
        )}
      </section>
    </div>
  )
}

export default PaginaRegistro
