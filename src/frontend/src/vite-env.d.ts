/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_AMBIENTE_DEVICE_ID?: string
  readonly VITE_MOVIMIENTO_HABILITADO?: string
  readonly VITE_MOVIMIENTO_DEVICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
