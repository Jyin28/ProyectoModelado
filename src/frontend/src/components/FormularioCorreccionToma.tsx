import { useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import {
  MOTIVO_CORRECCION_MAX,
  NOMBRE_CAMPO,
  type CampoCorreccion,
  type Toma,
} from '../models/alimentacion.ts'
import { camposCorregibles, formatearGramos, pesoDeCampo, validarCorreccion } from '../utils/alimentacion.ts'

type Props = {
  toma: Toma
  /** Se llama tras una corrección guardada, para volver a consultar. */
  alCorregir: () => void
}

/**
 * Corrección de un peso con motivo obligatorio. La corrección queda auditada
 * en el servidor: valor anterior, valor nuevo, autor, fecha y motivo.
 */
function FormularioCorreccionToma({ toma, alCorregir }: Props) {
  const { servicios } = useServicios()
  const campos = camposCorregibles(toma)
  const [campo, setCampo] = useState<CampoCorreccion>(campos[0] ?? 'peso_inicial_g')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (campos.length === 0) return null
  const campoActivo = campos.includes(campo) ? campo : campos[0]
  const actual = pesoDeCampo(toma, campoActivo)

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    setAviso(null)
    const v = validarCorreccion(valor, motivo)
    if (!v.ok) return setError(v.error)
    setError(null)
    setEnviando(true)
    let r
    try {
      r = await servicios.alimentacion.corregir(toma.id, campoActivo, v.valor, v.motivo)
    } catch {
      r = { ok: false as const, error: 'No se pudo guardar la corrección.' }
    }
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    setValor('')
    setMotivo('')
    setAviso('Corrección guardada.')
    alCorregir()
  }

  return (
    <form onSubmit={alEnviar} noValidate aria-label="Corregir peso de la toma">
      <label>
        Peso a corregir
        <select value={campoActivo} onChange={(e) => setCampo(e.target.value as CampoCorreccion)}>
          {campos.map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CAMPO[c]}
            </option>
          ))}
        </select>
      </label>
      <p>Valor actual: {actual === null ? 'sin valor' : formatearGramos(actual)}.</p>
      <label>
        Peso corregido (g)
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </label>
      <label>
        Motivo de la corrección
        <input
          type="text"
          maxLength={MOTIVO_CORRECCION_MAX}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      <button type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar corrección'}
      </button>
      {error && <p role="alert">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}
    </form>
  )
}

export default FormularioCorreccionToma
