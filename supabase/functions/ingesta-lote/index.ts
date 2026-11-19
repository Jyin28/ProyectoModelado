// Version DESPLEGADA como `ingesta` en cuna-inteligente-dev (formato de lote).
import { crearIngesta } from "./handler.ts"

const url = Deno.env.get("SUPABASE_URL")
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")
const secretKey = secretKeys.default as string | undefined
const legacyKey = secretKey ? undefined : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const serverKey = secretKey ?? legacyKey

if (!url || !serverKey) {
  throw new Error("Falta SUPABASE_URL o la clave de servidor de Supabase.")
}

function cabeceras() {
  return new Headers({
    "Content-Type": "application/json",
    apikey: serverKey!,
    Authorization: `Bearer ${serverKey}`,
  })
}

Deno.serve(crearIngesta(async (lote, tokenHash, recibidoEn) => {
  // Movimiento (PIR): un solo evento, guardado por ingestar_movimiento.
  if (lote.events[0].type === "movimiento") {
    const evento = lote.events[0]
    const response = await fetch(`${url}/rest/v1/rpc/ingestar_movimiento`, {
      method: "POST",
      headers: cabeceras(),
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        p_event_id: evento.event_id,
        p_device_id: lote.device_id,
        p_token_sha256: tokenHash,
        p_ts: evento.at,
        p_recibido_en: recibidoEn,
      }),
    })
    if (!response.ok) {
      const detalle = await response.text().catch(() => "")
      console.error("RPC ingestar_movimiento falló:", response.status, detalle)
      throw new Error("Falló la operación SQL de ingesta de movimiento.")
    }
    const resultado: unknown = await response.json()
    switch (resultado) {
      case "creado":
      case "duplicado":
        return { estado: "ok", resultados: [{ event_id: evento.event_id, estado: resultado }] }
      case "no_autorizado":
      case "sin_asignacion":
      case "id_reutilizado":
        return { estado: resultado }
      default:
        throw new Error("Respuesta inesperada de ingestar_movimiento.")
    }
  }

  const response = await fetch(`${url}/rest/v1/rpc/ingestar_lote`, {
    method: "POST",
    headers: cabeceras(),
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      p_device_id: lote.device_id,
      p_token_sha256: tokenHash,
      p_recibido_en: recibidoEn,
      p_events: lote.events,
    }),
  })

  if (!response.ok) {
    const detalle = await response.text().catch(() => "")
    console.error("RPC ingestar_lote falló:", response.status, detalle)
    throw new Error("Falló la operación SQL de ingesta.")
  }

  return await response.json()
}))
