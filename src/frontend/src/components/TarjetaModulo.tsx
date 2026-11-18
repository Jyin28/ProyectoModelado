import { useState } from 'react'
import {
  NOMBRE_TIPO_MODULO,
  type Bebe,
  type ModuloAsociado,
} from '../models/cuentas.ts'
import { useServicios } from '../hooks/useServicios.ts'
import AdministrarDuenos from './AdministrarDuenos.tsx'

type Props = {
  modulo: ModuloAsociado
  bebes: Bebe[]
  alCambiar: () => void
}

function TarjetaModulo({ modulo, bebes, alCambiar }: Props) {
  const { servicios } = useServicios()
  const [seleccion, setSeleccion] = useState(modulo.bebe_id ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verDuenos, setVerDuenos] = useState(false)
  const idSelect = `bebe-${modulo.id}`
  const nombre = NOMBRE_TIPO_MODULO[modulo.tipo]

  async function guardar() {
    if (guardando) return
    setGuardando(true)
    setError(null)
    const r = await servicios.cuentas.asignarDispositivo(
      modulo.id,
      seleccion || null,
    )
    setGuardando(false)
    if (!r.ok) return setError(r.error)
    alCambiar()
  }

  return (
    <article className="tarjeta-modulo" aria-label={`${nombre} ${modulo.id}`}>
      <h3>{nombre}</h3>
      <p>
        Módulo <code>{modulo.id}</code>
      </p>
      <p>Bebé asociado: {modulo.bebe_nombre ?? 'Sin bebé asociado'}</p>
      <label htmlFor={idSelect}>Asociar a</label>
      <select
        id={idSelect}
        value={seleccion}
        onChange={(e) => setSeleccion(e.target.value)}
      >
        <option value="">Sin bebé</option>
        {bebes.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nombre}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={guardar}
        disabled={guardando || seleccion === (modulo.bebe_id ?? '')}
      >
        {guardando ? 'Guardando…' : 'Guardar asociación'}
      </button>
      <p>
        Los registros anteriores conservan su bebé original; solo cambian los
        nuevos.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        onClick={() => setVerDuenos((v) => !v)}
        aria-expanded={verDuenos}
      >
        Administrar dueños
      </button>
      {verDuenos && <AdministrarDuenos dispositivoId={modulo.id} />}
    </article>
  )
}

export default TarjetaModulo
