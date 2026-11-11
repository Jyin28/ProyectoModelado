import { Link, NavLink, Outlet } from 'react-router'
import BannerConexion from './BannerConexion.tsx'
import './Layout.css'

const ENLACES = [
  { ruta: '/cuna', texto: 'Cuna' },
  { ruta: '/colchon', texto: 'Colchón' },
  { ruta: '/figuras', texto: 'Figuras LED' },
  { ruta: '/historial', texto: 'Historial' },
]

function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/cuna" className="layout-marca">
          Cuna Inteligente IoT
        </Link>
        <nav className="layout-nav" aria-label="Principal">
          <ul>
            {ENLACES.map(({ ruta, texto }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  className={({ isActive }) =>
                    isActive ? 'nav-enlace nav-enlace-activo' : 'nav-enlace'
                  }
                >
                  {texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <BannerConexion estado="sin-configurar" />

      <main className="layout-contenido">
        <Outlet />
      </main>

      <footer className="layout-pie">
        <p>
          Aplicación base del Sprint 3. La integración con Supabase y el
          firmware de la Raspberry Pi Pico 2 W todavía está pendiente de
          prueba.
        </p>
      </footer>
    </div>
  )
}

export default Layout
