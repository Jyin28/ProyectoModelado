// Llamadas RPC con la clave de servidor del entorno Edge. La clave nunca sale
// de la función ni se registra.

const url = Deno.env.get('SUPABASE_URL')
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
const secretKey = secretKeys.default as string | undefined
const legacyKey = secretKey ? undefined : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const serverKey = secretKey ?? legacyKey

if (!url || !serverKey) throw new Error('Falta la configuración de Supabase.')

export async function rpc<T>(nombre: string, cuerpo: Record<string, unknown>): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json', apikey: serverKey! })
  if (legacyKey) headers.set('Authorization', `Bearer ${legacyKey}`)

  const respuesta = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify(cuerpo),
  })
  if (!respuesta.ok) throw new Error('Falló la llamada al backend.')
  return (await respuesta.json()) as T
}
