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
    obtenerUltimoMovimiento: () => fallo(),
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
  ordenes: {
    solicitar: () => fallo(),
    obtenerUltimaOrden: () => fallo(),
    obtenerEstado: () => fallo(),
  },
  limites: {
    obtener: () => fallo(),
    guardar: () => fallo(),
  },
  horarios: {
    listar: () => fallo(),
    reemplazar: () => fallo(),
  },
  voz: {
    abrir: () => fallo(),
    registrarActividad: () => fallo(),
  },
  colchon: {
    obtenerConfig: () => fallo(),
    guardarConfig: () => fallo(),
    listarEventos: () => fallo(),
  },
  habitacion: {
    listarEventos: () => fallo(),
    listarFotos: () => fallo(),
    urlFoto: () => fallo(),
    subirFoto: () => fallo(),
    marcarFallida: () => fallo(),
  },
  alimentacion: {
    listarTomas: () => fallo(),
    crearToma: () => fallo(),
    cambiarEstado: () => fallo(),
    pedirPeso: () => fallo(),
    corregir: () => fallo(),
    obtenerLimites: () => fallo(),
    guardarLimites: () => fallo(),
    ultimaTemperatura: () => fallo(),
  },
  historial: {
    consultar: () => fallo(),
  },
  auth: {
    obtenerSesion: () => fallo(),
    iniciarSesion: () => fallo(),
    registrarse: () => fallo(),
    cerrarSesion: () => fallo(),
    suscribirCambiosSesion: () => () => {},
  },
  telegram: {
    listarDestinatarios: () => fallo(),
    crearDestinatario: () => fallo(),
    generarCodigo: () => fallo(),
    retirarDestinatario: () => fallo(),
  },
  cuentas: {
    listarBebes: () => fallo(),
    crearBebe: () => fallo(),
    listarDispositivos: () => fallo(),
    reclamarDispositivo: () => fallo(),
    asignarDispositivo: () => fallo(),
    listarDuenos: () => fallo(),
    invitarDueno: () => fallo(),
    retirarDueno: () => fallo(),
    listarInvitaciones: () => fallo(),
    aceptarInvitacion: () => fallo(),
  },
}
