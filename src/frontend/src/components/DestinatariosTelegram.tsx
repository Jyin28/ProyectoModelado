import { useEffect, useState, type FormEvent } from 'react'
import { useServicios } from '../hooks/useServicios.ts'
import type {
  CodigoVinculacion,
  DestinatarioTelegram,
} from '../models/telegram.ts'
import { botTelegram } from '../services/configuracion.ts'
import { formatearHoraCR } from '../utils/tiempo.ts'

type Props = { dispositivoId: string }

/**
 * Destinatarios de Telegram de un módulo. La lista es del módulo y la
 * comparten sus dueños. Un destinatario solo recibe avisos: no controla nada.
 */
function DestinatariosTelegram({ dispositivoId }: Props) {
  const { servicios } = useServicios()
  const [lista, setLista] = useState<DestinatarioTelegram[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(0)
  const [codigos, setCodigos] = useState<Record<string, CodigoVinculacion>>({})

  useEffect(() => {
    let activo = true
    servicios.telegram.listarDestinatarios(dispositivoId).then((r) => {
      if (!activo) return
      if (r.ok) setLista(r.datos)
      else setError(r.error)
    })
    return () => {
      activo = false
    }
  }, [servicios, dispositivoId, version])

  async function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    if (ocupado) return false
    setOcupado(true)
    setError(null)
    const r = await accion()
    setOcupado(false)
    if (!r.ok) {
      setError(r.error ?? 'No se pudo completar la operación.')
      return false
    }
    return true
  }

  async function agregar(evento: FormEvent) {
    evento.preventDefault()
    const bien = await ejecutar(() => servicios.telegram.crearDestinatario(dispositivoId, nombre))
    if (!bien) return
    setNombre('')
    setVersion((v) => v + 1)
  }

  async function generar(id: string) {
    await ejecutar(async () => {
      const r = await servicios.telegram.generarCodigo(id)
      if (r.ok) setCodigos((c) => ({ ...c, [id]: r.datos }))
      return r
    })
  }

  async function retirar(id: string) {
    const bien = await ejecutar(() => servicios.telegram.retirarDestinatario(id))
    if (!bien) return
    setCodigos((c) => {
      const { [id]: _quitado, ...resto } = c
      return resto
    })
    setVersion((v) => v + 1)
  }

  const bot = botTelegram()

  return (
    <div
      className="administrar-duenos"
      role="group"
      aria-label={`Destinatarios de Telegram de ${dispositivoId}`}
    >
      <h4>Destinatarios de Telegram</h4>
      <p>
        Reciben los avisos de este módulo, aunque la web esté cerrada. No tienen
        control sobre el módulo. Las fotografías nunca se envían por Telegram.
      </p>
      {lista === null && !error && <p role="status">Cargando destinatarios…</p>}
      {lista && lista.length === 0 && (
        <p role="status">Este módulo todavía no tiene destinatarios.</p>
      )}
      {lista && lista.length > 0 && (
        <ul>
          {lista.map((d) => {
            const codigo = codigos[d.id]
            return (
              <li key={d.id}>
                <span>
                  {d.nombre} · {d.vinculado ? 'vinculado' : 'sin vincular'}
                </span>
                <button type="button" onClick={() => generar(d.id)} disabled={ocupado}>
                  Generar código para {d.nombre}
                </button>
                <button type="button" onClick={() => retirar(d.id)} disabled={ocupado}>
                  Retirar a {d.nombre}
                </button>
                {codigo && (
                  <p role="status">
                    Código de un solo uso: <code>{codigo.codigo}</code>. Vence el{' '}
                    {formatearHoraCR(codigo.vence_en)}. Envía{' '}
                    <code>/start {codigo.codigo}</code> al bot de Telegram
                    {bot ? (
                      <>
                        {' '}o abre{' '}
                        <a
                          href={`https://t.me/${bot}?start=${codigo.codigo}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          el enlace de vinculación
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={agregar} aria-label="Agregar destinatario">
        <label>
          Nombre del destinatario
          <input
            type="text"
            maxLength={60}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <button type="submit" disabled={ocupado}>
          Agregar destinatario
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default DestinatariosTelegram
