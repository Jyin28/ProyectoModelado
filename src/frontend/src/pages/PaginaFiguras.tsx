import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import './paginas.css'
import './PaginaFiguras.css'

const FIGURAS_LED = [1, 2, 3, 4, 5, 6]

function PaginaFiguras() {
  return (
    <section className="pagina" aria-labelledby="titulo-figuras">
      <h1 id="titulo-figuras">Figuras LED</h1>
      <AvisoSinDatos />
      <p>
        Seis indicadores visuales, uno por figura. No representan un estado
        físico confirmado: el control real del hardware aún no está
        implementado.
      </p>
      <ul className="figuras" aria-label="Indicadores de figuras LED">
        {FIGURAS_LED.map((numero) => (
          <li key={numero} className="figura">
            <span className="figura-punto" aria-hidden="true" />
            <span className="figura-etiqueta">Figura {numero}</span>
            <span className="figura-estado">Sin datos</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default PaginaFiguras
