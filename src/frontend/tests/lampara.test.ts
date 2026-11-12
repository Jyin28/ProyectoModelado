import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COLUMNAS_ORDEN_LAMPARA,
  crearServicioLampara,
  MENSAJE_CONSULTA_LAMPARA,
  MENSAJE_SOLICITUD_LAMPARA,
  type ClienteLampara,
} from '../src/services/lampara.ts'
import { estadoVisible, parsearNivel } from '../src/utils/lampara.ts'
import type { OrdenLampara } from '../src/models/lampara.ts'

type Llamada = [string, ...unknown[]]

const UUID = '3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f'

function fila(extra: Record<string, unknown> = {}) {
  return {
    command_id: UUID,
    device_id: 'cuna-lampara-01',
    nivel: 40,
    creado_en: '2026-11-11T16:04:10.123Z',
    vence_en: '2026-11-11T16:04:25.123Z',
    estado: 'pendiente',
    entregado_en: null,
    confirmado_en: null,
    nivel_confirmado: null,
    error: null,
    ...extra,
  }
}

function clienteFalso(
  respuesta: () => Promise<unknown>,
  rpc: (...args: unknown[]) => Promise<unknown> = async () => ({ data: null, error: null }),
) {
  const llamadas: Llamada[] = []
  const cadena: Record<string, unknown> = {}
  for (const nombre of ['select', 'eq', 'order', 'limit']) {
    cadena[nombre] = (...args: unknown[]) => {
      llamadas.push([nombre, ...args])
      return cadena
    }
  }
  cadena.maybeSingle = () => {
    llamadas.push(['maybeSingle'])
    return respuesta()
  }
  const cliente = {
    from: (tabla: string) => {
      llamadas.push(['from', tabla])
      return cadena
    },
    rpc: (...args: unknown[]) => {
      llamadas.push(['rpc', ...args])
      return {
        single: () => {
          llamadas.push(['single'])
          return rpc(...args)
        },
      }
    },
  } as unknown as ClienteLampara
  return { cliente, llamadas }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('crearServicioLampara.solicitarLampara', () => {
  it('llama al RPC con UUID de crypto.randomUUID y p_command_id, p_device_id, p_level', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID)
    const { cliente, llamadas } = clienteFalso(
      async () => ({ data: null, error: null }),
      async () => ({ data: fila(), error: null }),
    )
    const r = await crearServicioLampara(cliente).solicitarLampara('cuna-lampara-01', 40)
    expect(llamadas).toEqual([
      [
        'rpc',
        'solicitar_lampara',
        { p_command_id: UUID, p_device_id: 'cuna-lampara-01', p_level: 40 },
      ],
      ['single'],
    ])
    expect(r).toEqual({ ok: true, datos: fila() })
  })

  it('acepta los extremos 0 y 100 y genera un UUID nuevo en cada solicitud', async () => {
    const ids: string[] = []
    const { cliente } = clienteFalso(
      async () => ({ data: null, error: null }),
      async (...args: unknown[]) => {
        const p = args[1] as { p_command_id: string; p_level: number }
        ids.push(p.p_command_id)
        return { data: fila({ command_id: p.p_command_id, nivel: p.p_level }), error: null }
      },
    )
    const servicio = crearServicioLampara(cliente)
    expect((await servicio.solicitarLampara('cuna-lampara-01', 0)).ok).toBe(true)
    expect((await servicio.solicitarLampara('cuna-lampara-01', 100)).ok).toBe(true)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('un nivel inválido no llega al RPC', async () => {
    const { cliente, llamadas } = clienteFalso(async () => ({ data: null, error: null }))
    const servicio = crearServicioLampara(cliente)
    for (const n of [-1, 101, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await servicio.solicitarLampara('cuna-lampara-01', n)).toEqual({
        ok: false,
        error: MENSAJE_SOLICITUD_LAMPARA,
      })
    }
    expect(llamadas).toEqual([])
  })

  it('error del servidor, excepción o respuesta que no coincide dan mensaje genérico', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(UUID)
    const respuestas: Array<() => Promise<unknown>> = [
      async () => ({ data: null, error: { code: '42501', message: 'no_autorizado' } }),
      // Errores propios de single(): sin filas o más de una (PGRST116).
      async () => ({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      }),
      // Un arreglo (sin single efectivo) no se acepta como orden.
      async () => ({ data: [fila()], error: null }),
      async () => {
        throw new Error('red caída')
      },
      async () => ({ data: fila({ command_id: 'otro' }), error: null }),
      async () => ({ data: fila({ nivel: 41 }), error: null }),
      async () => ({ data: fila({ estado: 'raro' }), error: null }),
      async () => ({ data: null, error: null }),
    ]
    for (const respuesta of respuestas) {
      const { cliente } = clienteFalso(async () => ({ data: null, error: null }), respuesta)
      const r = await crearServicioLampara(cliente).solicitarLampara('cuna-lampara-01', 40)
      expect(r).toEqual({ ok: false, error: MENSAJE_SOLICITUD_LAMPARA })
    }
  })
})

describe('crearServicioLampara.obtenerUltimaOrdenLampara', () => {
  it('consulta con columnas, device_id, orden creado_en y command_id, limit y maybeSingle', async () => {
    const { cliente, llamadas } = clienteFalso(async () => ({ data: null, error: null }))
    await crearServicioLampara(cliente).obtenerUltimaOrdenLampara('cuna-lampara-01')
    expect(llamadas).toEqual([
      ['from', 'ordenes_lampara'],
      ['select', COLUMNAS_ORDEN_LAMPARA],
      ['eq', 'device_id', 'cuna-lampara-01'],
      ['order', 'creado_en', { ascending: false }],
      ['order', 'command_id', { ascending: false }],
      ['limit', 1],
      ['maybeSingle'],
    ])
    expect(COLUMNAS_ORDEN_LAMPARA).not.toContain('solicitante_id')
  })

  it('sin fila responde éxito con null', async () => {
    const { cliente } = clienteFalso(async () => ({ data: null, error: null }))
    expect(await crearServicioLampara(cliente).obtenerUltimaOrdenLampara('d')).toEqual({
      ok: true,
      datos: null,
    })
  })

  it('separa nivel pedido y nivel confirmado, y conserva el cero', async () => {
    const confirmada = fila({
      estado: 'confirmado',
      nivel: 0,
      nivel_confirmado: 0,
      entregado_en: '2026-11-11T16:04:11Z',
      confirmado_en: '2026-11-11T16:04:12Z',
    })
    const { cliente } = clienteFalso(async () => ({ data: confirmada, error: null }))
    expect(await crearServicioLampara(cliente).obtenerUltimaOrdenLampara('d')).toEqual({
      ok: true,
      datos: confirmada,
    })
  })

  it('error, excepción o fila malformada dan mensaje genérico', async () => {
    const respuestas: Array<() => Promise<unknown>> = [
      async () => ({ data: null, error: { message: 'detalle interno' } }),
      async () => {
        throw new Error('red caída')
      },
      async () => ({ data: fila({ nivel: '40' }), error: null }),
      async () => ({ data: fila({ nivel: 101 }), error: null }),
      async () => ({ data: fila({ nivel_confirmado: 1.5 }), error: null }),
      async () => ({ data: fila({ estado: 'otro' }), error: null }),
    ]
    for (const respuesta of respuestas) {
      const { cliente } = clienteFalso(respuesta)
      expect(await crearServicioLampara(cliente).obtenerUltimaOrdenLampara('d')).toEqual({
        ok: false,
        error: MENSAJE_CONSULTA_LAMPARA,
      })
    }
  })
})

describe('utils de lámpara', () => {
  it('parsearNivel acepta solo enteros de 0 a 100', () => {
    expect(parsearNivel('0')).toBe(0)
    expect(parsearNivel(' 100 ')).toBe(100)
    for (const t of ['', '101', '-1', '4.5', '1e1', 'abc', '0040x']) {
      expect(parsearNivel(t)).toBeNull()
    }
  })

  it('estadoVisible: vencida sin confirmación es sin-respuesta; las terminales no cambian', () => {
    const orden = (extra: Partial<OrdenLampara>) => ({ ...fila(), ...extra }) as OrdenLampara
    const antes = new Date('2026-11-11T16:04:20Z')
    const despues = new Date('2026-11-11T16:04:26Z')
    expect(estadoVisible(orden({}), antes)).toBe('pendiente')
    expect(estadoVisible(orden({ estado: 'enviado' }), antes)).toBe('enviada')
    expect(estadoVisible(orden({}), despues)).toBe('sin-respuesta')
    expect(estadoVisible(orden({ estado: 'enviado' }), despues)).toBe('sin-respuesta')
    expect(estadoVisible(orden({ estado: 'confirmado' }), despues)).toBe('confirmado')
    expect(estadoVisible(orden({ estado: 'error' }), despues)).toBe('error')
  })
})
