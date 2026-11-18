import { useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'

type Props = { alCrear: () => void }

/** Alta de bebé: el nombre es obligatorio y la fecha de nacimiento es opcional. */
function FormularioBebe({ alCrear }: Props) {
  const { servicios } = useServicios()
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    const r = await servicios.cuentas.crearBebe(nombre, fecha || null)
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    setNombre('')
    setFecha('')
    alCrear()
  }

  return (
    <form
      className="formulario-cuentas"
      onSubmit={alEnviar}
      aria-label="Agregar bebé"
    >
      <label>
        Nombre del bebé
        <input
          type="text"
          name="nombre"
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <label>
        Fecha de nacimiento (opcional)
        <input
          type="date"
          name="fecha"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Agregar bebé'}
      </button>
    </form>
  )
}

export default FormularioBebe
