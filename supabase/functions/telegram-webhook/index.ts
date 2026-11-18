import { rpc } from '../_shared/supabase.ts'
import { crearEnviarTelegram } from '../_shared/telegram.ts'
import { crearWebhookTelegram, type EstadoVinculacion } from './handler.ts'

const tokenBot = Deno.env.get('TELEGRAM_BOT_TOKEN')
const secreto = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')

if (!tokenBot || !secreto) throw new Error('Falta la configuración del webhook de Telegram.')

Deno.serve(crearWebhookTelegram({
  secreto,
  vincular: (codigo, chatId) =>
    rpc<{ estado: EstadoVinculacion; nombre?: string }>('vincular_telegram', {
      p_codigo: codigo,
      p_chat_id: chatId,
    }),
  responder: crearEnviarTelegram(tokenBot),
}))
