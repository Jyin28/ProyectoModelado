import { rpc } from '../_shared/supabase.ts'
import { crearEnviarTelegram } from '../_shared/telegram.ts'
import { crearNotificador, type AvisoPendiente } from './handler.ts'

const tokenBot = Deno.env.get('TELEGRAM_BOT_TOKEN')
const secreto = Deno.env.get('NOTIFICADOR_SECRET')

if (!tokenBot || !secreto) throw new Error('Falta la configuración del notificador.')

Deno.serve(crearNotificador({
  secreto,
  avisosPendientes: (limite) => rpc<AvisoPendiente[]>('avisos_pendientes', { p_limite: limite }),
  registrarIntento: async (avisoId, ok, error, reintentable) => {
    await rpc('registrar_intento_aviso', {
      p_aviso_id: avisoId,
      p_ok: ok,
      p_error: error,
      p_reintentable: reintentable,
    })
  },
  enviar: crearEnviarTelegram(tokenBot),
}))
