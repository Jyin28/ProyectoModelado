import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import './paginas.css'

function PaginaHistorial() {
  return (
    <section className="pagina" aria-labelledby="titulo-historial">
      <h1 id="titulo-historial">Historial</h1>
      <AvisoSinDatos />
      <p>
        Aquí se mostrará el historial de lecturas y eventos cuando existan
        datos reales del dispositivo. La consulta al backend está pendiente
        de implementación.
      </p>
    </section>
  )
}

export default PaginaHistorial
