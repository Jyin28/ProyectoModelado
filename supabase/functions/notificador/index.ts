import { secreto as leerSecreto } from '../_shared/secretos.ts'
import { rpc } from '../_shared/supabase.ts'
import { crearEnviarTelegram } from '../_shared/telegram.ts'
import { crearNotificador, type AvisoPendiente } from './handler.ts'

const tokenBot = await leerSecreto('TELEGRAM_BOT_TOKEN')
const secreto = await leerSecreto('NOTIFICADOR_SECRET')

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
