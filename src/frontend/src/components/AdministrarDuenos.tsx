import { useEffect, useState, type FormEvent } from 'react'
import type { Dueno } from '../models/cuentas.ts'
import { useServicios } from '../hooks/useServicios.ts'

type Props = { dispositivoId: string }

/**
 * Dueños de un módulo: ver, invitar por correo y retirar. Una invitación solo
 * da acceso cuando la persona la acepta. Retirar un dueño conserva el historial.
 */
function AdministrarDuenos({ dispositivoId }: Props) {
  const { servicios } = useServicios()
  const [duenos, setDuenos] = useState<Dueno[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let activo = true
    servicios.cuentas.listarDuenos(dispositivoId).then((r) => {
      if (!activo) return
      if (r.ok) setDuenos(r.datos)
      else setError(r.error)
    })
    return () => {
      activo = false
    }
  }, [servicios, dispositivoId, version])

  async function invitar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setError(null)
    setAviso(null)
    const r = await servicios.cuentas.invitarDueno(dispositivoId, correo)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    setAviso(
      'Invitación registrada. La persona tendrá acceso cuando la acepte al iniciar sesión.',
    )
    setCorreo('')
  }

  async function retirar(usuarioId: string) {
    if (ocupado) return
    setOcupado(true)
    setError(null)
    setAviso(null)
    const r = await servicios.cuentas.retirarDueno(dispositivoId, usuarioId)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    setAviso('Acceso retirado. Los registros anteriores se conservan.')
    setVersion((v) => v + 1)
  }

  return (
    <div
      className="administrar-duenos"
      role="group"
      aria-label={`Dueños de ${dispositivoId}`}
    >
      <h4>Dueños</h4>
      {duenos === null && !error && <p role="status">Cargando dueños…</p>}
      {duenos && (
        <ul>
          {duenos.map((d) => (
            <li key={d.usuario_id}>
              <span>{d.correo || d.usuario_id}</span>
              <button
                type="button"
                onClick={() => retirar(d.usuario_id)}
                disabled={ocupado}
              >
                Retirar a {d.correo || 'dueño'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={invitar} aria-label="Invitar dueño">
        <label>
          Correo de la persona invitada
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <button type="submit" disabled={ocupado}>
          Invitar
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </div>
  )
}

export default AdministrarDuenos
