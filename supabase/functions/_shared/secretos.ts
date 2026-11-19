// Secretos de las funciones: primero la variable de entorno (Edge Functions >
// Secrets) y, si falta, el secreto de Vault con el mismo nombre en minúsculas
// (public.leer_secreto_funcion). Nunca se registra su valor.
import { rpc } from './supabase.ts'

export async function secreto(nombre: string): Promise<string | undefined> {
  const entorno = Deno.env.get(nombre)
  if (entorno) return entorno
  try {
    return (await rpc<string | null>('leer_secreto_funcion', { p_nombre: nombre })) ?? undefined
  } catch {
    return undefined
  }
}
