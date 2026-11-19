import { describe, expect, it, vi } from 'vitest'
import { aRegistro, aRespuesta, crearServicioHistorial, type ClienteHistorial } from '../src/services/historial.ts'

const REGISTRO = {
  registro_id: 'r-1',
  ts: '2026-11-18T14:15:00Z',
  tipo: 'puerta',
  bebe_id: 'b-1',
  device_id: 'cuna-habitacion-01',
  descripcion: 'Se abrió la puerta',
  valor: null,
  unidad: null,
  toma: null,
  foto: null,
}
const RESPUESTA = {
  ahora: '2026-11-18T15:00:00Z',
  desde: '2026-11-18T00:00:00Z',
  hasta: '2026-11-19T00:00:00Z',
  truncado: false,
  registros: [REGISTRO],
}

function cliente(respuesta: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn(async () => ({ data: respuesta.data ?? null, error: respuesta.error ?? null }))
  return { rpc, cliente: { rpc } as unknown as ClienteHistorial }
}

describe('Servicio de historial', () => {
  it('llama a historial_bebe con el intervalo en ISO UTC', async () => {
    const { rpc, cliente: c } = cliente({ data: RESPUESTA })
    const r = await crearServicioHistorial(c).consultar('b-1', Date.parse('2026-11-18T00:00:00Z'), Date.parse('2026-11-19T00:00:00Z'))
    expect(rpc).toHaveBeenCalledWith('historial_bebe', {
      p_bebe_id: 'b-1',
      p_desde: '2026-11-18T00:00:00.000Z',
      p_hasta: '2026-11-19T00:00:00.000Z',
    })
    expect(r).toEqual({ ok: true, datos: RESPUESTA })
  })

  it('un intervalo sin registros es una respuesta válida con lista vacía', async () => {
    const { cliente: c } = cliente({ data: { ...RESPUESTA, registros: [] } })
    const r = await crearServicioHistorial(c).consultar('b-1', 0, 1)
    expect(r.ok && r.datos.registros).toEqual([])
  })

  it('traduce no_autorizado e intervalo_invalido a mensajes fijos', async () => {
    const a = await crearServicioHistorial(cliente({ error: { message: 'no_autorizado' } }).cliente).consultar('b', 0, 1)
    expect(a).toEqual({ ok: false, error: 'No tienes permiso para esta operación.' })
    const b = await crearServicioHistorial(cliente({ error: { message: 'intervalo_invalido' } }).cliente).consultar('b', 0, 1)
    expect(b.ok).toBe(false)
    expect(!b.ok && b.error).toMatch(/intervalo no es válido/)
  })

  it('nunca muestra el texto de error del servidor', async () => {
    const r = await crearServicioHistorial(
      cliente({ error: { message: 'relation "eventos" does not exist', code: '42P01' } }).cliente,
    ).consultar('b', 0, 1)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).not.toContain('relation')
  })

  it('si la llamada lanza una excepción devuelve un mensaje fijo', async () => {
    const c = { rpc: vi.fn(async () => { throw new Error('red caída: secreto') }) } as unknown as ClienteHistorial
    const r = await crearServicioHistorial(c).consultar('b', 0, 1)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).not.toContain('secreto')
  })

  it('una respuesta con un solo registro mal formado se descarta completa', async () => {
    const { cliente: c } = cliente({ data: { ...RESPUESTA, registros: [REGISTRO, { ...REGISTRO, ts: 'ayer' }] } })
    const r = await crearServicioHistorial(c).consultar('b-1', 0, 1)
    expect(r).toEqual({ ok: false, error: 'No se pudo consultar el historial.' })
  })

  it('rechaza formas inesperadas', () => {
    expect(aRespuesta(null)).toBeNull()
    expect(aRespuesta({ ...RESPUESTA, truncado: 'no' })).toBeNull()
    expect(aRespuesta({ ...RESPUESTA, registros: 'x' })).toBeNull()
    expect(aRegistro({ ...REGISTRO, valor: '5' })).toBeNull()
    expect(aRegistro({ ...REGISTRO, foto: { estado: 'rara', ruta: null, motivo: null } })).toBeNull()
    expect(aRegistro({ ...REGISTRO, toma: { peso_inicial_g: 1 } })).toBeNull()
  })

  it('acepta una toma y una foto bien formadas', () => {
    const r = aRegistro({
      ...REGISTRO,
      toma: { peso_inicial_g: 250, peso_final_g: 190, cantidad_g: 60, duracion_s: 900 },
      foto: { estado: 'guardada', ruta: 'cuna-habitacion-01/x.jpg', motivo: null },
    })
    expect(r?.toma?.cantidad_g).toBe(60)
    expect(r?.foto?.estado).toBe('guardada')
  })
})
