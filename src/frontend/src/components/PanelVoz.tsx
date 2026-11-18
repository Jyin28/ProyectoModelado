import { useVoz } from '../hooks/useVoz.ts'
import type { Capturador } from '../utils/voz.ts'

type Props = {
  /** Módulo cuna-audio-NN donde se registra la actividad. */
  dispositivoId: string
  /** Producto de la cuna: define el canal privado de voz. */
  productoId: string
  /** Solo para pruebas: reemplaza el micrófono real. */
  capturador?: Capturador
}

const TEXTO: Record<string, string> = {
  inactiva: 'La voz está apagada.',
  conectando: 'Conectando con la cuna…',
  hablando:
    'Enviando tu voz en vivo. Esto no comprueba que la cuna la esté reproduciendo.',
  error: 'No se pudo iniciar la voz.',
}

/**
 * Voz del cuidador en vivo. Solo se monta con VITE_VOZ_HABILITADA=true. La
 * voz no se graba ni se guarda: solo queda registro de que hubo una sesión.
 */
function PanelVoz({ dispositivoId, productoId, capturador }: Props) {
  const { estado, error, iniciar, detener } = useVoz(dispositivoId, productoId, capturador)
  const ocupado = estado === 'conectando'

  return (
    <section className="panel-modulo" aria-labelledby="titulo-panel-voz">
      <h2 id="titulo-panel-voz">Hablar a la cuna</h2>
      <p>
        Usa el micrófono de este dispositivo y envía tu voz en vivo a la cuna.
        La voz no se graba ni se guarda; solo queda registrado que hubo una
        sesión. Todavía no se probó con el micrófono, la red y el parlante
        reales.
      </p>
      <p role="status">{TEXTO[estado]}</p>
      {estado === 'hablando' ? (
        <button type="button" onClick={() => void detener()}>
          Dejar de hablar
        </button>
      ) : (
        <button type="button" disabled={ocupado} onClick={() => void iniciar()}>
          Hablar
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

export default PanelVoz
