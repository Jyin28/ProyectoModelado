import { crearIngesta } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
const secretKey = secretKeys.default as string | undefined
const legacyKey = secretKey ? undefined : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const serverKey = secretKey ?? legacyKey

if (!url || !serverKey) throw new Error('Falta la configuración de Supabase para la Ingesta.')

Deno.serve(crearIngesta(async (evento, tokenHash, recibidoEn) => {
  const headers = new Headers({ 'Content-Type': 'application/json', apikey: serverKey })
  if (legacyKey) headers.set('Authorization', `Bearer ${legacyKey}`)

  const response = await fetch(`${url}/rest/v1/rpc/ingestar_ambiente`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      p_event_id: evento.event_id,
      p_device_id: evento.device_id,
      p_token_sha256: tokenHash,
      p_ts: evento.ts,
      p_recibido_en: recibidoEn,
      p_temperatura_c: evento.datos.temperatura_c,
      p_humedad_pct: evento.datos.humedad_pct,
    }),
  })

  if (!response.ok) throw new Error('Falló la operación de Ingesta.')
  const resultado: unknown = await response.json()
  switch (resultado) {
    case 'creado':
    case 'duplicado':
    case 'no_autorizado':
    case 'id_reutilizado':
    case 'sin_asignacion':
      return resultado
    default:
      throw new Error('Respuesta inesperada de Ingesta.')
  }
}))
