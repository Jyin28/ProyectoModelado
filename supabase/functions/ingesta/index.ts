import { crearEnrutador } from './enrutador.ts'
import { crearIngesta, type Resultado } from './handler.ts'
import { crearGuardarLote, crearIngestaLote } from './lote.ts'

const url = Deno.env.get('SUPABASE_URL')
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
const secretKey = secretKeys.default as string | undefined
const legacyKey = secretKey ? undefined : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const serverKey = secretKey ?? legacyKey

if (!url || !serverKey) throw new Error('Falta la configuración de Supabase para la Ingesta.')

async function rpc(nombre: string, cuerpo: Record<string, unknown>): Promise<Resultado> {
  const headers = new Headers({ 'Content-Type': 'application/json', apikey: serverKey! })
  if (legacyKey) headers.set('Authorization', `Bearer ${legacyKey}`)

  const response = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify(cuerpo),
  })

  if (!response.ok) throw new Error('Falló la operación de Ingesta.')
  const resultado: unknown = await response.json()
  switch (resultado) {
    case 'creado':
    case 'duplicado':
    case 'no_autorizado':
    case 'id_reutilizado':
    case 'sin_asignacion':
    case 'monitoreo_inactivo':
    case 'evento_invalido':
      return resultado
    default:
      throw new Error('Respuesta inesperada de Ingesta.')
  }
}

// Evento unico: un evento por peticion ({tipo, datos}); lo guarda el RPC de su modulo.
const unico = crearIngesta(
  (evento, tokenHash, recibidoEn) => rpc('ingestar_ambiente', {
    p_event_id: evento.event_id,
    p_device_id: evento.device_id,
    p_token_sha256: tokenHash,
    p_ts: evento.ts,
    p_recibido_en: recibidoEn,
    p_temperatura_c: evento.datos.temperatura_c,
    p_humedad_pct: evento.datos.humedad_pct,
  }),
  (evento, tokenHash, recibidoEn) => rpc('ingestar_movimiento', {
    p_event_id: evento.event_id,
    p_device_id: evento.device_id,
    p_token_sha256: tokenHash,
    p_ts: evento.ts,
    p_recibido_en: recibidoEn,
  }),
  (evento, tokenHash, recibidoEn) => rpc('ingestar_colchon', {
    p_event_id: evento.event_id,
    p_device_id: evento.device_id,
    p_token_sha256: tokenHash,
    p_tipo: evento.tipo,
    p_ts: evento.ts,
    p_recibido_en: recibidoEn,
    p_datos: evento.datos,
  }),
  (evento, tokenHash, recibidoEn) => rpc('ingestar_habitacion', {
    p_event_id: evento.event_id,
    p_device_id: evento.device_id,
    p_token_sha256: tokenHash,
    p_tipo: evento.tipo,
    p_ts: evento.ts,
    p_recibido_en: recibidoEn,
    p_datos: evento.datos,
  }),
  (evento, tokenHash, recibidoEn) => rpc('ingestar_alimentacion', {
    p_event_id: evento.event_id,
    p_device_id: evento.device_id,
    p_token_sha256: tokenHash,
    p_tipo: evento.tipo,
    p_ts: evento.ts,
    p_recibido_en: recibidoEn,
    p_datos: evento.datos,
  }),
)

// Lote: {device_id, events: [{event_id, type, at, data}]}, el formato de la Pico del
// colchon y de la Pico 2 W. Devuelve la respuesta JSON del RPC sin interpretarla.
async function rpcLote(nombre: string, cuerpo: Record<string, unknown>): Promise<unknown> {
  const headers = new Headers({ 'Content-Type': 'application/json', apikey: serverKey! })
  if (legacyKey) headers.set('Authorization', `Bearer ${legacyKey}`)

  const response = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify(cuerpo),
  })
  if (!response.ok) throw new Error('Falló la operación de Ingesta.')
  return await response.json()
}

const lote = crearIngestaLote(crearGuardarLote(rpcLote))

Deno.serve(crearEnrutador(unico, lote))
