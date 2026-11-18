import { afterEach, describe, expect, it, vi } from 'vitest'
import { MENSAJE_CUENTAS } from '../src/services/cuentas.ts'
import {
  crearServicioHorarios,
  crearServicioLimites,
  crearServicioOrdenes,
  crearServicioVoz,
  MENSAJE_CONSULTA_ORDEN,
  MENSAJE_SOLICITUD_ORDEN,
  type ClienteOrdenes,
  type ClienteRpc,
  type ClienteVoz,
} from '../src/services/ordenes.ts'
import { dispositivoAudioId, dispositivoFigurasId, ordenesHabilitadas, productoCunaId, vozHabilitada } from '../src/services/configuracion.ts'

type Respuesta = { data: unknown; error: unknown } | Error

function rpcCon(respuesta: Respuesta | ((nombre: string, p: Record<string, unknown>) => Respuesta)) {
  const rpc = vi.fn(async (nombre: string, parametros: Record<string, unknown>) => {
    const r = typeof respuesta === 'function' ? respuesta(nombre, parametros) : respuesta
    if (r instanceof Error) throw r
    return r
  })
  return { cliente: { rpc } as unknown as ClienteRpc, rpc }
}

afterEach(() => vi.unstubAllEnvs())

describe('crearServicioOrdenes', () => {
  const FILA = {
    command_id: 'c-1',
    device_id: 'cuna-figuras-01',
    command: 'led_all',
    params: { on: true },
    creado_en: '2026-11-18T10:00:00Z',
    vence_en: '2026-11-18T10:00:15Z',
    estado: 'pendiente',
    entregado_en: null,
    confirmado_en: null,
    error: null,
  }

  it('solicitar manda el comando y sus parámetros por el RPC y devuelve la orden pedida', async () => {
    const { cliente, rpc } = rpcCon((_n, p) => ({
      data: { ...FILA, command_id: p.p_command_id },
      error: null,
    }))
    const r = await crearServicioOrdenes(cliente as unknown as ClienteOrdenes).solicitar('cuna-figuras-01', {
      command: 'led_all',
      params: { on: true },
    })
    expect(r.ok).toBe(true)
    const [nombre, params] = rpc.mock.calls[0]
    expect(nombre).toBe('solicitar_orden')
    expect(params).toMatchObject({ p_device_id: 'cuna-figuras-01', p_command: 'led_all', p_params: { on: true } })
    expect(String(params.p_command_id)).toMatch(/^[0-9a-f-]{36}$/)
    if (r.ok) expect(r.datos).toMatchObject({ device_id: 'cuna-figuras-01', command: 'led_all', estado: 'pendiente' })
  })

  it('un comando fuera de rango no llega al servidor', async () => {
    const { cliente, rpc } = rpcCon({ data: FILA, error: null })
    const servicio = crearServicioOrdenes(cliente as unknown as ClienteOrdenes)
    for (const comando of [
      { command: 'led_sequence', params: { name: 'chase', step_s: 1 } },
      { command: 'led_set', params: { index: 6, on: true } },
      { command: 'audio_play', params: { sound: 'otro' } },
      { command: 'led_stop', params: { on: true } },
    ] as const) {
      expect(await servicio.solicitar('d', comando as never)).toEqual({ ok: false, error: MENSAJE_SOLICITUD_ORDEN })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('una respuesta que no es la orden pedida no se presenta', async () => {
    const { cliente } = rpcCon({ data: { ...FILA, command_id: 'otro' }, error: null })
    expect(
      await crearServicioOrdenes(cliente as unknown as ClienteOrdenes).solicitar('cuna-figuras-01', {
        command: 'led_all',
        params: { on: true },
      }),
    ).toEqual({ ok: false, error: MENSAJE_SOLICITUD_ORDEN })
  })

  it('los errores conocidos se traducen y el texto del servidor nunca se reenvía', async () => {
    const orden = { command: 'led_all', params: { on: true } } as const
    for (const [message, esperado] of [
      ['no_autorizado', 'No tienes permiso para esta operación.'],
      ['parametros_invalidos', 'Los valores pedidos no son válidos para este comando.'],
      ['texto interno con detalles', MENSAJE_CUENTAS],
    ]) {
      const { cliente } = rpcCon({ data: null, error: { message } })
      expect(await crearServicioOrdenes(cliente as unknown as ClienteOrdenes).solicitar('d', orden)).toEqual({
        ok: false,
        error: esperado,
      })
    }
    const { cliente } = rpcCon(new Error('red caída'))
    expect(await crearServicioOrdenes(cliente as unknown as ClienteOrdenes).solicitar('d', orden)).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('obtenerUltimaOrden consulta solo los comandos pedidos y valida la fila', async () => {
    const consulta = {
      select: vi.fn(() => consulta),
      eq: vi.fn(() => consulta),
      in: vi.fn(() => consulta),
      order: vi.fn(() => consulta),
      limit: vi.fn(() => consulta),
      maybeSingle: vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({ data: FILA, error: null })),
    }
    const cliente = { from: vi.fn(() => consulta), rpc: vi.fn() } as unknown as ClienteOrdenes
    const servicio = crearServicioOrdenes(cliente)
    const r = await servicio.obtenerUltimaOrden('cuna-figuras-01', ['led_set', 'led_all'])
    expect(r).toMatchObject({ ok: true, datos: { command_id: 'c-1', estado: 'pendiente' } })
    expect(consulta.in).toHaveBeenCalledWith('command', ['led_set', 'led_all'])
    expect(consulta.eq).toHaveBeenCalledWith('device_id', 'cuna-figuras-01')

    consulta.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await servicio.obtenerUltimaOrden('d', ['led_all'])).toEqual({ ok: true, datos: null })
    consulta.maybeSingle.mockResolvedValueOnce({ data: { ...FILA, estado: 'inventado' }, error: null })
    expect(await servicio.obtenerUltimaOrden('d', ['led_all'])).toEqual({ ok: false, error: MENSAJE_CONSULTA_ORDEN })
    consulta.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    expect(await servicio.obtenerUltimaOrden('d', ['led_all'])).toEqual({ ok: false, error: MENSAJE_CONSULTA_ORDEN })
  })

  it('obtenerEstado devuelve el estado confirmado o vacío y rechaza formas inválidas', async () => {
    const bien = rpcCon({ data: { estado: { monitoreo: true }, actualizado_en: '2026-11-18T10:00:00Z' }, error: null })
    expect(await crearServicioOrdenes(bien.cliente as unknown as ClienteOrdenes).obtenerEstado('d')).toEqual({
      ok: true,
      datos: { estado: { monitoreo: true }, actualizado_en: '2026-11-18T10:00:00Z' },
    })
    expect(bien.rpc).toHaveBeenCalledWith('estado_de_modulo', { p_device_id: 'd' })
    const vacio = rpcCon({ data: { estado: {}, actualizado_en: null }, error: null })
    expect(await crearServicioOrdenes(vacio.cliente as unknown as ClienteOrdenes).obtenerEstado('d')).toEqual({
      ok: true,
      datos: { estado: {}, actualizado_en: null },
    })
    for (const data of [null, { estado: [], actualizado_en: null }, { estado: {}, actualizado_en: 5 }]) {
      const mal = rpcCon({ data, error: null })
      expect(await crearServicioOrdenes(mal.cliente as unknown as ClienteOrdenes).obtenerEstado('d')).toEqual({
        ok: false,
        error: MENSAJE_CUENTAS,
      })
    }
  })
})

describe('crearServicioLimites', () => {
  const LIM = { temp_min: 20, temp_max: 26, hum_min: 40, hum_max: 60 }

  it('obtener devuelve null sin límites y valida la forma', async () => {
    const { cliente, rpc } = rpcCon({ data: null, error: null })
    expect(await crearServicioLimites(cliente).obtener('cuna-ambiente-01')).toEqual({ ok: true, datos: null })
    expect(rpc).toHaveBeenCalledWith('mis_limites', { p_device_id: 'cuna-ambiente-01' })
    const con = rpcCon({ data: LIM, error: null })
    expect(await crearServicioLimites(con.cliente).obtener('d')).toEqual({ ok: true, datos: LIM })
    const mal = rpcCon({ data: { temp_min: '20' }, error: null })
    expect(await crearServicioLimites(mal.cliente).obtener('d')).toEqual({ ok: false, error: MENSAJE_CUENTAS })
  })

  it('guardar usa los parámetros del RPC y traduce el rechazo', async () => {
    const { cliente, rpc } = rpcCon({ data: LIM, error: null })
    expect(await crearServicioLimites(cliente).guardar('cuna-ambiente-01', LIM)).toEqual({ ok: true, datos: LIM })
    expect(rpc).toHaveBeenCalledWith('guardar_limites', {
      p_device_id: 'cuna-ambiente-01',
      p_temp_min: 20,
      p_temp_max: 26,
      p_hum_min: 40,
      p_hum_max: 60,
    })
    const rechazo = rpcCon({ data: null, error: { message: 'limites_invalidos' } })
    const r = await crearServicioLimites(rechazo.cliente).guardar('d', LIM)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/el mínimo debe ser menor que el máximo/)
  })
})

describe('crearServicioHorarios', () => {
  it('listar y reemplazar usan hora HH:MM y validan la respuesta', async () => {
    const { cliente, rpc } = rpcCon((nombre) => ({
      data: nombre === 'mis_horarios' ? ['06:30', '20:00'] : ['20:00'],
      error: null,
    }))
    const servicio = crearServicioHorarios(cliente)
    expect(await servicio.listar('cuna-figuras-01', 'figuras_encender')).toEqual({ ok: true, datos: ['06:30', '20:00'] })
    expect(rpc).toHaveBeenCalledWith('mis_horarios', { p_device_id: 'cuna-figuras-01', p_tipo: 'figuras_encender' })
    expect(await servicio.reemplazar('cuna-figuras-01', 'figuras_encender', ['20:00'])).toEqual({ ok: true, datos: ['20:00'] })
    expect(rpc).toHaveBeenLastCalledWith('reemplazar_horarios', {
      p_device_id: 'cuna-figuras-01',
      p_tipo: 'figuras_encender',
      p_horas: ['20:00'],
    })
    const antes = rpc.mock.calls.length
    const mala = await servicio.reemplazar('d', 't', ['25:00'])
    expect(mala.ok).toBe(false)
    expect(rpc.mock.calls.length).toBe(antes)
    const rara = rpcCon({ data: ['mañana'], error: null })
    expect(await crearServicioHorarios(rara.cliente).listar('d', 't')).toEqual({ ok: false, error: MENSAJE_CUENTAS })
  })
})

describe('crearServicioVoz', () => {
  function canalFalso(estadoFinal: string) {
    const enviados: Array<{ event: string; payload: unknown }> = []
    const canal = {
      subscribe: vi.fn((alEstado: (e: string) => void) => {
        queueMicrotask(() => alEstado(estadoFinal))
        return canal
      }),
      send: vi.fn(async (m: { event: string; payload: unknown }) => {
        enviados.push({ event: m.event, payload: m.payload })
        return 'ok'
      }),
    }
    const cliente = {
      rpc: vi.fn(async () => ({ data: { resultado: 'creado' }, error: null })),
      channel: vi.fn(() => canal),
      removeChannel: vi.fn(async () => 'ok'),
    }
    return { canal, cliente: cliente as unknown as ClienteVoz, enviados, removeChannel: cliente.removeChannel, channel: cliente.channel }
  }

  it('abre un canal privado del producto, envía fragmentos y cierra con voz_fin', async () => {
    const f = canalFalso('SUBSCRIBED')
    const r = await crearServicioVoz(f.cliente).abrir('cuna-01')
    expect(r.ok).toBe(true)
    expect(f.channel).toHaveBeenCalledWith('voz:cuna-01', {
      config: { private: true, broadcast: { self: false, ack: false } },
    })
    if (!r.ok) return
    expect(await r.datos.enviar(0, 'AAAA')).toBe(true)
    await r.datos.cerrar()
    await r.datos.cerrar()
    expect(f.enviados).toEqual([
      { event: 'voz', payload: { seq: 0, pcm: 'AAAA' } },
      { event: 'voz_fin', payload: {} },
    ])
    expect(f.removeChannel).toHaveBeenCalledTimes(1)
    expect(await r.datos.enviar(1, 'AAAA')).toBe(false)
  })

  it('un canal que no se suscribe falla y se libera', async () => {
    for (const estado of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
      const f = canalFalso(estado)
      const r = await crearServicioVoz(f.cliente).abrir('cuna-01')
      expect(r).toEqual({ ok: false, error: 'No se pudo abrir el canal de voz.' })
      expect(f.removeChannel).toHaveBeenCalled()
    }
  })

  it('un identificador de producto inválido no abre ningún canal', async () => {
    const f = canalFalso('SUBSCRIBED')
    for (const malo of ['', 'Cuna 01', '../x', 'a:b']) {
      expect((await crearServicioVoz(f.cliente).abrir(malo)).ok).toBe(false)
    }
    expect(f.channel).not.toHaveBeenCalled()
  })

  it('registrarActividad usa el RPC con un id nuevo', async () => {
    const f = canalFalso('SUBSCRIBED')
    expect(await crearServicioVoz(f.cliente).registrarActividad('cuna-audio-01', 'inicio')).toEqual({ ok: true, datos: null })
    const llamada = (f.cliente.rpc as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(llamada[0]).toBe('registrar_actividad_voz')
    expect(llamada[1]).toMatchObject({ p_device_id: 'cuna-audio-01', p_fase: 'inicio' })
  })
})

describe('configuración de la fase 5', () => {
  it('los controles que operan hardware están apagados por defecto y solo "true" los activa', () => {
    expect(ordenesHabilitadas()).toBe(false)
    expect(vozHabilitada()).toBe(false)
    for (const valor of ['', 'TRUE', '1', 'yes', ' false ']) {
      vi.stubEnv('VITE_ORDENES_HABILITADAS', valor)
      vi.stubEnv('VITE_VOZ_HABILITADA', valor)
      expect(ordenesHabilitadas()).toBe(false)
      expect(vozHabilitada()).toBe(false)
    }
    vi.stubEnv('VITE_ORDENES_HABILITADAS', ' true ')
    vi.stubEnv('VITE_VOZ_HABILITADA', 'true')
    expect(ordenesHabilitadas()).toBe(true)
    expect(vozHabilitada()).toBe(true)
  })

  it('los identificadores toman el valor por defecto si no son válidos', () => {
    expect([dispositivoFigurasId(), dispositivoAudioId(), productoCunaId()]).toEqual([
      'cuna-figuras-01',
      'cuna-audio-01',
      'cuna-01',
    ])
    vi.stubEnv('VITE_FIGURAS_DEVICE_ID', 'cuna-figuras-02')
    vi.stubEnv('VITE_AUDIO_DEVICE_ID', 'Con Espacios')
    vi.stubEnv('VITE_CUNA_PRODUCTO_ID', '../x')
    expect([dispositivoFigurasId(), dispositivoAudioId(), productoCunaId()]).toEqual([
      'cuna-figuras-02',
      'cuna-audio-01',
      'cuna-01',
    ])
  })
})
