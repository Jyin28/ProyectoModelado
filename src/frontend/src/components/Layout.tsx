import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useServicios } from '../hooks/useServicios.ts'
import BannerConexion from './BannerConexion.tsx'
import Icono from './Icono.tsx'
import type { NombreIcono } from '../utils/iconos.ts'
import { destinoDeRuta, type DestinoId } from '../utils/navegacion.ts'
import './Layout.css'

type Destino = { id: DestinoId; ruta: string; texto: string; icono: NombreIcono }

const DESTINOS: Destino[] = [
  { id: 'productos', ruta: '/productos', texto: 'Productos', icono: 'productos' },
  { id: 'historial', ruta: '/historial', texto: 'Historial', icono: 'historial' },
  { id: 'usuario', ruta: '/usuario', texto: 'Usuario', icono: 'usuario' },
]

const RAICES = ['/productos', '/historial', '/usuario']

/** Pantalla a la que lleva «Atrás» cuando no hay historial previo en esta pestaña. */
function rutaPadre(ruta: string): string {
  if (ruta === '/habitacion/camara') return '/habitacion'
  if (ruta === '/bebes') return '/usuario'
  return '/productos'
}

/**
 * Estructura de la app: panel lateral izquierdo con los destinos generales y,
 * a la derecha, la pantalla actual. La página no se desplaza: cada pantalla
 * ocupa el alto disponible y solo se desplaza por dentro si no le cabe.
 */
function Layout() {
  const { backendConfigurado } = useServicios()
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const activo = destinoDeRuta(ubicacion.pathname)
  const esRaiz = RAICES.includes(ubicacion.pathname)

  function atras() {
    // «default» marca la primera entrada de esta pestaña: no hay a dónde volver con el historial.
    if (ubicacion.key !== 'default') navegar(-1)
    else navegar(rutaPadre(ubicacion.pathname), { replace: true })
  }

  return (
    <div className="layout">
      <aside className="layout-lateral">
        <Link to="/productos" className="layout-marca">
          <span className="layout-marca-logo" aria-hidden="true">
            ☾
          </span>
          <span className="layout-marca-texto">Cuna Inteligente IoT</span>
        </Link>

        <nav className="layout-nav" aria-label="Principal">
          <ul>
            {DESTINOS.map((d) => (
              <li key={d.id}>
                <Link
                  to={d.ruta}
                  className={d.id === activo ? 'nav-enlace nav-enlace-activo' : 'nav-enlace'}
                  aria-current={d.id === activo ? 'page' : undefined}
                >
                  <Icono nombre={d.icono} tamano={24} />
                  <span>{d.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {!esRaiz && (
          <button type="button" className="layout-atras" onClick={atras}>
            <span aria-hidden="true">←</span> <span>Atrás</span>
          </button>
        )}

        <footer className="layout-pie">
          <p>
            Aplicación base del Sprint 3. La integración con Supabase y el
            firmware de la Raspberry Pi Pico 2 W todavía está pendiente de
            prueba.
          </p>
        </footer>
      </aside>

      <div className="layout-columna">
        {/* Con backend configurado, cada pantalla informa su propia conexión. */}
        {!backendConfigurado && <BannerConexion estado="sin-configurar" />}
        <main className="layout-contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
