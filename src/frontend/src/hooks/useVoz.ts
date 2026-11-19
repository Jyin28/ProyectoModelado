import { useCallback, useEffect, useRef, useState } from 'react'
import type { SesionVoz } from '../services/tipos.ts'
import { aBase64, capturarMicrofono, type Capturador, type Captura } from '../utils/voz.ts'
import { useServicios } from './useServicios.ts'

export type EstadoVoz = 'inactiva' | 'conectando' | 'hablando' | 'error'

export const MENSAJE_SIN_MICROFONO =
  'No se pudo usar el micrófono. Revisa el permiso del navegador.'

/** El navegador solo da el micrófono en https o en localhost (contexto seguro). */
export const MENSAJE_CONTEXTO_INSEGURO =
  'El navegador no da el micrófono en esta dirección. Abre la web con https o desde localhost.'

/**
 * Sesión de voz en vivo. La voz se envía por el canal privado y se descarta:
 * ni la web ni el backend la guardan. El estado «hablando» solo significa que
 * se están enviando fragmentos; no prueba que la cuna los reproduzca.
 */
export function useVoz(
  dispositivoId: string,
  productoId: string,
  capturador: Capturador = capturarMicrofono,
) {
  const { servicios } = useServicios()
  const [estado, setEstado] = useState<EstadoVoz>('inactiva')
  const [error, setError] = useState<string | null>(null)
  const sesion = useRef<SesionVoz | null>(null)
  const captura = useRef<Captura | null>(null)
  const ocupado = useRef(false)
  const contador = useRef(0)

  const cerrar = useCallback(
    async (registrar: boolean) => {
      captura.current?.detener()
      captura.current = null
      const abierta = sesion.current
      sesion.current = null
      if (abierta) {
        await abierta.cerrar()
        if (registrar) void servicios.voz.registrarActividad(dispositivoId, 'fin')
      }
    },
    [servicios, dispositivoId],
  )

  const iniciar = useCallback(async () => {
    if (ocupado.current || sesion.current) return
    // Sin contexto seguro no hay micrófono: se avisa antes de abrir el canal de voz.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError(MENSAJE_CONTEXTO_INSEGURO)
      setEstado('error')
      return
    }
    ocupado.current = true
    setError(null)
    setEstado('conectando')
    try {
      const r = await servicios.voz.abrir(productoId)
      if (!r.ok) {
        setError(r.error)
        setEstado('error')
        return
      }
      sesion.current = r.datos
      contador.current = 0
      try {
        captura.current = await capturador((pcm) => {
          const actual = sesion.current
          if (!actual) return
          const numero = contador.current
          contador.current += 1
          void actual.enviar(numero, aBase64(pcm))
        })
      } catch {
        await cerrar(false)
        setError(MENSAJE_SIN_MICROFONO)
        setEstado('error')
        return
      }
      void servicios.voz.registrarActividad(dispositivoId, 'inicio')
      setEstado('hablando')
    } finally {
      ocupado.current = false
    }
  }, [servicios, productoId, dispositivoId, capturador, cerrar])

  const detener = useCallback(async () => {
    await cerrar(true)
    setEstado('inactiva')
  }, [cerrar])

  // Al salir de la pantalla se corta el micrófono y se cierra el canal.
  useEffect(
    () => () => {
      void cerrar(true)
    },
    [cerrar],
  )

  return { estado, error, iniciar, detener }
}
