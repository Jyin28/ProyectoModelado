import { describe, expect, it, vi } from 'vitest'
import {
  crearServicioCuentas,
  MENSAJE_CUENTAS,
  type ClienteCuentas,
} from '../src/services/cuentas.ts'

type Respuesta = { data: unknown; error: unknown }

function cliente(respuesta: Respuesta | (() => never)) {
  const rpc = vi.fn(async () => {
    if (typeof respuesta === 'function') return respuesta()
    return respuesta
  })
  return { cliente: { rpc } as unknown as ClienteCuentas, rpc }
}

const BEBE = { id: 'b-1', nombre: 'Luna', fecha_nacimiento: null }
const MODULO = {
  id: 'cuna-ambiente-01',
  tipo: 'cuna',
  producto_id: 'cuna-01',
  activo: true,
  bebe_id: 'b-1',
  bebe_nombre: 'Luna',
}

describe('crearServicioCuentas', () => {
  it('crearBebe exige nombre sin llamar al servidor (CA-02.3)', async () => {
    const { cliente: c, rpc } = cliente({ data: BEBE, error: null })
    const r = await crearServicioCuentas(c).crearBebe('   ', null)
    expect(r).toEqual({ ok: false, error: 'Escribe el nombre del bebé.' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('crearBebe envía nombre recortado y fecha opcional vacía como nula', async () => {
    const { cliente: c, rpc } = cliente({ data: BEBE, error: null })
    const r = await crearServicioCuentas(c).crearBebe('  Luna ', '')
    expect(r).toEqual({ ok: true, datos: BEBE })
    expect(rpc).toHaveBeenCalledWith('crear_bebe', {
      p_nombre: 'Luna',
      p_fecha_nacimiento: null,
    })
  })

  it('crearBebe rechaza una respuesta con forma inesperada', async () => {
    const { cliente: c } = cliente({ data: { id: 5 }, error: null })
    expect(await crearServicioCuentas(c).crearBebe('Luna', null)).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('listarDispositivos valida cada elemento y no devuelve datos parciales', async () => {
    const bien = cliente({ data: [MODULO], error: null })
    expect(await crearServicioCuentas(bien.cliente).listarDispositivos()).toEqual({
      ok: true,
      datos: [MODULO],
    })
    const mal = cliente({ data: [MODULO, { ...MODULO, tipo: 'otro' }], error: null })
    expect(await crearServicioCuentas(mal.cliente).listarDispositivos()).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('traduce los errores conocidos y oculta el texto desconocido', async () => {
    const conocido = cliente({ data: null, error: { message: 'cuna_ya_asociada', code: '23505' } })
    expect(await crearServicioCuentas(conocido.cliente).asignarDispositivo('d', 'b')).toEqual({
      ok: false,
      error: 'Ese bebé ya tiene otra cuna asociada.',
    })
    const ultimo = cliente({ data: null, error: { message: 'ultimo_dueno' } })
    expect(await crearServicioCuentas(ultimo.cliente).retirarDueno('d', 'u')).toEqual({
      ok: false,
      error: 'No se puede retirar al último dueño del módulo.',
    })
    const raro = cliente({ data: null, error: { message: 'relation "x" does not exist' } })
    expect(await crearServicioCuentas(raro.cliente).listarBebes()).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
    const lanza = cliente(() => {
      throw new Error('red caída')
    })
    expect(await crearServicioCuentas(lanza.cliente).listarBebes()).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('usa los nombres de RPC y parámetros del contrato', async () => {
    const { cliente: c, rpc } = cliente({ data: {}, error: null })
    const s = crearServicioCuentas(c)
    await s.reclamarDispositivo(' cuna-ambiente-01 ', ' codigo-de-prueba-01 ')
    await s.asignarDispositivo('cuna-ambiente-01', null)
    await s.invitarDueno('cuna-ambiente-01', ' b@ejemplo.test ')
    await s.retirarDueno('cuna-ambiente-01', 'u-2')
    await s.aceptarInvitacion('i-1')
    expect(rpc.mock.calls).toEqual([
      ['reclamar_dispositivo', { p_device_id: 'cuna-ambiente-01', p_codigo: 'codigo-de-prueba-01' }],
      ['asignar_dispositivo', { p_device_id: 'cuna-ambiente-01', p_bebe_id: null }],
      ['invitar_dueno', { p_device_id: 'cuna-ambiente-01', p_correo: 'b@ejemplo.test' }],
      ['retirar_dueno', { p_device_id: 'cuna-ambiente-01', p_usuario_id: 'u-2' }],
      ['aceptar_invitacion', { p_invitacion_id: 'i-1' }],
    ])
  })

  it('listarDuenos e invitaciones convierten sus filas', async () => {
    const duenos = cliente({ data: [{ usuario_id: 'u-1', correo: 'a@ejemplo.test' }], error: null })
    expect(await crearServicioCuentas(duenos.cliente).listarDuenos('d')).toEqual({
      ok: true,
      datos: [{ usuario_id: 'u-1', correo: 'a@ejemplo.test' }],
    })
    const inv = { id: 'i-1', dispositivo_id: 'd', tipo: 'colchon', creada_en: '2026-11-18T10:00:00Z' }
    const invitaciones = cliente({ data: [inv], error: null })
    expect(await crearServicioCuentas(invitaciones.cliente).listarInvitaciones()).toEqual({
      ok: true,
      datos: [inv],
    })
  })
})
