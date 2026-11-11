import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import './paginas.css'

function PaginaCuna() {
  return (
    <section className="pagina" aria-labelledby="titulo-cuna">
      <h1 id="titulo-cuna">Cuna</h1>
      <AvisoSinDatos />
      <p>
        Sección reservada para la información de la cuna. La conexión con el
        dispositivo y el backend está pendiente de implementación.
      </p>
    </section>
  )
}

export default PaginaCuna
