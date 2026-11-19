import { Link } from 'react-router'
import EscenaInteractiva from '../components/EscenaInteractiva.tsx'
import Icono from '../components/Icono.tsx'
import {
  ACCESOS_PRODUCTOS,
  IMAGEN_HABITACION,
  VISTAS_ESPECIALIZADAS,
} from '../models/productos.ts'
import { camaraHabilitada } from '../services/configuracion.ts'
import './paginas.css'
import './PaginaProductos.css'

/**
 * Pantalla de inicio: la habitación completa, con un botón sobre cada objeto.
 * Tocar un objeto solo navega; los ajustes se consultan en la vista de cada
 * producto antes de enviar cualquier orden.
 */
function PaginaProductos() {
  const vistas = VISTAS_ESPECIALIZADAS.filter(
    (v) => v.ruta !== '/habitacion/camara' || camaraHabilitada(),
  )
  return (
    <section className="pagina pagina-productos" aria-labelledby="titulo-productos">
      <h1 id="titulo-productos">Productos</h1>
      <p>Toca un objeto de la habitación para abrir su producto.</p>
      <EscenaInteractiva
        imagen={IMAGEN_HABITACION}
        puntos={ACCESOS_PRODUCTOS.map((a) => ({ ...a }))}
      />
      <nav aria-label="Accesos a los productos" className="productos-lista">
        <h2>Todos los productos</h2>
        <ul>
          {ACCESOS_PRODUCTOS.map((a) => (
            <li key={a.id}>
              <Link to={a.ruta}>
                <Icono nombre={a.icono} />
                <span className="productos-lista-texto">
                  <strong>{a.etiqueta}</strong>
                  <span>{a.descripcion}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {vistas.length > 0 && (
          <>
            <h2>Vistas especializadas</h2>
            <ul>
              {vistas.map((v) => (
                <li key={v.ruta}>
                  <Link to={v.ruta}>
                    <span className="productos-lista-texto">
                      <strong>{v.etiqueta}</strong>
                      <span>{v.descripcion}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </section>
  )
}

export default PaginaProductos
