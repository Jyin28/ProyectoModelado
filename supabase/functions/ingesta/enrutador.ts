// Enruta una peticion de ingesta: un cuerpo con `events` es un lote (Pico del colchon
// y Pico 2 W); cualquier otro cuerpo es un evento unico (handler.ts).
// Sin dependencias de Deno para poder probarlo con Node.
export const MAX_CUERPO_BYTES = 8192

type Manejador = (request: Request) => Promise<Response>

export function crearEnrutador(unico: Manejador, lote: Manejador): Manejador {
  return async (request) => {
    if (request.method !== 'POST' || !request.body) return unico(request)

    const reader = request.body.getReader()
    const partes: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.length
        if (bytes > MAX_CUERPO_BYTES) {
          await reader.cancel().catch(() => undefined)
          return Response.json(
            { codigo: 'evento_demasiado_grande', mensaje: 'El cuerpo excede 8192 bytes.', reintentable: false },
            { status: 413 },
          )
        }
        partes.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const cuerpo = new Uint8Array(bytes)
    let desplazamiento = 0
    for (const parte of partes) {
      cuerpo.set(parte, desplazamiento)
      desplazamiento += parte.length
    }

    let esLote = false
    try {
      const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(cuerpo))
      esLote = typeof json === 'object' && json !== null && !Array.isArray(json) &&
        'events' in json
    } catch {
      // Un JSON invalido lo rechaza el manejador de evento unico con su mensaje.
    }

    const reenviada = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: cuerpo,
    })
    return esLote ? lote(reenviada) : unico(reenviada)
  }
}
