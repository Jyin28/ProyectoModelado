import { Link } from 'react-router'
import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import PanelEventosHabitacion from '../components/PanelEventosHabitacion.tsx'
import PanelMonitoreoHabitacion from '../components/PanelMonitoreoHabitacion.tsx'
import {
  camaraHabilitada,
  dispositivoHabitacionId,
  ordenesHabilitadas,
} from '../services/configuracion.ts'
import './paginas.css'

function PaginaHabitacion() {
  const dispositivoId = dispositivoHabitacionId()
  return (
    <section className="pagina" aria-labelledby="titulo-habitacion">
      <h1 id="titulo-habitacion">Habitación</h1>
      {ordenesHabilitadas() && <PanelMonitoreoHabitacion dispositivoId={dispositivoId} />}
      <PanelEventosHabitacion dispositivoId={dispositivoId} />
      <AvisoSinDatos />
      <p>
        El kit de habitación es un módulo separado de la cuna. Los controles para
        activar y desactivar los sensores se muestran solo cuando están
        habilitados. El aviso de Telegram dice que se tomó una foto, pero nunca
        lleva la imagen.
      </p>
      {camaraHabilitada() && (
        <p>
          <Link to="/habitacion/camara">Usar este teléfono como cámara</Link>
        </p>
      )}
    </section>
  )
}

export default PaginaHabitacion
