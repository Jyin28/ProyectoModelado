import { describe, expect, it, vi } from 'vitest'
import {
  aEventoColchonPico,
  crearServicioColchonPico,
  type ClienteColchonPico,
} from '../src/services/colchonPico.ts'

describe('servicio colchon', () => {
  it('aEventoColchonPico valida campos y tipos correctamente', () => {
    const rawValido = {
      event_id: '3da852ab-8c1a-4e64-baba-65a248d3abd1',
      device_id: 'pico-figuras-colchon-01',
      bebe_id: 'a2d531d5-2349-439c-a087-4e538be5579c',
      ts: '2026-11-18T16:31:20Z',
      recibido_en: '2026-11-18T16:31:20.958Z',
      tipo: 'alarm_started',
      datos: '{"weight_g": -0.04, "reference_g": 200, "threshold_g": 180}',
    }

    const resultado = aEventoColchonPico(rawValido)
    expect(resultado).not.toBeNull()
    expect(resultado?.tipo).toBe('alarm_started')
    expect(resultado?.datos).toEqual({
      weight_g: -0.04,
      reference_g: 200,
      threshold_g: 180,
    })

    // Caso con datos ya como objeto
    const rawObjeto = {
      ...rawValido,
      datos: { weight_g: -0.04 },
    }
    expect(aEventoColchonPico(rawObjeto)?.datos).toEqual({ weight_g: -0.04 })

    // Tipo inválido
    expect(aEventoColchonPico({ ...rawValido, tipo: 'invalido' })).toBeNull()

    // Falta event_id
    expect(aEventoColchonPico({ ...rawValido, event_id: undefined })).toBeNull()
  })

  it('obtenerUltimoEvento consulta Supabase con ordenamiento descendente', async () => {
    const fila = {
      event_id: '1e67c8bf-11e2-4928-970f-2c9952559ac1',
      device_id: 'pico-figuras-colchon-01',
      bebe_id: 'b-1',
      ts: '2026-11-18T16:31:02Z',
      recibido_en: '2026-11-18T16:31:03Z',
      tipo: 'monitoring_started',
      datos: { duration_s: 120, reference_g: 200, tolerance_pct: 10 },
    }

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockReturnThis()
    const mockLimit = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: fila, error: null })

    const cliente: ClienteColchonPico = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit,
        maybeSingle: mockMaybeSingle,
      }),
    }

    const servicio = crearServicioColchonPico(cliente)
    const resultado = await servicio.obtenerUltimoEvento('pico-figuras-colchon-01')

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.datos?.tipo).toBe('monitoring_started')
      expect(resultado.datos?.event_id).toBe('1e67c8bf-11e2-4928-970f-2c9952559ac1')
    }
  })

  it('obtenerHistorialEventos retorna lista de eventos parseados', async () => {
    const filas = [
      {
        event_id: 'ev-1',
        device_id: 'pico-figuras-colchon-01',
        bebe_id: 'b-1',
        ts: '2026-11-18T16:31:02Z',
        recibido_en: '2026-11-18T16:31:03Z',
        tipo: 'monitoring_started',
        datos: { duration_s: 120 },
      },
      {
        event_id: 'ev-2',
        device_id: 'pico-figuras-colchon-01',
        bebe_id: 'b-1',
        ts: '2026-11-18T16:31:20Z',
        recibido_en: '2026-11-18T16:31:21Z',
        tipo: 'alarm_started',
        datos: { weight_g: -0.04 },
      },
    ]

    const cliente: ClienteColchonPico = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: filas, error: null }),
      }),
    }

    const servicio = crearServicioColchonPico(cliente)
    const resultado = await servicio.obtenerHistorialEventos('pico-figuras-colchon-01', 5)

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.datos).toHaveLength(2)
      expect(resultado.datos[0].tipo).toBe('monitoring_started')
      expect(resultado.datos[1].tipo).toBe('alarm_started')
    }
  })
})
