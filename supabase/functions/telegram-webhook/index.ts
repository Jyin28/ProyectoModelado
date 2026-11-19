import { secreto as leerSecreto } from '../_shared/secretos.ts'
import { rpc } from '../_shared/supabase.ts'
import { crearEnviarTelegram } from '../_shared/telegram.ts'
import { crearWebhookTelegram, type EstadoVinculacion } from './handler.ts'

const tokenBot = await leerSecreto('TELEGRAM_BOT_TOKEN')
const secreto = await leerSecreto('TELEGRAM_WEBHOOK_SECRET')

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
