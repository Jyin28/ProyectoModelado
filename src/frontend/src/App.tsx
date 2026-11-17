import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import ProveedorSesion from './components/ProveedorSesion.tsx'
import RutaProtegida from './components/RutaProtegida.tsx'
import PaginaColchon from './pages/PaginaColchon.tsx'
import PaginaCuna from './pages/PaginaCuna.tsx'
import PaginaFiguras from './pages/PaginaFiguras.tsx'
import PaginaHistorial from './pages/PaginaHistorial.tsx'
import PaginaLogin from './pages/PaginaLogin.tsx'
import PaginaNoEncontrada from './pages/PaginaNoEncontrada.tsx'

// El router (BrowserRouter en main.tsx, MemoryRouter en los tests) y
// ProveedorServicios envuelven a App.
function App() {
  return (
    <ProveedorSesion>
      <Routes>
        <Route path="/login" element={<PaginaLogin />} />
        <Route element={<RutaProtegida />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/cuna" replace />} />
            <Route path="/cuna" element={<PaginaCuna />} />
            <Route path="/colchon" element={<PaginaColchon />} />
            <Route path="/figuras" element={<PaginaFiguras />} />
            <Route path="/historial" element={<PaginaHistorial />} />
            <Route path="*" element={<PaginaNoEncontrada />} />
          </Route>
        </Route>
      </Routes>
    </ProveedorSesion>
  )
}

export default App
