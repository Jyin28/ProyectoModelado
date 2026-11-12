import { describe, expect, it, vi } from 'vitest'
import {
  MENSAJE_NO_CONFIGURADO,
  serviciosNoConfigurados as s,
} from '../src/services/noConfigurado.ts'
import type { OrdenComando } from '../src/models/contrato.ts'

const orden: OrdenComando = { command: 'led_stop', params: {} }

describe('serviciosNoConfigurados', () => {
  it('cada método async devuelve el error y ningún dato', async () => {
    const resultados = await Promise.all([
      s.lecturas.obtenerUltimaAmbiental('d'),
      s.lecturas.obtenerHistorialAmbiental('d', 'a', 'b'),
      s.lecturas.obtenerUltimoPeso('d'),
      s.lecturas.obtenerEventosMovimiento('d', 'a'),
      s.comandos.enviarComando('figuras', orden),
      s.auth.obtenerSesion(),
      s.auth.iniciarSesion('a@b.c', 'x'),
      s.auth.cerrarSesion(),
    ])
    for (const r of resultados) {
      expect(r).toEqual({ ok: false, error: 'Backend no configurado' })
      expect(r).not.toHaveProperty('datos')
    }
    expect(MENSAJE_NO_CONFIGURADO).toBe('Backend no configurado')
  })

  it('las suscripciones avisan el error, nunca entregan datos y se cancelan', () => {
    const alRecibir = vi.fn()
    const alError = vi.fn()
    const cancelaciones = [
      s.lecturas.suscribirAmbiental('d', { alRecibir, alError }),
      s.comandos.suscribirConfirmaciones({ alRecibir, alError }),
    ]
    expect(alError).toHaveBeenCalledTimes(2)
    expect(alError).toHaveBeenCalledWith('Backend no configurado')
    expect(alRecibir).not.toHaveBeenCalled()
    for (const cancelar of cancelaciones) expect(() => cancelar()).not.toThrow()

    const alCambiar = vi.fn()
    const cancelar = s.auth.suscribirCambiosSesion(alCambiar)
    cancelar()
    expect(alCambiar).not.toHaveBeenCalled()
  })
})
