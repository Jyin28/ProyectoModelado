import { afterEach, describe, expect, it, vi } from 'vitest'

async function cargar() {
  vi.resetModules()
  return import('../src/services/supabase.ts')
}

afterEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
})

describe('services/supabase', () => {
  it('con las variables vacías el cliente es null y no hay backend', async () => {
    const { supabase, backendConfigurado } = await cargar()
    expect(supabase).toBeNull()
    expect(backendConfigurado).toBe(false)
  })

  it('con solo una variable sigue sin configurar', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://ejemplo.supabase.co')
    const { supabase, backendConfigurado } = await cargar()
    expect(supabase).toBeNull()
    expect(backendConfigurado).toBe(false)
  })

  it('con ambas variables crea el cliente', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://ejemplo.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'clave-de-prueba')
    const { supabase, backendConfigurado } = await cargar()
    expect(supabase).not.toBeNull()
    expect(backendConfigurado).toBe(true)
  })
})
