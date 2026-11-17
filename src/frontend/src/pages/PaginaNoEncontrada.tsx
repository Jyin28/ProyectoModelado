import { Link } from 'react-router'
import './paginas.css'

function PaginaNoEncontrada() {
  return (
    <section className="pagina" aria-labelledby="titulo-no-encontrada">
      <h1 id="titulo-no-encontrada">No encontrada</h1>
      <p>La página que buscas no existe.</p>
      <p>
        <Link to="/cuna">Volver a Cuna</Link>
      </p>
    </section>
  )
}

export default PaginaNoEncontrada
