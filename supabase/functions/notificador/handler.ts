import { secretosIguales, type EnviarTexto } from '../_shared/telegram.ts'

export type AvisoPendiente = {
  aviso_id: string
  chat_id: number
  tipo: string
  descripcion: string | null
  ts: string
  device_id: string
}

export type Dependencias = {
  /** Secreto compartido con pg_cron (cabecera Authorization). */
  secreto: string
  avisosPendientes: (limite: number) => Promise<AvisoPendiente[]>
  registrarIntento: (
    avisoId: string,
    ok: boolean,
    error: string | null,
    reintentable: boolean,
  ) => Promise<void>
  enviar: EnviarTexto
  /** Reloj inyectable para las pruebas. */
  ahora?: () => number
}

const LIMITE_POR_EJECUCION = 20
const PRESUPUESTO_MS = 20_000

const formateadorCR = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica',
  dateStyle: 'long',
  timeStyle: 'medium',
  hourCycle: 'h23',
})

/**
 * Solo texto, con fecha y hora de America/Costa_Rica. El texto sale únicamente
 * del tipo y la descripción: nunca de los datos del evento, que pueden
 * apuntar a fotografías (CA-07.4).
 */
export function textoAviso(aviso: AvisoPendiente): string {
  const fecha = new Date(aviso.ts)
  const cuando = Number.isNaN(fecha.getTime())
    ? 'hora desconocida'
    : `${formateadorCR.format(fecha)} (hora de Costa Rica)`
  const que = aviso.descripcion?.trim() || aviso.tipo.replaceAll('_', ' ')
  return `Cuna Inteligente: ${que}.\n${cuando}`
}

function json(cuerpo: unknown, status = 200): Response {
  return Response.json(cuerpo, { status })
}

export function crearNotificador(dep: Dependencias) {
  const ahora = dep.ahora ?? Date.now
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ codigo: 'metodo_invalido' }, 405)

    const credencial = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? ''
    if (!secretosIguales(credencial, dep.secreto)) return json({ codigo: 'no_autorizado' }, 401)

    const inicio = ahora()
    let avisos: AvisoPendiente[]
    try {
      avisos = await dep.avisosPendientes(LIMITE_POR_EJECUCION)
    } catch {
      return json({ codigo: 'backend_no_disponible' }, 503)
    }

    let enviados = 0
    let fallidos = 0
    let sinRegistrar = 0
    for (const aviso of avisos) {
      // Lo que no se alcance queda reservado y vuelve a la cola al vencer la reserva.
      if (ahora() - inicio > PRESUPUESTO_MS) break
      const resultado = await dep.enviar(aviso.chat_id, textoAviso(aviso))
      try {
        await dep.registrarIntento(
          aviso.aviso_id,
          resultado.ok,
          resultado.ok ? null : resultado.error,
          resultado.ok ? true : resultado.reintentable,
        )
      } catch {
        // El mensaje salió pero el resultado no se guardó: al vencer la
        // reserva se repetirá (entrega al menos una vez).
        sinRegistrar += 1
        continue
      }
      if (resultado.ok) enviados += 1
      else fallidos += 1
    }

    return json({ recibidos: avisos.length, enviados, fallidos, sin_registrar: sinRegistrar })
  }
}
