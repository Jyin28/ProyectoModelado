import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import PanelColchon from '../components/PanelColchon.tsx'
import { dispositivoColchonId, ordenesHabilitadas } from '../services/configuracion.ts'
import './paginas.css'

function PaginaColchon() {
  return (
    <section className="pagina" aria-labelledby="titulo-colchon">
      <h1 id="titulo-colchon">Colchón</h1>
      <PanelColchon dispositivoId={dispositivoColchonId()} controles={ordenesHabilitadas()} />
      <AvisoSinDatos />
      <p>
        El colchón es un módulo separado de la cuna. La web no muestra el peso:
        solo la configuración, el estado que informa la Pico y sus eventos. Los
        controles para activar, detener y rearmar se muestran solo cuando están
        habilitados.
      </p>
    </section>
  )
}

export default PaginaColchon
