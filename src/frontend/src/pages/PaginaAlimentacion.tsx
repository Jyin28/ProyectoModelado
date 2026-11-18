import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import PanelHorarios from '../components/PanelHorarios.tsx'
import PanelLimitesBiberon from '../components/PanelLimitesBiberon.tsx'
import PanelTemperaturaBiberon from '../components/PanelTemperaturaBiberon.tsx'
import PanelToma from '../components/PanelToma.tsx'
import { dispositivoAlimentacionId, ordenesHabilitadas } from '../services/configuracion.ts'
import './paginas.css'

function PaginaAlimentacion() {
  const dispositivoId = dispositivoAlimentacionId()
  return (
    <section className="pagina" aria-labelledby="titulo-alimentacion">
      <h1 id="titulo-alimentacion">Alimentación</h1>
      <PanelToma dispositivoId={dispositivoId} controles={ordenesHabilitadas()} />
      <PanelTemperaturaBiberon dispositivoId={dispositivoId} />
      <PanelLimitesBiberon dispositivoId={dispositivoId} />
      <PanelHorarios
        dispositivoId={dispositivoId}
        tipo="recordatorio_alimentacion"
        soloAviso
        titulo="Recordatorios de alimentación"
        descripcion="A cada hora se envía un aviso por Telegram para recordar la toma."
      />
      <AvisoSinDatos />
      <p>
        El módulo de alimentación es independiente de la cuna: pesa el biberón
        y mide su temperatura. No calienta, no enfría y no da de comer. La web
        conduce la toma y la Pico pesa solo cuando se lo piden; los botones de
        pesaje se muestran solo cuando las órdenes están habilitadas.
      </p>
    </section>
  )
}

export default PaginaAlimentacion
