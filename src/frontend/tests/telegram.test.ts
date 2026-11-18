import { describe, expect, it, vi } from 'vitest'
import { crearServicioTelegram, type ClienteTelegram } from '../src/services/telegram.ts'
import { MENSAJE_CUENTAS } from '../src/services/cuentas.ts'
import { botTelegram } from '../src/services/configuracion.ts'

function cliente(respuesta: { data: unknown; error: unknown } | Error) {
  const rpc = vi.fn(async () => {
    if (respuesta instanceof Error) throw respuesta
    return respuesta
  })
  return { cliente: { rpc } as unknown as ClienteTelegram, rpc }
}

describe('crearServicioTelegram', () => {
  it('listarDestinatarios valida la forma y no devuelve chat_id', async () => {
    const lista = [
      { id: 'd-1', nombre: 'Mamá', vinculado: true },
      { id: 'd-2', nombre: 'Papá', vinculado: false },
    ]
    const { cliente: c, rpc } = cliente({ data: lista, error: null })
    expect(await crearServicioTelegram(c).listarDestinatarios('cuna-ambiente-01')).toEqual({
      ok: true,
      datos: lista,
    })
    expect(rpc).toHaveBeenCalledWith('mis_destinatarios', { p_device_id: 'cuna-ambiente-01' })

    const mal = cliente({ data: [{ id: 'd-1', nombre: 'Mamá' }], error: null })
    expect(await crearServicioTelegram(mal.cliente).listarDestinatarios('d')).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('crearDestinatario exige nombre sin llamar al servidor', async () => {
    const { cliente: c, rpc } = cliente({ data: {}, error: null })
    expect(await crearServicioTelegram(c).crearDestinatario('d', '  ')).toEqual({
      ok: false,
      error: 'Escribe el nombre del destinatario.',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('generarCodigo acepta solo códigos con el formato esperado', async () => {
    const bien = cliente({
      data: { codigo: 'a1b2c3d4e5f6a7b8c9d0', vence_en: '2026-11-18T14:15:00Z' },
      error: null,
    })
    expect(await crearServicioTelegram(bien.cliente).generarCodigo('d-1')).toEqual({
      ok: true,
      datos: { codigo: 'a1b2c3d4e5f6a7b8c9d0', vence_en: '2026-11-18T14:15:00Z' },
    })
    expect(bien.rpc).toHaveBeenCalledWith('generar_codigo_vinculacion', { p_destinatario_id: 'd-1' })
    for (const data of [{ codigo: 'corto', vence_en: '2026-11-18T14:15:00Z' }, { codigo: 'a1b2c3d4e5f6', vence_en: 'ayer' }, null]) {
      const mal = cliente({ data, error: null })
      expect(await crearServicioTelegram(mal.cliente).generarCodigo('d-1')).toEqual({
        ok: false,
        error: MENSAJE_CUENTAS,
      })
    }
  })

  it('retirarDestinatario y los errores ocultan el texto del servidor', async () => {
    const bien = cliente({ data: { id: 'd-1', activo: false }, error: null })
    expect(await crearServicioTelegram(bien.cliente).retirarDestinatario('d-1')).toEqual({ ok: true, datos: null })
    const sinPermiso = cliente({ data: null, error: { message: 'no_autorizado', code: '42501' } })
    expect(await crearServicioTelegram(sinPermiso.cliente).retirarDestinatario('d-1')).toEqual({
      ok: false,
      error: 'No tienes permiso para esta operación.',
    })
    const lanza = cliente(new Error('red caída con detalles'))
    expect(await crearServicioTelegram(lanza.cliente).listarDestinatarios('d')).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })
})

describe('botTelegram', () => {
  it('sin variable configurada no hay enlace', () => {
    expect(botTelegram()).toBeNull()
  })

  it('acepta solo nombres de usuario válidos, con o sin @', () => {
    for (const [valor, esperado] of [
      ['CunaInteligenteBot', 'CunaInteligenteBot'],
      ['@cuna_bot', 'cuna_bot'],
      ['x', null],
      ['con espacios', null],
      ['evil/../bot', null],
    ] as const) {
      vi.stubEnv('VITE_TELEGRAM_BOT', valor)
      expect(botTelegram()).toBe(esperado)
    }
    vi.unstubAllEnvs()
  })
})
