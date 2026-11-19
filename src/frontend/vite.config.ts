import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Variables VITE_* que las pruebas deben ver vacias aunque exista un .env.local con la
// configuracion de la maqueta (activa controles de hardware y cambia los modulos).
// Cada prueba que las necesita las fija con vi.stubEnv.
const ENTORNO_NEUTRO = Object.fromEntries(
  [
    'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_TELEGRAM_BOT',
    'VITE_AMBIENTE_DEVICE_ID', 'VITE_LAMPARA_DEVICE_ID', 'VITE_MOVIMIENTO_DEVICE_ID',
    'VITE_FIGURAS_DEVICE_ID', 'VITE_AUDIO_DEVICE_ID', 'VITE_COLCHON_DEVICE_ID',
    'VITE_COLCHON_PICO_DEVICE_ID', 'VITE_HABITACION_DEVICE_ID', 'VITE_ALIMENTACION_DEVICE_ID',
    'VITE_CUNA_PRODUCTO_ID', 'VITE_LAMPARA_HABILITADA', 'VITE_MOVIMIENTO_HABILITADO',
    'VITE_ORDENES_HABILITADAS', 'VITE_VOZ_HABILITADA', 'VITE_CAMARA_HABILITADA',
  ].map((nombre) => [nombre, '']),
)

// https://vite.dev/config/
// `npm run dev:https` (modo "https") sirve la web por https con un certificado autofirmado y
// escucha en la red local: el navegador del telefono solo da el microfono en un contexto
// seguro (https o localhost), y desde el telefono la direccion es https://<IP>:5173.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    env: ENTORNO_NEUTRO,
  },
}))
