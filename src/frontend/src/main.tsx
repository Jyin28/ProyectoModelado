import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import ProveedorServicios from './components/ProveedorServicios.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProveedorServicios>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ProveedorServicios>
  </StrictMode>,
)
