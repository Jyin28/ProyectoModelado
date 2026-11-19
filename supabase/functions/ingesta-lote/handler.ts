// Version DESPLEGADA como `ingesta` en cuna-inteligente-dev (formato de lote).
// Respecto a la v4 que ya estaba desplegada solo agrega el tipo "movimiento":
// va solo en su lote, con data vacio, y lo guarda el RPC ingestar_movimiento.
type Evento = {
  event_id: string
  type: string
  at: string
  data: Record<string, unknown>
}

type Lote = {
  device_id: string
  events: Evento[]
}

type ResultadoSQL = {
  estado: string
  event_id?: string
  resultados?: Array<{ event_id: string; estado: string }>
}

type Guardar = (lote: Lote, tokenHash: string, recibidoEn: string) => Promise<ResultadoSQL>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DEVICE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const TIPOS_COLCHON = new Set([
  "monitoring_started",
  "alarm_started",
  "alarm_stopped",
  "monitoring_stopped",
])
const MAX_BODY_BYTES = 8192

function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function fechaUtc(v: unknown): v is string {
  if (typeof v !== "string" || !UTC.test(v) || !Number.isFinite(Date.parse(v))) return false
  return new Date(v).toISOString() === `${v.slice(0, 19)}.${(v.split(".")[1]?.replace("Z", "") ?? "").padEnd(3, "0")}Z`
}

function validarEvento(v: unknown): Evento | undefined {
  if (!objeto(v) || typeof v.event_id !== "string" || !UUID.test(v.event_id)) return
  if (typeof v.type !== "string" || typeof v.at !== "string" || !fechaUtc(v.at)) return
  if (!objeto(v.data)) return

  if (v.type === "ambiente") {
    const t = v.data.temperatura_c
    const h = v.data.humedad_pct
    if (typeof t !== "number" || !Number.isFinite(t)) return
    if (typeof h !== "number" || !Number.isFinite(h) || h < 0 || h > 100) return
  } else if (v.type === "movimiento") {
    // Un flanco ascendente del PIR no lleva datos.
    if (Object.keys(v.data).length !== 0) return
  } else if (TIPOS_COLCHON.has(v.type)) {
    // Los datos de cada evento son un objeto JSON; los campos específicos
    // proceden de monitoreo.py y se conservan sin transformarlos.
  } else {
    return
  }

  return {
    event_id: v.event_id.toLowerCase(),
    type: v.type,
    at: v.at,
    data: v.data,
  }
}

function error(status: number, codigo: string, mensaje: string, reintentable = false) {
  return Response.json({ codigo, mensaje, reintentable }, { status })
}

export function crearIngesta(guardar: Guardar) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response("Usa POST.", { status: 405, headers: { Allow: "POST" } })
    }

    const token = /^Bearer ([0-9a-f]{64})$/i.exec(request.headers.get("Authorization") ?? "")?.[1]
    if (!token) return error(401, "no_autorizado", "Credencial de dispositivo inválida.")
    if (!request.body) return error(400, "lote_invalido", "Se requiere un lote.")

    const buffer = new Uint8Array(MAX_BODY_BYTES)
    let bytes = 0
    let parsed: unknown
    const reader = request.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (bytes + value.length > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => undefined)
          return error(413, "lote_demasiado_grande", "El lote supera 8192 bytes.")
        }
        buffer.set(value, bytes)
        bytes += value.length
      }
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytes)))
    } catch {
      return error(400, "json_invalido", "El cuerpo no contiene JSON válido.")
    } finally {
      reader.releaseLock()
    }

    if (!objeto(parsed) || typeof parsed.device_id !== "string" ||
        !DEVICE_ID.test(parsed.device_id) || !Array.isArray(parsed.events) ||
        parsed.events.length < 1 || parsed.events.length > 5) {
      return error(400, "lote_invalido", "Se requiere device_id y entre 1 y 5 eventos.")
    }

    const events = parsed.events.map(validarEvento)
    if (events.some((e) => !e)) {
      return error(400, "evento_invalido", "Uno o más eventos tienen campos o valores inválidos.")
    }
    const ids = (events as Evento[]).map((e) => e.event_id)
    if (new Set(ids).size !== ids.length) {
      return error(400, "event_id_repetido", "El lote contiene event_id repetidos.")
    }
    // El movimiento lo guarda otro RPC (con su propio dispositivo y token): va solo.
    const hayMovimiento = (events as Evento[]).some((e) => e.type === "movimiento")
    if (hayMovimiento && events.length !== 1) {
      return error(400, "lote_invalido", "El evento de movimiento va solo en su lote.")
    }

    const lote: Lote = { device_id: parsed.device_id, events: events as Evento[] }
    const recibidoEn = new Date().toISOString()

    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
      const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
      const resultado = await guardar(lote, tokenHash, recibidoEn)

      if (resultado.estado === "no_autorizado") {
        return error(401, "no_autorizado", "Dispositivo o token no autorizado.")
      }
      if (resultado.estado === "sin_asignacion") {
        return error(422, "sin_asignacion", "No había un bebé asignado en la fecha del evento.")
      }
      if (resultado.estado === "id_reutilizado") {
        return error(409, "id_reutilizado", "Un event_id ya existe con datos diferentes.")
      }
      if (resultado.estado !== "ok") {
        return error(503, "ingesta_no_disponible", "No se pudo guardar el lote.", true)
      }

      return Response.json({ estado: "recibido", resultados: resultado.resultados ?? [] }, { status: 200 })
    } catch {
      return error(503, "ingesta_no_disponible", "Error temporal guardando el lote.", true)
    }
  }
}
