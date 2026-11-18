import { useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'

type Props = { alReclamar: () => void }

/** Asocia un módulo a la cuenta con el código de reclamo que viene con el producto. */
function ReclamarModulo({ alReclamar }: Props) {
  const { servicios } = useServicios()
  const [dispositivo, setDispositivo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await servicios.cuentas.reclamarDispositivo(dispositivo, codigo)
    setEnviando(false)
    setCodigo('')
    if (!r.ok) return setError(r.error)
    setDispositivo('')
    alReclamar()
  }

  return (
    <form
      className="formulario-cuentas"
      onSubmit={alEnviar}
      aria-label="Asociar módulo"
    >
      <label>
        Identificador del módulo
        <input
          type="text"
          name="dispositivo"
          required
          autoComplete="off"
          value={dispositivo}
          onChange={(e) => setDispositivo(e.target.value)}
        />
      </label>
      <label>
        Código de reclamo
        <input
          type="password"
          name="codigo"
          required
          autoComplete="off"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? 'Asociando…' : 'Asociar módulo'}
      </button>
    </form>
  )
}

export default ReclamarModulo
