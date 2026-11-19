import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import ProveedorSesion from './components/ProveedorSesion.tsx'
import RutaProtegida from './components/RutaProtegida.tsx'
import PaginaBebesDispositivos from './pages/PaginaBebesDispositivos.tsx'
import PaginaColchon from './pages/PaginaColchon.tsx'
import PaginaColchonPico from './pages/PaginaColchonPico.tsx'
import PaginaCamara from './pages/PaginaCamara.tsx'
import PaginaCuna from './pages/PaginaCuna.tsx'
import PaginaFiguras from './pages/PaginaFiguras.tsx'
import PaginaAlimentacion from './pages/PaginaAlimentacion.tsx'
import PaginaHabitacion from './pages/PaginaHabitacion.tsx'
import PaginaHistorial from './pages/PaginaHistorial.tsx'
import PaginaLogin from './pages/PaginaLogin.tsx'
import PaginaNoEncontrada from './pages/PaginaNoEncontrada.tsx'
import PaginaRegistro from './pages/PaginaRegistro.tsx'

// El router (BrowserRouter en main.tsx, MemoryRouter en los tests) y
// ProveedorServicios envuelven a App.
function App() {
  return (
    <ProveedorSesion>
      <Routes>
        <Route path="/login" element={<PaginaLogin />} />
        <Route path="/registro" element={<PaginaRegistro />} />
        <Route element={<RutaProtegida />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/cuna" replace />} />
            <Route path="/cuna" element={<PaginaCuna />} />
            <Route path="/bebes" element={<PaginaBebesDispositivos />} />
            <Route path="/colchon" element={<PaginaColchon />} />
            <Route path="/colchon-pico" element={<PaginaColchonPico />} />
            <Route path="/figuras" element={<PaginaFiguras />} />
            <Route path="/alimentacion" element={<PaginaAlimentacion />} />
            <Route path="/habitacion" element={<PaginaHabitacion />} />
            <Route path="/habitacion/camara" element={<PaginaCamara />} />
            <Route path="/historial" element={<PaginaHistorial />} />
            <Route path="*" element={<PaginaNoEncontrada />} />
          </Route>
        </Route>
      </Routes>
    </ProveedorSesion>
  )
}

export default App
