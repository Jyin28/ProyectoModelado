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
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    env: ENTORNO_NEUTRO,
  },
})
