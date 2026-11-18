import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComandoModulo } from '../src/models/ordenes.ts'
import { dispositivoColchonId } from '../src/services/configuracion.ts'
import { MENSAJE_CUENTAS } from '../src/services/cuentas.ts'
import {
  crearServicioColchon,
  MENSAJE_EVENTOS_COLCHON,
  type ClienteColchon,
} from '../src/services/colchon.ts'
import {
  leerEstadoColchon,
  validarConfigColchon,
} from '../src/utils/colchon.ts'
import { comandoValido } from '../src/utils/ordenes.ts'

afterEach(() => vi.unstubAllEnvs())

function conRpc(respuesta: { data: unknown; error: unknown } | Error) {
  const rpc = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta
    return respuesta
  })
  return { cliente: { rpc, from: vi.fn() } as unknown as ClienteColchon, rpc }
}

describe('crearServicioColchon', () => {
  const CONFIG = { duracion_s: 300, tolerancia_pct: 10, alarma_s: 60 }

  it('obtenerConfig: null sin configuración y valida la forma', async () => {
    const { cliente, rpc } = conRpc({ data: null, error: null })
    expect(await crearServicioColchon(cliente).obtenerConfig('cuna-colchon-01')).toEqual({ ok: true, datos: null })
    expect(rpc).toHaveBeenCalledWith('mi_config_colchon', { p_device_id: 'cuna-colchon-01' })
    expect(await crearServicioColchon(conRpc({ data: CONFIG, error: null }).cliente).obtenerConfig('d')).toEqual({
      ok: true,
      datos: CONFIG,
    })
    expect(
      await crearServicioColchon(conRpc({ data: { duracion_s: '300' }, error: null }).cliente).obtenerConfig('d'),
    ).toEqual({ ok: false, error: MENSAJE_CUENTAS })
  })

  it('guardarConfig usa los parámetros del RPC y traduce el rechazo', async () => {
    const { cliente, rpc } = conRpc({ data: CONFIG, error: null })
    expect(await crearServicioColchon(cliente).guardarConfig('cuna-colchon-01', CONFIG)).toEqual({
      ok: true,
      datos: CONFIG,
    })
    expect(rpc).toHaveBeenCalledWith('guardar_config_colchon', {
      p_device_id: 'cuna-colchon-01',
      p_duracion_s: 300,
      p_tolerancia_pct: 10,
      p_alarma_s: 60,
    })
    const r = await crearServicioColchon(
      conRpc({ data: null, error: { message: 'config_colchon_invalida' } }).cliente,
    ).guardarConfig('d', CONFIG)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/revisa la duración, la tolerancia y la alarma/)
    const otro = await crearServicioColchon(
      conRpc({ data: null, error: { message: 'detalle interno del servidor' } }).cliente,
    ).guardarConfig('d', CONFIG)
    expect(otro).toEqual({ ok: false, error: MENSAJE_CUENTAS })
  })

  it('listarEventos consulta solo los tipos del colchón y valida cada fila', async () => {
    const fila = {
      event_id: 'e1',
      tipo: 'alarma_colchon',
      descripcion: 'Alarma del colchón',
      ts: '2026-11-18T14:15:00Z',
    }
    const consulta = {
      select: vi.fn(() => consulta),
      eq: vi.fn(() => consulta),
      in: vi.fn(() => consulta),
      order: vi.fn(() => consulta),
      limit: vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({ data: [fila], error: null })),
    }
    const servicio = crearServicioColchon({ from: vi.fn(() => consulta), rpc: vi.fn() } as unknown as ClienteColchon)
    expect(await servicio.listarEventos('cuna-colchon-01', 10)).toEqual({ ok: true, datos: [fila] })
    expect(consulta.eq).toHaveBeenCalledWith('device_id', 'cuna-colchon-01')
    expect(consulta.in).toHaveBeenCalledWith('tipo', ['colchon_armado', 'alarma_colchon', 'colchon_detenido'])
    expect(consulta.limit).toHaveBeenCalledWith(10)

    for (const data of [[{ ...fila, tipo: 'movimiento' }], [{ ...fila, ts: 5 }], 'x', [null]]) {
      consulta.limit.mockResolvedValueOnce({ data, error: null })
      expect(await servicio.listarEventos('d', 10)).toEqual({ ok: false, error: MENSAJE_EVENTOS_COLCHON })
    }
    consulta.limit.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    expect(await servicio.listarEventos('d', 10)).toEqual({ ok: false, error: MENSAJE_EVENTOS_COLCHON })
    consulta.limit.mockRejectedValueOnce(new Error('red'))
    expect(await servicio.listarEventos('d', 10)).toEqual({ ok: false, error: MENSAJE_EVENTOS_COLCHON })
  })
})

describe('validarConfigColchon', () => {
  it('acepta valores válidos con coma o punto', () => {
    expect(validarConfigColchon({ duracion_s: '1', tolerancia_pct: '0,5', alarma_s: '60' })).toEqual({
      ok: true,
      config: { duracion_s: 1, tolerancia_pct: 0.5, alarma_s: 60 },
    })
    expect(validarConfigColchon({ duracion_s: ' 86400 ', tolerancia_pct: '99.99', alarma_s: '1' }).ok).toBe(true)
  })

  it('rechaza duración, tolerancia y alarma fuera de rango', () => {
    const buenos = { duracion_s: '300', tolerancia_pct: '10', alarma_s: '60' }
    for (const cambio of [
      { duracion_s: '0' }, { duracion_s: '86401' }, { duracion_s: '1.5' }, { duracion_s: '-3' }, { duracion_s: '' },
      { tolerancia_pct: '0' }, { tolerancia_pct: '100' }, { tolerancia_pct: '-1' }, { tolerancia_pct: 'x' },
      { alarma_s: '0' }, { alarma_s: '61' }, { alarma_s: '2.5' }, { alarma_s: '' },
    ]) {
      expect(validarConfigColchon({ ...buenos, ...cambio }).ok, JSON.stringify(cambio)).toBe(false)
    }
  })
})

describe('leerEstadoColchon', () => {
  const desde = '2026-11-18T14:15:00Z'
  it('sin estado o sin hora no hay estado', () => {
    expect(leerEstadoColchon(null)).toBeNull()
    expect(leerEstadoColchon({ estado: {}, actualizado_en: null })).toBeNull()
    expect(leerEstadoColchon({ estado: { colchon: 'activo' }, actualizado_en: null })).toBeNull()
  })
  it('un valor desconocido no se interpreta', () => {
    expect(leerEstadoColchon({ estado: { colchon: 'dormido' }, actualizado_en: desde })).toBeNull()
    expect(leerEstadoColchon({ estado: { colchon: 5 }, actualizado_en: desde })).toBeNull()
  })
  it('lee los tres estados y descarta lo que no corresponde', () => {
    expect(leerEstadoColchon({ estado: { colchon: 'activo', referencia_g: 1000, motivo: 'app' }, actualizado_en: desde })).toEqual({
      situacion: 'activo', referencia_g: 1000, motivo: null, desde,
    })
    expect(leerEstadoColchon({ estado: { colchon: 'alarma', referencia_g: -3 }, actualizado_en: desde })).toEqual({
      situacion: 'alarma', referencia_g: null, motivo: null, desde,
    })
    expect(leerEstadoColchon({ estado: { colchon: 'detenido', referencia_g: 1000, motivo: 'wifi' }, actualizado_en: desde })).toEqual({
      situacion: 'detenido', referencia_g: null, motivo: 'wifi', desde,
    })
    expect(leerEstadoColchon({ estado: { colchon: 'detenido', motivo: 'otro' }, actualizado_en: desde })?.motivo).toBeNull()
  })
})

describe('comandos del colchón (mismos rangos que comandos.py y la base)', () => {
  it('acepta armar y rearmar con parámetros opcionales válidos, y detener', () => {
    const buenos: ComandoModulo[] = [
      { command: 'mattress_arm', params: {} },
      { command: 'mattress_arm', params: { duration_s: 86400, tolerance_pct: 99.9, alarm_s: 60 } },
      { command: 'mattress_rearm', params: { duration_s: 1 } },
      { command: 'mattress_stop', params: {} },
    ]
    for (const c of buenos) expect(comandoValido(c), JSON.stringify(c)).toBe(true)
  })

  it('rechaza duración, tolerancia, alarma y claves fuera de contrato', () => {
    const malos = [
      { command: 'mattress_arm', params: { duration_s: 0 } },
      { command: 'mattress_arm', params: { duration_s: 86401 } },
      { command: 'mattress_arm', params: { tolerance_pct: 0 } },
      { command: 'mattress_arm', params: { tolerance_pct: 100 } },
      { command: 'mattress_arm', params: { alarm_s: 0 } },
      { command: 'mattress_arm', params: { alarm_s: 61 } },
      { command: 'mattress_arm', params: { alarm_s: '30' } },
      { command: 'mattress_arm', params: { peso_g: 500 } },
      { command: 'mattress_rearm', params: { duration_s: Number.NaN } },
      { command: 'mattress_stop', params: { duration_s: 5 } },
    ]
    for (const c of malos) expect(comandoValido(c as unknown as ComandoModulo), JSON.stringify(c)).toBe(false)
  })
})

describe('configuración del colchón', () => {
  it('usa cuna-colchon-01 por defecto y un identificador válido si se configura', () => {
    expect(dispositivoColchonId()).toBe('cuna-colchon-01')
    vi.stubEnv('VITE_COLCHON_DEVICE_ID', 'cuna-colchon-02')
    expect(dispositivoColchonId()).toBe('cuna-colchon-02')
    vi.stubEnv('VITE_COLCHON_DEVICE_ID', 'Con Espacios')
    expect(dispositivoColchonId()).toBe('cuna-colchon-01')
  })
})
