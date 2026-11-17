import { describe, expect, it } from 'vitest'
import {
  COLUMNAS_LECTURA_AMBIENTE,
  crearServicioLecturas,
  MENSAJE_LECTURA,
  type ClienteLecturas,
} from '../src/services/lecturas.ts'
import { MENSAJE_NO_CONFIGURADO } from '../src/services/noConfigurado.ts'

type Llamada = [string, ...unknown[]]

// Cadena de consulta falsa que registra cada paso y responde al final.
function clienteFalso(respuesta: () => Promise<unknown>) {
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
  } as unknown as ClienteLecturas
  return { cliente, llamadas }
}

const FILA = {
  event_id: '9f1c2e3a-4b5d-4a6e-8f7a-1b2c3d4e5f60',
  device_id: 'cuna-ambiente-01',
  ts: '2026-11-11T16:04:10Z',
  recibido_en: '2026-11-11T16:04:11Z',
  temperatura_c: 24.3,
  humedad_pct: 0,
}

describe('crearServicioLecturas.obtenerUltimaAmbiental', () => {
  it('consulta la tabla con columnas, filtro, orden, límite y maybeSingle', async () => {
    const { cliente, llamadas } = clienteFalso(async () => ({ data: null, error: null }))
    await crearServicioLecturas(cliente).obtenerUltimaAmbiental('cuna-ambiente-01')
    expect(llamadas).toEqual([
      ['from', 'lecturas_ambiente'],
      ['select', COLUMNAS_LECTURA_AMBIENTE],
      ['eq', 'device_id', 'cuna-ambiente-01'],
      ['order', 'ts', { ascending: false }],
      ['order', 'recibido_en', { ascending: false }],
      ['order', 'event_id', { ascending: false }],
      ['limit', 1],
      ['maybeSingle'],
    ])
    expect(COLUMNAS_LECTURA_AMBIENTE).toBe(
      'event_id,device_id,ts,recibido_en,temperatura_c,humedad_pct',
    )
  })

  it('sin fila responde éxito con null', async () => {
    const { cliente } = clienteFalso(async () => ({ data: null, error: null }))
    expect(await crearServicioLecturas(cliente).obtenerUltimaAmbiental('d')).toEqual({
      ok: true,
      datos: null,
    })
  })

  it('mapea event_id, device_id y ts y conserva el cero', async () => {
    const { cliente } = clienteFalso(async () => ({ data: FILA, error: null }))
    expect(await crearServicioLecturas(cliente).obtenerUltimaAmbiental('d')).toEqual({
      ok: true,
      datos: {
        id: FILA.event_id,
        dispositivo_id: 'cuna-ambiente-01',
        temperatura_c: 24.3,
        humedad_pct: 0,
        registrado_en: '2026-11-11T16:04:10Z',
      },
    })
  })

  it('un error, una excepción o una fila malformada devuelven un mensaje genérico', async () => {
    const respuestas: Array<() => Promise<unknown>> = [
      async () => ({ data: null, error: { message: 'detalle interno' } }),
      async () => {
        throw new Error('red caída')
      },
      async () => ({ data: { ...FILA, temperatura_c: '24.3' }, error: null }),
      async () => ({ data: { ...FILA, humedad_pct: Number.NaN }, error: null }),
    ]
    for (const respuesta of respuestas) {
      const { cliente } = clienteFalso(respuesta)
      expect(await crearServicioLecturas(cliente).obtenerUltimaAmbiental('d')).toEqual({
        ok: false,
        error: MENSAJE_LECTURA,
      })
    }
  })

  it('el resto de métodos siguen sin configurar', async () => {
    const { cliente } = clienteFalso(async () => ({ data: null, error: null }))
    const r = await crearServicioLecturas(cliente).obtenerUltimoPeso('d')
    expect(r).toEqual({ ok: false, error: MENSAJE_NO_CONFIGURADO })
  })
})
