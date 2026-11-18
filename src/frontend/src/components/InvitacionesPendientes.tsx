import { useState } from 'react'
import {
  NOMBRE_TIPO_MODULO,
  type InvitacionDueno,
} from '../models/cuentas.ts'
import { useServicios } from '../hooks/useServicios.ts'

type Props = { invitaciones: InvitacionDueno[]; alAceptar: () => void }

function InvitacionesPendientes({ invitaciones, alAceptar }: Props) {
  const { servicios } = useServicios()
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (invitaciones.length === 0) return null

  async function aceptar(id: string) {
    if (ocupado) return
    setOcupado(true)
    setError(null)
    const r = await servicios.cuentas.aceptarInvitacion(id)
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    alAceptar()
  }

  return (
    <section aria-labelledby="titulo-invitaciones">
      <h2 id="titulo-invitaciones">Invitaciones pendientes</h2>
      <ul>
        {invitaciones.map((i) => (
          <li key={i.id}>
            {NOMBRE_TIPO_MODULO[i.tipo]} <code>{i.dispositivo_id}</code>
            <button
              type="button"
              onClick={() => aceptar(i.id)}
              disabled={ocupado}
            >
              Aceptar invitación a {i.dispositivo_id}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

export default InvitacionesPendientes
