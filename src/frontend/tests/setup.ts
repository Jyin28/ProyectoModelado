import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Ninguna prueba debe depender de un .env.local real.
vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
vi.stubEnv('VITE_LAMPARA_HABILITADA', '')
vi.stubEnv('VITE_LAMPARA_DEVICE_ID', '')

afterEach(() => {
  cleanup()
})
