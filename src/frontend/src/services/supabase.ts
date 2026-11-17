import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Solo se usan la URL y la clave publicable. Nunca la clave de servicio.
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const clavePublicable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const backendConfigurado: boolean = Boolean(url && clavePublicable)

export const supabase: SupabaseClient | null =
  url && clavePublicable ? createClient(url, clavePublicable) : null
