import { useState, type FormEvent } from 'react'
import { useAhora } from '../hooks/useAhora.ts'
import { useLampara } from '../hooks/useLampara.ts'
import type { EstadoVisibleLampara } from '../models/lampara.ts'
import { estadoVisible, parsearNivel } from '../utils/lampara.ts'
import FechasOrden from './FechasOrden.tsx'
import PerillaIntervalo from './PerillaIntervalo.tsx'
import './PanelLampara.css'

export const MENSAJE_NIVEL_INVALIDO = 'Ingrese un número entero de 0 a 100.'

// El contrato de la lámpara solo tiene nivel (lampara.md): apagada es 0 y encendida es el máximo.
const NIVEL_APAGADA = 0
const NIVEL_ENCENDIDA = 100

const ETIQUETA: Record<EstadoVisibleLampara, string> = {
  pendiente: 'Solicitud registrada',
  enviada: 'Orden enviada',
  confirmado: 'Confirmada por la Pico',
  error: 'Error',
  'sin-respuesta': 'Sin respuesta',
}

const DETALLE: Record<EstadoVisibleLampara, string> = {
  pendiente: 'Esperando que la orden llegue a la Pico.',
  enviada: 'La orden se entregó a la Pico; falta su confirmación.',
  confirmado: 'La Pico informó el nivel que aplicó a su salida.',
  error: 'La Pico informó un error al aplicar la orden.',
  'sin-respuesta': 'La orden venció sin confirmación de la Pico.',
}

interface Props {
  dispositivoId: string
}

/**
 * Control de la lámpara. Solo se monta con VITE_LAMPARA_HABILITADA=true y, sin
 * backend configurado o sin sesión, no muestra nada. Nunca presenta el reporte
 * de la Pico como luz física comprobada.
 */
function PanelLampara({ dispositivoId }: Props) {
  const { activo, cargando, fallo, enviando, falloEnvio, orden, solicitar } =
    useLampara(dispositivoId)
  const ahora = useAhora(1000)
  const [texto, setTexto] = useState('')
  const [invalido, setInvalido] = useState(false)

  if (!activo) return null

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const nivel = parsearNivel(texto)
    setInvalido(nivel === null)
    if (nivel === null) return
    void solicitar(nivel)
  }

  const estado = orden ? estadoVisible(orden, ahora) : null
  const nivelElegido = parsearNivel(texto)

  return (
    <section className="panel-lampara" aria-labelledby="titulo-lampara">
      <h2 id="titulo-lampara">Lámpara</h2>
      <div className="panel-lampara-rejilla">
        <div className="panel-lampara-control">
          <div className="panel-lampara-fila" role="group" aria-label="Encendido">
            <button type="button" disabled={enviando} onClick={() => void solicitar(NIVEL_ENCENDIDA)}>
              Encender
            </button>
            <button type="button" disabled={enviando} onClick={() => void solicitar(NIVEL_APAGADA)}>
              Apagar
            </button>
          </div>
          <form onSubmit={alEnviar} noValidate aria-label="Brillo de la lámpara">
            <PerillaIntervalo
              etiqueta="Brillo"
              valor={nivelElegido}
              minimo={NIVEL_APAGADA}
              maximo={NIVEL_ENCENDIDA}
              paso={1}
              unidad="%"
              escala="lineal"
              alCambiar={(n) => {
                // Girar la perilla solo cambia el borrador local: ninguna orden sale hasta «Aplicar brillo».
                setTexto(String(n))
                setInvalido(false)
              }}
            />
            <p className="panel-lampara-elegido">
              {nivelElegido === null ? 'Valor elegido: sin elegir' : `Valor elegido: ${nivelElegido} %`}
            </p>
            <button type="submit" className="boton-primario" disabled={enviando} aria-busy={enviando}>
              {enviando ? 'Enviando…' : 'Aplicar brillo'}
            </button>
            {invalido && <p role="alert">{MENSAJE_NIVEL_INVALIDO}</p>}
          </form>
        </div>

        <div className="panel-lampara-resumen">
          {falloEnvio && <p role="alert">No se pudo registrar la solicitud de la lámpara.</p>}
          {cargando && <p role="status">Consultando la última orden…</p>}
          {fallo && <p role="alert">No se pudo consultar la última orden de la lámpara.</p>}
          {!cargando && orden === null && <p>No hay órdenes registradas para esta lámpara.</p>}
          {orden && estado && (
            <>
              <dl className="panel-lampara-estado" data-estado={estado}>
                <dt>Estado de la última orden</dt>
                <dd role="status">
                  {ETIQUETA[estado]}. {DETALLE[estado]}
                </dd>
                <dt>Nivel pedido</dt>
                <dd>{orden.nivel} %</dd>
                <dt>Nivel confirmado por la Pico</dt>
                <dd>
                  {orden.nivel_confirmado === null ? 'Sin confirmar' : `${orden.nivel_confirmado} %`}
                </dd>
              </dl>
              <FechasOrden creadoEn={orden.creado_en} venceEn={orden.vence_en} />
            </>
          )}
          <p className="panel-lampara-nota">
            El nivel confirmado es el que la Pico aplicó a su salida; no comprueba
            que la luz esté encendida.
          </p>
        </div>
      </div>
    </section>
  )
}

export default PanelLampara
