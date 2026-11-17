import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import './paginas.css'

function PaginaColchon() {
  return (
    <section className="pagina" aria-labelledby="titulo-colchon">
      <h1 id="titulo-colchon">Colchón</h1>
      <AvisoSinDatos />
      <p>
        Sección reservada para la información del colchón (presencia y peso).
        La lectura real del sensor está pendiente de implementación.
      </p>
    </section>
  )
}

export default PaginaColchon
