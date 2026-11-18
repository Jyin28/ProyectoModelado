// Cliente mínimo de la Bot API de Telegram. Solo envía texto: ningún aviso
// lleva fotografías ni archivos (CA-07.4, CA-18.4).

export type ResultadoEnvio =
  | { ok: true }
  | { ok: false; error: string; reintentable: boolean }

export type EnviarTexto = (chatId: number, texto: string) => Promise<ResultadoEnvio>

type Fetch = (entrada: string, init: RequestInit) => Promise<Response>

const TIEMPO_MAXIMO_MS = 5000

/**
 * El token solo vive en la URL de la llamada. Los códigos de error son
 * identificadores fijos (`telegram_403`, `red`, ...): nunca se guarda el
 * texto de la respuesta, que podría incluir datos del chat.
 */
export function crearEnviarTelegram(token: string, ejecutar: Fetch = fetch): EnviarTexto {
  return async (chatId, texto) => {
    try {
      const respuesta = await ejecutar(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          disable_web_page_preview: true,
        }),
      })
      if (respuesta.ok) return { ok: true }
      // 400 (chat inexistente) y 403 (bot bloqueado) no mejoran al repetir.
      const reintentable = respuesta.status === 429 || respuesta.status >= 500
      return { ok: false, error: `telegram_${respuesta.status}`, reintentable }
    } catch {
      return { ok: false, error: 'red', reintentable: true }
    }
  }
}

/** Comparación de secretos en tiempo constante respecto de la longitud común. */
export function secretosIguales(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false
  const codificador = new TextEncoder()
  const x = codificador.encode(a)
  const y = codificador.encode(b)
  let diferencia = x.length ^ y.length
  const largo = Math.max(x.length, y.length)
  for (let i = 0; i < largo; i += 1) diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diferencia === 0
}
