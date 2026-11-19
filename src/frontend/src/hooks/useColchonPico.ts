import { useEffect, useState } from 'react'
import type {
  DatosAlarmStarted,
  DatosMonitoringStarted,
  DatosMonitoringStopped,
  EstadoColchonPico,
  EventoColchonPico,
} from '../models/colchonPico.ts'
import { useServicios } from './useServicios.ts'
import { useSesion } from './useSesion.ts'

export const INTERVALO_CONSULTA_COLCHON_MS = 5_000
export const TIMEOUT_INACTIVIDAD_COLCHON_S = 40

export type InfoColchonPico = {
  activo: boolean
  cargando: boolean
  fallo: boolean
  estado: EstadoColchonPico
  ultimoEvento: EventoColchonPico | null
  eventos: EventoColchonPico[]
  referencia_g: number | null
  tolerancia_pct: number | null
  umbral_g: number | null
  pesoAlarma_g: number | null
  motivoDetencion: string | null
  enviandoComando: boolean
  errorComando: string | null
  mensajeExito: string | null
  iniciarMonitoreo: (
    duracionS?: number,
    toleranciaPct?: number,
    alarmaS?: number,
    referenciaG?: number | null,
  ) => Promise<boolean>
  detenerMonitoreo: () => Promise<boolean>
  detenerAlarma: () => Promise<boolean>
  capturarReferencia: (referenciaG?: number | null) => Promise<boolean>
  tararBalanza: () => Promise<boolean>
  refrescar: () => Promise<void>
}

export function useColchonPico(dispositivoId: string): InfoColchonPico {
  const { servicios, backendConfigurado } = useServicios()
  const { estado: sesion } = useSesion()
  const colchonServicio = servicios.colchonPico

  const usuarioId =
    sesion.tipo === 'autenticado' ? sesion.sesion.usuario_id : null
  const habilitado = backendConfigurado && usuarioId !== null

  const [ultimoEvento, setUltimoEvento] = useState<EventoColchonPico | null>(null)
  const [eventos, setEventos] = useState<EventoColchonPico[]>([])
  const [fallo, setFallo] = useState(false)
  const [resuelta, setResuelta] = useState(false)
  const [enviandoComando, setEnviandoComando] = useState(false)
  const [errorComando, setErrorComando] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [refresco, setRefresco] = useState(0)

  useEffect(() => {
    if (!habilitado) return
    const control = { vigente: true, enCurso: false }

    const consultar = async () => {
      if (!control.vigente || control.enCurso) return
      control.enCurso = true
      try {
        const [resUltimo, resHistorial] = await Promise.all([
          colchonServicio.obtenerUltimoEvento(dispositivoId),
          colchonServicio.obtenerHistorialEventos(dispositivoId, 20),
        ])
        if (!control.vigente) return

        if (resUltimo.ok && resHistorial.ok) {
          setUltimoEvento(resUltimo.datos)
          setEventos(resHistorial.datos)
          setFallo(false)
        } else {
          setFallo(true)
        }
      } catch {
        if (control.vigente) setFallo(true)
      } finally {
        if (control.vigente) {
          control.enCurso = false
          setResuelta(true)
        }
      }
    }

    void consultar()

    const intervalo = setInterval(() => {
      void consultar()
    }, INTERVALO_CONSULTA_COLCHON_MS)

    const cancelar = colchonServicio.suscribirEventos(dispositivoId, {
      alRecibir: (nuevo) => {
        if (!control.vigente) return
        setUltimoEvento(nuevo)
        setEventos((prev) => [nuevo, ...prev.filter((e) => e.event_id !== nuevo.event_id)])
        setFallo(false)
      },
      alError: () => {
        if (control.vigente) setFallo(true)
      },
    })

    return () => {
      control.vigente = false
      clearInterval(intervalo)
      cancelar()
    }
  }, [habilitado, colchonServicio, dispositivoId, refresco])

  // Deducción de estado operacional con expiración por inactividad (40 s)
  let estado: EstadoColchonPico = 'detenido'
  let motivoDetencion: string | null = null

  if (ultimoEvento) {
    const ahora = Date.now()
    const tiempoEvento = Date.parse(ultimoEvento.ts)
    const segundosDesdeEvento = Number.isFinite(tiempoEvento)
      ? Math.max(0, (ahora - tiempoEvento) / 1000)
      : 0

    if (ultimoEvento.tipo === 'alarm_started') {
      if (segundosDesdeEvento > 90) {
        estado = 'detenido'
        motivoDetencion = 'inactividad_alarma'
      } else {
        estado = 'alarma'
      }
    } else if (ultimoEvento.tipo === 'monitoring_started') {
      const d = ultimoEvento.datos as DatosMonitoringStarted
      const duracionS = d.duration_s ?? 120

      // Si han pasado más de 40 s sin confirmación viva (o venció la duración), se marca inactivo
      if (segundosDesdeEvento > TIMEOUT_INACTIVIDAD_COLCHON_S || segundosDesdeEvento > duracionS) {
        estado = 'detenido'
        motivoDetencion = segundosDesdeEvento > duracionS ? 'duración completada' : 'inactividad (> 40 s)'
      } else {
        estado = 'monitoreando'
      }
    } else {
      estado = 'detenido'
      const d = ultimoEvento.datos as DatosMonitoringStopped
      motivoDetencion = d.reason ?? null
    }
  }

  // Deducción de parámetros numéricos
  let referencia_g: number | null = null
  let tolerancia_pct: number | null = null
  let umbral_g: number | null = null
  let pesoAlarma_g: number | null = null

  if (ultimoEvento?.tipo === 'alarm_started') {
    const d = ultimoEvento.datos as DatosAlarmStarted
    referencia_g = d.reference_g ?? null
    umbral_g = d.threshold_g ?? null
    pesoAlarma_g = d.weight_g ?? null
  } else if (ultimoEvento?.tipo === 'monitoring_started') {
    const d = ultimoEvento.datos as DatosMonitoringStarted
    referencia_g = d.reference_g ?? null
    tolerancia_pct = d.tolerance_pct ?? null
    if (referencia_g !== null && tolerancia_pct !== null) {
      umbral_g = Number((referencia_g * (1 - tolerancia_pct / 100)).toFixed(1))
    }
  }

  // Si no tenemos referencia en el último evento, buscar en el historial reciente
  if (referencia_g === null) {
    const eventoMonitoreo = eventos.find(
      (e) => e.tipo === 'monitoring_started' || e.tipo === 'alarm_started',
    )
    if (eventoMonitoreo) {
      const d = eventoMonitoreo.datos as DatosMonitoringStarted
      referencia_g = d.reference_g ?? null
      tolerancia_pct = d.tolerance_pct ?? null
      if (referencia_g !== null && tolerancia_pct !== null) {
        umbral_g = Number((referencia_g * (1 - tolerancia_pct / 100)).toFixed(1))
      }
    }
  }

  const cargando = habilitado && !resuelta

  const ejecutarComando = async (
    comando: string,
    params: Record<string, unknown> = {},
  ): Promise<boolean> => {
    setEnviandoComando(true)
    setErrorComando(null)
    setMensajeExito(null)
    try {
      const r = await colchonServicio.solicitarComando(
        dispositivoId,
        comando,
        params,
      )
      if (r.ok) {
        const nombresComando: Record<string, string> = {
          mattress_start: 'Iniciar Monitoreo',
          mattress_stop: 'Detener Monitoreo',
          alarm_stop: 'Detener Alarma',
          mattress_reference: 'Capturar Referencia de Peso',
          scale_tare: 'Tarar Balanza',
        }
        setMensajeExito(
          `Orden "${nombresComando[comando] ?? comando}" registrada en Supabase (pendiente de ejecución por el colchón).`,
        )
        setRefresco((prev) => prev + 1)
        return true
      } else {
        setErrorComando(r.error)
        return false
      }
    } catch {
      setErrorComando('Error de conexión al enviar comando.')
      return false
    } finally {
      setEnviandoComando(false)
    }
  }

  const iniciarMonitoreo = async (
    duracionS = 120,
    toleranciaPct = 10,
    alarmaS = 60,
    referenciaG?: number | null,
  ) => {
    const params: Record<string, unknown> = {
      duration_s: duracionS,
      tolerance_pct: toleranciaPct,
      alarm_s: alarmaS,
    }
    if (typeof referenciaG === 'number' && Number.isFinite(referenciaG) && referenciaG > 0) {
      params.reference_g = referenciaG
    }
    return ejecutarComando('mattress_start', params)
  }

  const detenerMonitoreo = async () => {
    return ejecutarComando('mattress_stop', {})
  }

  const detenerAlarma = async () => {
    return ejecutarComando('alarm_stop', {})
  }

  const capturarReferencia = async (referenciaG?: number | null) => {
    const params: Record<string, unknown> = {}
    if (typeof referenciaG === 'number' && Number.isFinite(referenciaG) && referenciaG > 0) {
      params.reference_g = referenciaG
    }
    return ejecutarComando('mattress_reference', params)
  }

  const tararBalanza = async () => {
    return ejecutarComando('scale_tare', {})
  }

  return {
    activo: habilitado,
    cargando,
    fallo,
    estado,
    ultimoEvento,
    eventos,
    referencia_g,
    tolerancia_pct,
    umbral_g,
    pesoAlarma_g,
    motivoDetencion,
    enviandoComando,
    errorComando,
    mensajeExito,
    iniciarMonitoreo,
    detenerMonitoreo,
    detenerAlarma,
    capturarReferencia,
    tararBalanza,
    refrescar: () => {
      setRefresco((prev) => prev + 1)
      return Promise.resolve()
    },
  }
}
