import type { Manejadores, Resultado, Servicios } from './tipos.ts'

export const MENSAJE_NO_CONFIGURADO = 'Backend no configurado'

// Nunca devuelve datos: cada método responde con el error y nada más.
function fallo<T>(): Promise<Resultado<T>> {
  return Promise.resolve({ ok: false, error: MENSAJE_NO_CONFIGURADO })
}

function suscripcionVacia<T>(manejadores: Manejadores<T>): () => void {
  manejadores.alError?.(MENSAJE_NO_CONFIGURADO)
  return () => {}
}

export const serviciosNoConfigurados: Servicios = {
  lecturas: {
    obtenerUltimaAmbiental: () => fallo(),
    obtenerHistorialAmbiental: () => fallo(),
    obtenerUltimoPeso: () => fallo(),
    obtenerEventosMovimiento: () => fallo(),
    suscribirAmbiental: (_dispositivoId, manejadores) =>
      suscripcionVacia(manejadores),
  },
  comandos: {
    enviarComando: () => fallo(),
    suscribirConfirmaciones: (manejadores) => suscripcionVacia(manejadores),
  },
  lampara: {
    solicitarLampara: () => fallo(),
    obtenerUltimaOrdenLampara: () => fallo(),
  },
  auth: {
    obtenerSesion: () => fallo(),
    iniciarSesion: () => fallo(),
    cerrarSesion: () => fallo(),
    suscribirCambiosSesion: () => () => {},
  },
}
