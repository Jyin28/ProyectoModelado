export type EventoAmbiente = {
  event_id: string
  device_id: string
  ts: string
  datos: { temperatura_c: number; humedad_pct: number }
}

export type EventoMovimiento = {
  event_id: string
  device_id: string
  ts: string
  datos: Record<string, never>
}

export type Resultado = 'creado' | 'duplicado' | 'no_autorizado' | 'id_reutilizado' | 'sin_asignacion'

type Guardar = (evento: EventoAmbiente, tokenHash: string, recibidoEn: string) => Promise<Resultado>
type GuardarMovimiento = (evento: EventoMovimiento, tokenHash: string, recibidoEn: string) => Promise<Resultado>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DEVICE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/
const DEVICE_ID_MOVIMIENTO = /^cuna-movimiento-[0-9]{2}$/
const PREFIJOS_OTROS_MODULOS = ['cuna-movimiento-', 'cuna-lampara-']
const UTC =/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/
const MAX_BODY_BYTES = 2048

function objeto(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fechaUtc(value: string): boolean {
  const partes = UTC.exec(value)
  if (!partes || value.startsWith('0000-') || !Number.isFinite(Date.parse(value))) return false
  return new Date(value).toISOString() === `${partes[1]}.${(partes[2] ?? '').padEnd(3, '0')}Z`
}

function lectura(value: unknown): EventoAmbiente | undefined {
  if (!objeto(value) || value.tipo !== 'ambiente' || !objeto(value.datos)) return
  const { event_id, device_id, ts, datos } = value
  const { temperatura_c, humedad_pct } = datos

  if (typeof event_id !== 'string' || !UUID.test(event_id)) return
  if (typeof device_id !== 'string' || !DEVICE_ID.test(device_id)) return
  if (typeof ts !== 'string' || !fechaUtc(ts)) return
  if (typeof temperatura_c !== 'number' || !Number.isFinite(temperatura_c)) return
  if (typeof humedad_pct !== 'number' || !Number.isFinite(humedad_pct) || humedad_pct < 0 || humedad_pct > 100) return

  return { event_id: event_id.toLowerCase(), device_id, ts, datos: { temperatura_c, humedad_pct } }
}

function movimiento(value: unknown): EventoMovimiento | undefined {
  if (!objeto(value) || value.tipo !== 'movimiento' || !objeto(value.datos)) return
  const { event_id, device_id, ts, datos } = value
  if (Object.keys(datos).length !== 0) return

  if (typeof event_id !== 'string' || !UUID.test(event_id)) return
  if (typeof device_id !== 'string' || !DEVICE_ID_MOVIMIENTO.test(device_id)) return
  if (typeof ts !== 'string' || !fechaUtc(ts)) return

  return { event_id: event_id.toLowerCase(), device_id, ts, datos: {} }
}

function error(status: number, codigo: string, mensaje: string, reintentable = false, headers?: HeadersInit) {
  return Response.json({ codigo, mensaje, reintentable }, { status, headers })
}

export function crearIngesta(guardar: Guardar, guardarMovimiento?: GuardarMovimiento) {
  return async (request: Request): Promise<Response> => {
    const recibidoEn = new Date().toISOString()
    if (request.method !== 'POST') {
      return error(405, 'metodo_invalido', 'Usa POST.', false, { Allow: 'POST' })
    }

    const token = /^Bearer ([0-9a-f]{64})$/i.exec(request.headers.get('Authorization') ?? '')?.[1]
    if (!token) return error(401, 'no_autorizado', 'Credencial de dispositivo inválida.')
    if (!request.body) return error(400, 'evento_invalido', 'Se requiere un evento ambiente válido.')

    const buffer = new Uint8Array(MAX_BODY_BYTES)
    let cantidad = 0
    const reader = request.body.getReader()
    let evento: EventoAmbiente | undefined
    let eventoMovimiento: EventoMovimiento | undefined
    let esMovimiento = false
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (cantidad + value.length > buffer.length) {
          await reader.cancel().catch(() => undefined)
          return error(413, 'evento_demasiado_grande', 'El evento excede 2048 bytes.')
        }
        buffer.set(value, cantidad)
        cantidad += value.length
      }
      const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, cantidad)))
      if (objeto(json) && json.tipo === 'movimiento') {
        esMovimiento = true
        eventoMovimiento = movimiento(json)
      } else {
        evento = lectura(json)
      }
    } catch {
      return error(400, 'evento_invalido', 'Se requiere un evento ambiente válido.')
    } finally {
      reader.releaseLock()
    }
    if (esMovimiento && !(eventoMovimiento && guardarMovimiento)) {
      return error(400, 'evento_invalido', 'Se requiere un evento movimiento válido.')
    }
    if (!esMovimiento && !evento) return error(400, 'evento_invalido', 'Se requiere un evento ambiente válido.')
    if (evento && PREFIJOS_OTROS_MODULOS.some((prefijo) => evento!.device_id.startsWith(prefijo))) {
      // Credencial de otro módulo usada contra ambiente: se rechaza sin tocar la base.
      return error(401, 'no_autorizado', 'Credencial de dispositivo inválida.')
    }

    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      const resultado = eventoMovimiento
        ? await guardarMovimiento!(eventoMovimiento, tokenHash, recibidoEn)
        : await guardar(evento!, tokenHash, recibidoEn)
      const idEvento = (eventoMovimiento ?? evento)!.event_id
      switch (resultado) {
        case 'creado':
          return Response.json({ event_id: idEvento, estado: 'recibido' }, { status: 201 })
        case 'duplicado':
          return error(409, 'evento_duplicado', 'El evento ya fue recibido.')
        case 'no_autorizado':
          return error(401, 'no_autorizado', 'Credencial de dispositivo inválida.')
        case 'id_reutilizado':
          return error(400, 'id_reutilizado', 'El identificador ya corresponde a otro evento.')
        case 'sin_asignacion':
          return error(422, 'sin_asignacion', 'El dispositivo no tenía un bebé asignado a la hora de medición.')
      }
    } catch {
      return error(503, 'ingesta_no_disponible', 'La ingesta está temporalmente indisponible.', true)
    }
  }
}
