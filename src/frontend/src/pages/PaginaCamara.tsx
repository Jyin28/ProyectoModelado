import { Link } from 'react-router'
import PanelCamara from '../components/PanelCamara.tsx'
import { camaraHabilitada, dispositivoHabitacionId } from '../services/configuracion.ts'
import './paginas.css'

function PaginaCamara() {
  return (
    <section className="pagina" aria-labelledby="titulo-pagina-camara">
      <h1 id="titulo-pagina-camara">Cámara del teléfono</h1>
      {camaraHabilitada() ? (
        <PanelCamara dispositivoId={dispositivoHabitacionId()} />
      ) : (
        <p>La cámara del teléfono no está habilitada en esta instalación.</p>
      )}
      <p>
        <Link to="/habitacion">Volver a la habitación</Link>
      </p>
    </section>
  )
}

export default PaginaCamara
