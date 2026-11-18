import { afterEach, describe, expect, it, vi } from 'vitest'
import { FOTO_TAMANO_MAX_BYTES } from '../src/models/habitacion.ts'
import type { ComandoModulo } from '../src/models/ordenes.ts'
import {
  camaraHabilitada,
  dispositivoHabitacionId,
} from '../src/services/configuracion.ts'
import { MENSAJE_CUENTAS } from '../src/services/cuentas.ts'
import {
  crearServicioHabitacion,
  MENSAJE_ABRIR_FOTO,
  MENSAJE_EVENTOS_HABITACION,
  MENSAJE_FOTOS_HABITACION,
  MENSAJE_SUBIR_FOTO,
  type ClienteHabitacion,
} from '../src/services/habitacion.ts'
import {
  leerMonitoreoSensor,
  MENSAJE_FOTO_TAMANO,
  MENSAJE_FOTO_TIPO,
  MENSAJE_FOTO_VACIA,
  rutaFoto,
  textoFoto,
  validarArchivoFoto,
} from '../src/utils/habitacion.ts'
import { comandoValido } from '../src/utils/ordenes.ts'

afterEach(() => vi.unstubAllEnvs())

type Respuesta = { data: unknown; error: unknown }

function cliente(
  opciones: {
    rpc?: Respuesta | Error
    subida?: { error: unknown } | Error
    firma?: Respuesta | Error
  } = {},
) {
  const consulta = {
    select: vi.fn(() => consulta),
    eq: vi.fn(() => consulta),
    in: vi.fn(() => consulta),
    order: vi.fn(() => consulta),
    limit: vi.fn(async (): Promise<Respuesta> => ({ data: [], error: null })),
  }
  const rpc = vi.fn(async () => {
    const r = opciones.rpc ?? { data: {}, error: null }
    if (r instanceof Error) throw r
    return r
  })
  const upload = vi.fn(async () => {
    const r = opciones.subida ?? { error: null }
    if (r instanceof Error) throw r
    return r
  })
  const createSignedUrl = vi.fn(async () => {
    const r = opciones.firma ?? { data: { signedUrl: 'https://almacen.test/firmada' }, error: null }
    if (r instanceof Error) throw r
    return r
  })
  const bucket = { upload, createSignedUrl }
  const storage = { from: vi.fn(() => bucket) }
  const c = { from: vi.fn(() => consulta), rpc, storage } as unknown as ClienteHabitacion
  return { c, consulta, rpc, upload, createSignedUrl, storage }
}

const HAB = 'cuna-habitacion-01'
const EVENTO = '11111111-1111-4111-8111-111111111111'
const jpeg = (bytes = 10) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })

describe('crearServicioHabitacion: eventos y fotos', () => {
  const evento = {
    event_id: 'e1',
    tipo: 'puerta',
    descripcion: 'Se abrió la puerta de la habitación',
    ts: '2026-11-18T14:15:00Z',
  }

  it('listarEventos consulta solo los tipos de la habitación y valida cada fila', async () => {
    const { c, consulta } = cliente()
    consulta.limit.mockResolvedValueOnce({ data: [evento], error: null })
    const s = crearServicioHabitacion(c)
    expect(await s.listarEventos(HAB, 20)).toEqual({ ok: true, datos: [evento] })
    expect(consulta.eq).toHaveBeenCalledWith('device_id', HAB)
    expect(consulta.in).toHaveBeenCalledWith('tipo', ['puerta', 'movimiento_habitacion'])
    expect(consulta.limit).toHaveBeenCalledWith(20)

    for (const data of [[{ ...evento, tipo: 'movimiento' }], [{ ...evento, ts: 5 }], 'x', [null]]) {
      consulta.limit.mockResolvedValueOnce({ data, error: null })
      expect(await s.listarEventos(HAB, 20)).toEqual({ ok: false, error: MENSAJE_EVENTOS_HABITACION })
    }
    consulta.limit.mockResolvedValueOnce({ data: null, error: { message: 'detalle interno' } })
    expect(await s.listarEventos(HAB, 20)).toEqual({ ok: false, error: MENSAJE_EVENTOS_HABITACION })
    consulta.limit.mockRejectedValueOnce(new Error('red'))
    expect(await s.listarEventos(HAB, 20)).toEqual({ ok: false, error: MENSAJE_EVENTOS_HABITACION })
  })

  const foto = {
    event_id: 'e1',
    estado: 'guardada',
    ruta: `${HAB}/e1.jpg`,
    motivo: null,
    solicitada_en: '2026-11-18T14:15:01Z',
    resuelta_en: '2026-11-18T14:16:00Z',
  }

  it('listarFotos valida el estado, la ruta y el motivo', async () => {
    const { c, consulta } = cliente()
    consulta.limit.mockResolvedValueOnce({ data: [foto], error: null })
    const s = crearServicioHabitacion(c)
    expect(await s.listarFotos(HAB, 20)).toEqual({ ok: true, datos: [foto] })
    expect(consulta.eq).toHaveBeenCalledWith('device_id', HAB)

    const pendiente = { ...foto, estado: 'pendiente', ruta: null, resuelta_en: null }
    const fallida = { ...pendiente, estado: 'fallida', motivo: 'carga_fallida', resuelta_en: foto.resuelta_en }
    consulta.limit.mockResolvedValueOnce({ data: [pendiente, fallida], error: null })
    expect(await s.listarFotos(HAB, 20)).toEqual({ ok: true, datos: [pendiente, fallida] })

    for (const mala of [
      { ...foto, ruta: null },
      { ...pendiente, ruta: 'x.jpg' },
      { ...fallida, motivo: null },
      { ...foto, estado: 'borrada' },
      { ...fallida, motivo: 'inventado' },
      { ...foto, solicitada_en: 3 },
    ]) {
      consulta.limit.mockResolvedValueOnce({ data: [mala], error: null })
      expect(await s.listarFotos(HAB, 20), JSON.stringify(mala)).toEqual({
        ok: false,
        error: MENSAJE_FOTOS_HABITACION,
      })
    }
  })

  it('urlFoto pide un enlace de 60 s y no reenvía el error del servidor', async () => {
    const { c, createSignedUrl, storage } = cliente()
    expect(await crearServicioHabitacion(c).urlFoto(`${HAB}/e1.jpg`)).toEqual({
      ok: true,
      datos: 'https://almacen.test/firmada',
    })
    expect(storage.from).toHaveBeenCalledWith('fotos-habitacion')
    expect(createSignedUrl).toHaveBeenCalledWith(`${HAB}/e1.jpg`, 60)

    for (const firma of [
      { data: null, error: { message: 'Object not found: secreto' } },
      { data: {}, error: null },
      new Error('red'),
    ]) {
      expect(await crearServicioHabitacion(cliente({ firma }).c).urlFoto('x')).toEqual({
        ok: false,
        error: MENSAJE_ABRIR_FOTO,
      })
    }
  })
})

describe('crearServicioHabitacion: subir y registrar', () => {
  it('sube a <dispositivo>/<evento>.jpg sin sobrescribir y luego registra la foto', async () => {
    const { c, upload, rpc } = cliente()
    expect(await crearServicioHabitacion(c).subirFoto(HAB, EVENTO, jpeg())).toEqual({ ok: true, datos: null })
    expect(upload).toHaveBeenCalledWith(`${HAB}/${EVENTO}.jpg`, expect.any(Blob), {
      contentType: 'image/jpeg',
      upsert: false,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('registrar_foto', { p_event_id: EVENTO, p_ruta: `${HAB}/${EVENTO}.jpg` })
  })

  it('un PNG usa la extensión png', async () => {
    const { c, upload } = cliente()
    await crearServicioHabitacion(c).subirFoto(HAB, EVENTO, new Blob(['x'], { type: 'image/png' }))
    expect(upload.mock.calls[0]).toEqual([`${HAB}/${EVENTO}.png`, expect.any(Blob), expect.any(Object)])
  })

  it('un archivo inválido se rechaza sin tocar el almacén ni el servidor', async () => {
    const { c, upload, rpc } = cliente()
    const s = crearServicioHabitacion(c)
    expect(await s.subirFoto(HAB, EVENTO, new Blob(['x'], { type: 'video/mp4' }))).toEqual({
      ok: false,
      error: MENSAJE_FOTO_TIPO,
    })
    expect(await s.subirFoto(HAB, EVENTO, new Blob(['x'], { type: 'image/gif' }))).toEqual({
      ok: false,
      error: MENSAJE_FOTO_TIPO,
    })
    expect(await s.subirFoto(HAB, EVENTO, jpeg(0))).toEqual({ ok: false, error: MENSAJE_FOTO_VACIA })
    expect(upload).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('si la subida falla, deja constancia de la falla y no registra la foto', async () => {
    const { c, rpc } = cliente({ subida: { error: { message: 'detalle interno' } } })
    expect(await crearServicioHabitacion(c).subirFoto(HAB, EVENTO, jpeg())).toEqual({
      ok: false,
      error: MENSAJE_SUBIR_FOTO,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('marcar_foto_fallida', { p_event_id: EVENTO, p_motivo: 'carga_fallida' })

    const { c: c2, rpc: rpc2 } = cliente({ subida: new Error('red') })
    expect(await crearServicioHabitacion(c2).subirFoto(HAB, EVENTO, jpeg())).toEqual({
      ok: false,
      error: MENSAJE_SUBIR_FOTO,
    })
    expect(rpc2).not.toHaveBeenCalled()
  })

  it('traduce el rechazo del servidor a un mensaje fijo', async () => {
    const { c } = cliente({ rpc: { data: null, error: { message: 'foto_no_subida' } } })
    const r = await crearServicioHabitacion(c).subirFoto(HAB, EVENTO, jpeg())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/todavía no está en el almacén/)
    const otro = await crearServicioHabitacion(
      cliente({ rpc: { data: null, error: { message: 'relation "fotos" secreta' } } }).c,
    ).subirFoto(HAB, EVENTO, jpeg())
    expect(otro).toEqual({ ok: false, error: MENSAJE_CUENTAS })
  })

  it('marcarFallida manda el motivo', async () => {
    const { c, rpc } = cliente()
    expect(await crearServicioHabitacion(c).marcarFallida(EVENTO, 'camara_no_disponible')).toEqual({
      ok: true,
      datos: null,
    })
    expect(rpc).toHaveBeenCalledWith('marcar_foto_fallida', {
      p_event_id: EVENTO,
      p_motivo: 'camara_no_disponible',
    })
    const r = await crearServicioHabitacion(
      cliente({ rpc: { data: null, error: { message: 'foto_ya_resuelta' } } }).c,
    ).marcarFallida(EVENTO, 'carga_fallida')
    expect(r.ok).toBe(false)
  })
})

describe('utilidades de la habitación', () => {
  it('validarArchivoFoto acepta JPEG y PNG hasta 5 MB', () => {
    expect(validarArchivoFoto({ type: 'image/jpeg', size: 1 })).toBeNull()
    expect(validarArchivoFoto({ type: 'image/png', size: FOTO_TAMANO_MAX_BYTES })).toBeNull()
    expect(validarArchivoFoto({ type: 'image/png', size: FOTO_TAMANO_MAX_BYTES + 1 })).toBe(MENSAJE_FOTO_TAMANO)
    expect(validarArchivoFoto({ type: 'image/webp', size: 1 })).toBe(MENSAJE_FOTO_TIPO)
    expect(validarArchivoFoto({ type: '', size: 1 })).toBe(MENSAJE_FOTO_TIPO)
    expect(validarArchivoFoto({ type: 'image/jpeg', size: 0 })).toBe(MENSAJE_FOTO_VACIA)
  })

  it('rutaFoto sigue el formato que exige el almacén', () => {
    expect(rutaFoto(HAB, EVENTO, 'image/jpeg')).toBe(`${HAB}/${EVENTO}.jpg`)
    expect(rutaFoto(HAB, EVENTO, 'image/png')).toBe(`${HAB}/${EVENTO}.png`)
  })

  it('textoFoto dice el estado y, si falló, el motivo', () => {
    const base = { event_id: 'e', ruta: null, motivo: null, solicitada_en: 'x', resuelta_en: null } as const
    expect(textoFoto({ ...base, estado: 'pendiente' })).toBe('Foto pendiente: esperando la cámara.')
    expect(textoFoto({ ...base, estado: 'guardada', ruta: 'a/b.jpg' })).toBe('Foto guardada.')
    expect(textoFoto({ ...base, estado: 'fallida', motivo: 'camara_no_disponible' })).toBe(
      'No se tomó la foto: la cámara no estuvo disponible.',
    )
    expect(textoFoto({ ...base, estado: 'fallida', motivo: 'carga_fallida' })).toBe(
      'No se tomó la foto: no se pudo subir la imagen.',
    )
  })

  it('leerMonitoreoSensor solo lee confirmaciones reales y por sensor', () => {
    const hora = '2026-11-18T14:15:00Z'
    expect(leerMonitoreoSensor(null, 'puerta')).toBeNull()
    expect(leerMonitoreoSensor({ estado: {}, actualizado_en: null }, 'puerta')).toBeNull()
    expect(leerMonitoreoSensor({ estado: { monitoreo_puerta: true }, actualizado_en: null }, 'puerta')).toBeNull()
    expect(leerMonitoreoSensor({ estado: { monitoreo_puerta: true }, actualizado_en: hora }, 'puerta')).toBe(true)
    expect(leerMonitoreoSensor({ estado: { monitoreo_puerta: true }, actualizado_en: hora }, 'movimiento')).toBeNull()
    expect(leerMonitoreoSensor({ estado: { monitoreo_movimiento: false }, actualizado_en: hora }, 'movimiento')).toBe(false)
    expect(leerMonitoreoSensor({ estado: { monitoreo_puerta: 'si' }, actualizado_en: hora }, 'puerta')).toBeNull()
  })

  it('room_monitor_set cumple los mismos parámetros que el firmware y la base', () => {
    const cmd = (params: unknown) => ({ command: 'room_monitor_set', params }) as unknown as ComandoModulo
    expect(comandoValido(cmd({ sensor: 'puerta', enabled: true }))).toBe(true)
    expect(comandoValido(cmd({ sensor: 'movimiento', enabled: false }))).toBe(true)
    for (const mala of [
      {},
      { sensor: 'puerta' },
      { enabled: true },
      { sensor: 'camara', enabled: true },
      { sensor: 'puerta', enabled: 1 },
      { sensor: 'puerta', enabled: true, extra: 1 },
    ]) {
      expect(comandoValido(cmd(mala)), JSON.stringify(mala)).toBe(false)
    }
  })

  it('la configuración tiene valores por defecto y la cámara es opt-in', () => {
    expect(dispositivoHabitacionId()).toBe('cuna-habitacion-01')
    vi.stubEnv('VITE_HABITACION_DEVICE_ID', 'cuna-habitacion-02')
    expect(dispositivoHabitacionId()).toBe('cuna-habitacion-02')
    vi.stubEnv('VITE_HABITACION_DEVICE_ID', 'no válido!')
    expect(dispositivoHabitacionId()).toBe('cuna-habitacion-01')
    expect(camaraHabilitada()).toBe(false)
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'TRUE')
    expect(camaraHabilitada()).toBe(false)
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    expect(camaraHabilitada()).toBe(true)
  })
})
