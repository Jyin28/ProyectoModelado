import { secretosIguales, type EnviarTexto } from '../_shared/telegram.ts'

export type EstadoVinculacion = 'vinculado' | 'codigo_invalido' | 'chat_duplicado'

export type Dependencias = {
  /** Secreto que Telegram envía en X-Telegram-Bot-Api-Secret-Token (setWebhook). */
  secreto: string
  vincular: (codigo: string, chatId: number) => Promise<{ estado: EstadoVinculacion; nombre?: string }>
  responder: EnviarTexto
}

const MAX_BYTES = 16 * 1024
const START = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{8,64}))?\s*$/

export const AYUDA =
  'Para recibir avisos, genera un código en la web (Destinatarios de Telegram) y envíame /start seguido del código.'

function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function ok(): Response {
  // Telegram reintenta si no recibe 200; los fallos se responden al chat.
  return new Response(null, { status: 200 })
}

/**
 * Webhook del bot. Solo atiende `/start <código>` en chats privados. No
 * registra el contenido de los mensajes ni el código.
 */
export function crearWebhookTelegram(dep: Dependencias) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405 })

    const secreto = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''
    if (!secretosIguales(secreto, dep.secreto)) return new Response(null, { status: 401 })

    let texto: string
    try {
      texto = await request.text()
    } catch {
      return ok()
    }
    if (new TextEncoder().encode(texto).length > MAX_BYTES) return ok()

    let actualizacion: unknown
    try {
      actualizacion = JSON.parse(texto)
    } catch {
      return ok()
    }
    const mensaje = objeto(actualizacion) ? actualizacion.message : undefined
    if (!objeto(mensaje) || !objeto(mensaje.chat) || typeof mensaje.text !== 'string') return ok()

    const { chat } = mensaje
    if (chat.type !== 'private' || typeof chat.id !== 'number' || !Number.isSafeInteger(chat.id)) {
      return ok()
    }

    const comando = START.exec(mensaje.text.trim())
    if (!comando) return ok()

    const codigo = comando[1]
    if (!codigo) {
      await dep.responder(chat.id, AYUDA)
      return ok()
    }

    try {
      const r = await dep.vincular(codigo, chat.id)
      const respuesta =
        r.estado === 'vinculado'
          ? `Listo${r.nombre ? `, ${r.nombre}` : ''}. Recibirás en este chat los avisos de la cuna.`
          : r.estado === 'chat_duplicado'
            ? 'Este chat ya recibe los avisos de ese módulo.'
            : 'El código no es válido o ya venció. Genera uno nuevo en la web.'
      await dep.responder(chat.id, respuesta)
    } catch {
      await dep.responder(chat.id, 'No pude completar la vinculación. Intenta de nuevo en unos minutos.')
    }
    return ok()
  }
}
