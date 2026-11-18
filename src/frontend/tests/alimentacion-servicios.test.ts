import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Toma } from '../src/models/alimentacion.ts'
import { COMANDOS_ALIMENTACION } from '../src/models/ordenes.ts'
import {
  crearServicioAlimentacion,
  MENSAJE_TEMPERATURA_BIBERON,
  MENSAJE_TOMAS,
  type ClienteAlimentacion,
} from '../src/services/alimentacion.ts'
import {
  dispositivoAlimentacionId,
  DISPOSITIVO_ALIMENTACION_POR_DEFECTO,
} from '../src/services/configuracion.ts'
import { MENSAJE_CUENTAS } from '../src/services/cuentas.ts'
import {
  camposCorregibles,
  duracionVisibleS,
  formatearDuracion,
  formatearGramos,
  formatearGrados,
  MENSAJE_LIMITES_BIBERON_MIN_MAX,
  MENSAJE_LIMITES_BIBERON_NUMERO,
  MENSAJE_LIMITES_BIBERON_RANGO,
  MENSAJE_MOTIVO_CORRECCION,
  MENSAJE_PESO_NUMERO,
  parsearGramos,
  validarCorreccion,
  validarLimitesBiberon,
} from '../src/utils/alimentacion.ts'

afterEach(() => vi.unstubAllEnvs())

type Respuesta = { data: unknown; error: unknown }

const TOMA_ID = '1111aaaa-2222-4333-8444-55555555bbbb'

function toma(extra: Record<string, unknown> = {}) {
  return {
    id: TOMA_ID,
    device_id: 'cuna-alimentacion-01',
    bebe_id: 'b-1',
    estado: 'preparando',
    peso_inicial_g: null,
    peso_final_g: null,
    ingerido_g: null,
    peso_error: null,
    creada_en: '2999-11-18T14:00:00Z',
    inicio: null,
    fin: null,
    duracion_activa_s: null,
    pausas: [],
    correcciones: [],
    ...extra,
  }
}

function cliente(opciones: { rpc?: Respuesta | Error; consulta?: Respuesta | Error } = {}) {
  const consulta = {
    select: vi.fn(() => consulta),
    eq: vi.fn(() => consulta),
    order: vi.fn(() => consulta),
    limit: vi.fn(() => consulta),
    maybeSingle: vi.fn(async (): Promise<Respuesta> => {
      const r = opciones.consulta ?? { data: null, error: null }
      if (r instanceof Error) throw r
      return r
    }),
  }
  const rpc = vi.fn(async () => {
    const r = opciones.rpc ?? { data: toma(), error: null }
    if (r instanceof Error) throw r
    return r
  })
  const from = vi.fn(() => consulta)
  const c = { rpc, from } as unknown as ClienteAlimentacion
  return { c, rpc, from, consulta }
}

describe('servicio de alimentación: tomas', () => {
  it('listarTomas llama a mis_tomas y entrega la hora del servidor', async () => {
    const { c, rpc } = cliente({
      rpc: { data: { ahora: '2999-11-18T15:00:00Z', tomas: [toma({ estado: 'en_curso', duracion_activa_s: 780 })] }, error: null },
    })
    const r = await crearServicioAlimentacion(c).listarTomas('cuna-alimentacion-01', 20)
    expect(rpc).toHaveBeenCalledWith('mis_tomas', { p_device_id: 'cuna-alimentacion-01', p_limite: 20 })
    expect(r.ok && r.datos.ahora).toBe('2999-11-18T15:00:00Z')
    expect(r.ok && r.datos.tomas[0].duracion_activa_s).toBe(780)
  })

  it('una lista mal formada falla con mensaje seguro', async () => {
    for (const data of [
      null,
      { tomas: [] },
      { ahora: 'x', tomas: [{ id: 'a' }] },
      { ahora: 'x', tomas: [toma({ estado: 'otro' })] },
      { ahora: 'x', tomas: [toma({ estado: 'completa', ingerido_g: null })] },
      { ahora: 'x', tomas: [toma({ estado: 'en_curso', ingerido_g: 10 })] },
      { ahora: 'x', tomas: [toma({ peso_error: 'raro' })] },
      { ahora: 'x', tomas: [toma({ correcciones: [{ campo: 'peso_inicial_g' }] })] },
    ]) {
      const { c } = cliente({ rpc: { data, error: null } })
      expect(await crearServicioAlimentacion(c).listarTomas('d', 5)).toEqual({ ok: false, error: MENSAJE_TOMAS })
    }
  })

  it('un error del servidor nunca se reenvía', async () => {
    const { c } = cliente({ rpc: { data: null, error: { message: 'detalle interno SQL' } } })
    const r = await crearServicioAlimentacion(c).listarTomas('d', 5)
    expect(r).toEqual({ ok: false, error: MENSAJE_TOMAS })
    const { c: c2 } = cliente({ rpc: new Error('red') })
    expect(await crearServicioAlimentacion(c2).listarTomas('d', 5)).toEqual({ ok: false, error: MENSAJE_TOMAS })
  })

  it('las correcciones llegan con el autor como bandera, sin identificador', async () => {
    const correccion = {
      campo: 'peso_final_g',
      valor_anterior: 150,
      valor_nuevo: 140.5,
      motivo: 'balanza movida',
      creada_en: '2999-11-18T15:10:00Z',
      propia: false,
    }
    const { c } = cliente({
      rpc: { data: { ahora: 'x', tomas: [toma({ estado: 'por_cerrar', correcciones: [correccion] })] }, error: null },
    })
    const r = await crearServicioAlimentacion(c).listarTomas('d', 5)
    expect(r.ok && r.datos.tomas[0].correcciones).toEqual([correccion])
  })

  it('crearToma, cambiarEstado y corregir usan sus funciones y devuelven la toma', async () => {
    const s = (x: ClienteAlimentacion) => crearServicioAlimentacion(x)
    const a = cliente()
    const r1 = await s(a.c).crearToma('cuna-alimentacion-01', TOMA_ID)
    expect(a.rpc).toHaveBeenCalledWith('crear_toma', { p_toma_id: TOMA_ID, p_device_id: 'cuna-alimentacion-01' })
    expect(r1.ok && r1.datos.estado).toBe('preparando')

    for (const [accion, funcion] of [
      ['iniciar', 'iniciar_toma'],
      ['pausar', 'pausar_toma'],
      ['reanudar', 'reanudar_toma'],
      ['finalizar', 'finalizar_toma'],
      ['cerrar', 'cerrar_toma'],
      ['cancelar', 'cancelar_toma'],
    ] as const) {
      const x = cliente()
      await s(x.c).cambiarEstado(TOMA_ID, accion)
      expect(x.rpc).toHaveBeenCalledWith(funcion, { p_toma_id: TOMA_ID })
    }

    const b = cliente()
    await s(b.c).corregir(TOMA_ID, 'peso_final_g', 140.5, 'balanza movida')
    expect(b.rpc).toHaveBeenCalledWith('corregir_toma', {
      p_toma_id: TOMA_ID,
      p_campo: 'peso_final_g',
      p_valor: 140.5,
      p_motivo: 'balanza movida',
    })
  })

  it('traduce los errores de toma a mensajes fijos', async () => {
    const casos: Record<string, string> = {
      toma_sin_peso_inicial: 'Pesa el biberón antes de iniciar la toma.',
      toma_incompleta: 'Falta el peso final o es mayor que el inicial. Pesa de nuevo o corrige el peso.',
      estado_toma_invalido: 'Esa acción no corresponde al estado actual de la toma.',
      correccion_invalida: 'El peso corregido no es válido para esta toma.',
      toma_abierta: 'Ya hay una toma abierta en este módulo. Ciérrala o cancélala primero.',
    }
    for (const [codigo, texto] of Object.entries(casos)) {
      const { c } = cliente({ rpc: { data: null, error: { message: codigo } } })
      const r = await crearServicioAlimentacion(c).cambiarEstado(TOMA_ID, 'iniciar')
      expect(r).toEqual({ ok: false, error: texto })
    }
    const { c } = cliente({ rpc: { data: null, error: { message: 'cualquier otra cosa' } } })
    expect(await crearServicioAlimentacion(c).cambiarEstado(TOMA_ID, 'iniciar')).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('una toma mal formada en la respuesta de una acción falla', async () => {
    const { c } = cliente({ rpc: { data: { id: 'x' }, error: null } })
    expect(await crearServicioAlimentacion(c).cambiarEstado(TOMA_ID, 'pausar')).toEqual({
      ok: false,
      error: MENSAJE_CUENTAS,
    })
  })

  it('pedirPeso envía el command_id y no devuelve ningún peso', async () => {
    const { c, rpc } = cliente({ rpc: { data: { command_id: 'c-1' }, error: null } })
    const r = await crearServicioAlimentacion(c).pedirPeso(TOMA_ID, 'final', 'c-1')
    expect(rpc).toHaveBeenCalledWith('pedir_peso_toma', {
      p_toma_id: TOMA_ID,
      p_momento: 'final',
      p_command_id: 'c-1',
    })
    expect(r).toEqual({ ok: true, datos: null })
  })
})

describe('servicio de alimentación: límites y temperatura', () => {
  it('obtenerLimites distingue «sin límites» de un fallo', async () => {
    const s = (data: unknown) => crearServicioAlimentacion(cliente({ rpc: { data, error: null } }).c)
    expect(await s(null).obtenerLimites('d')).toEqual({ ok: true, datos: null })
    expect(await s({ temp_min: 35, temp_max: 40 }).obtenerLimites('d')).toEqual({
      ok: true,
      datos: { temp_min: 35, temp_max: 40 },
    })
    expect(await s({ temp_min: 'x' }).obtenerLimites('d')).toEqual({ ok: false, error: MENSAJE_CUENTAS })
  })

  it('guardarLimites envía mínimo y máximo', async () => {
    const { c, rpc } = cliente({ rpc: { data: { temp_min: 30, temp_max: 40 }, error: null } })
    const r = await crearServicioAlimentacion(c).guardarLimites('d', { temp_min: 30, temp_max: 40 })
    expect(rpc).toHaveBeenCalledWith('guardar_limites_biberon', { p_device_id: 'd', p_temp_min: 30, p_temp_max: 40 })
    expect(r).toEqual({ ok: true, datos: { temp_min: 30, temp_max: 40 } })
  })

  it('ultimaTemperatura lee solo el último evento de temperatura del biberón', async () => {
    const { c, from, consulta } = cliente({
      consulta: { data: { valor: 37.5, ts: '2999-11-18T14:00:00Z' }, error: null },
    })
    const r = await crearServicioAlimentacion(c).ultimaTemperatura('cuna-alimentacion-01')
    expect(from).toHaveBeenCalledWith('eventos')
    expect(consulta.eq).toHaveBeenCalledWith('tipo', 'temperatura_biberon')
    expect(consulta.eq).toHaveBeenCalledWith('device_id', 'cuna-alimentacion-01')
    expect(r).toEqual({ ok: true, datos: { valor: 37.5, ts: '2999-11-18T14:00:00Z' } })
  })

  it('sin eventos devuelve null y un dato inválido o un error falla', async () => {
    const vacio = cliente({ consulta: { data: null, error: null } })
    expect(await crearServicioAlimentacion(vacio.c).ultimaTemperatura('d')).toEqual({ ok: true, datos: null })
    for (const consulta of [
      { data: { valor: 'x', ts: 't' }, error: null },
      { data: { valor: 37, ts: '' }, error: null },
      { data: null, error: { message: 'x' } },
      new Error('red'),
    ]) {
      const { c } = cliente({ consulta })
      expect(await crearServicioAlimentacion(c).ultimaTemperatura('d')).toEqual({
        ok: false,
        error: MENSAJE_TEMPERATURA_BIBERON,
      })
    }
  })
})

describe('alimentación: configuración y comandos', () => {
  it('el módulo por defecto es cuna-alimentacion-01 y se puede cambiar', () => {
    expect(dispositivoAlimentacionId()).toBe(DISPOSITIVO_ALIMENTACION_POR_DEFECTO)
    expect(DISPOSITIVO_ALIMENTACION_POR_DEFECTO).toBe('cuna-alimentacion-01')
    vi.stubEnv('VITE_ALIMENTACION_DEVICE_ID', 'cuna-alimentacion-02')
    expect(dispositivoAlimentacionId()).toBe('cuna-alimentacion-02')
  })

  it('feeding_weigh es un comando del módulo pero no se solicita como orden libre', () => {
    expect(COMANDOS_ALIMENTACION).toEqual(['feeding_weigh'])
  })
})

describe('alimentación: utilidades', () => {
  it('formatea gramos, grados y duraciones', () => {
    expect(formatearGramos(200)).toBe('200 g')
    expect(formatearGramos(150.5)).toBe('150,5 g')
    expect(formatearGrados(37.46)).toBe('37,46 °C')
    expect(formatearDuracion(780)).toBe('13 min 0 s')
    expect(formatearDuracion(3725)).toBe('1 h 2 min 5 s')
    expect(formatearDuracion(-5)).toBe('0 min 0 s')
  })

  it('parsearGramos acepta números positivos hasta 5000 con coma o punto', () => {
    expect(parsearGramos('200')).toBe(200)
    expect(parsearGramos(' 150,5 ')).toBe(150.5)
    for (const malo of ['', '0', '-3', '5000.01', '12345', 'abc', '1e3', '1,234', '10 g']) {
      expect(parsearGramos(malo), malo).toBeNull()
    }
    expect(parsearGramos('5000')).toBe(5000)
  })

  it('una corrección exige peso válido y motivo', () => {
    expect(validarCorreccion('140,5', ' balanza movida ')).toEqual({ ok: true, valor: 140.5, motivo: 'balanza movida' })
    expect(validarCorreccion('x', 'motivo')).toEqual({ ok: false, error: MENSAJE_PESO_NUMERO })
    expect(validarCorreccion('10', '   ')).toEqual({ ok: false, error: MENSAJE_MOTIVO_CORRECCION })
    expect(validarCorreccion('10', 'a'.repeat(201))).toEqual({ ok: false, error: MENSAJE_MOTIVO_CORRECCION })
    expect(validarCorreccion('10', 'a'.repeat(200)).ok).toBe(true)
  })

  it('valida los límites del biberón', () => {
    expect(validarLimitesBiberon('35', '40,5')).toEqual({ ok: true, limites: { temp_min: 35, temp_max: 40.5 } })
    expect(validarLimitesBiberon('', '40')).toEqual({ ok: false, error: MENSAJE_LIMITES_BIBERON_NUMERO })
    expect(validarLimitesBiberon('-11', '40')).toEqual({ ok: false, error: MENSAJE_LIMITES_BIBERON_RANGO })
    expect(validarLimitesBiberon('10', '101')).toEqual({ ok: false, error: MENSAJE_LIMITES_BIBERON_RANGO })
    expect(validarLimitesBiberon('40', '40')).toEqual({ ok: false, error: MENSAJE_LIMITES_BIBERON_MIN_MAX })
    expect(validarLimitesBiberon('41', '40')).toEqual({ ok: false, error: MENSAJE_LIMITES_BIBERON_MIN_MAX })
    expect(validarLimitesBiberon('-10', '100').ok).toBe(true)
  })

  it('la duración visible avanza solo con la toma en curso', () => {
    const t = (estado: string, d: number | null) => toma({ estado, duracion_activa_s: d }) as unknown as Toma
    expect(duracionVisibleS(t('en_curso', 780), 1000, 6000)).toBe(785)
    expect(duracionVisibleS(t('en_curso', 780), 1000, 500)).toBe(780)
    expect(duracionVisibleS(t('pausada', 780), 1000, 61000)).toBe(780)
    expect(duracionVisibleS(t('por_cerrar', 780), 1000, 61000)).toBe(780)
    expect(duracionVisibleS(t('preparando', null), 1000, 61000)).toBeNull()
  })

  it('los campos corregibles dependen del estado', () => {
    const c = (estado: string) => camposCorregibles(toma({ estado }) as unknown as Toma)
    expect(c('preparando')).toEqual([])
    expect(c('cancelada')).toEqual([])
    expect(c('en_curso')).toEqual(['peso_inicial_g'])
    expect(c('por_cerrar')).toEqual(['peso_inicial_g', 'peso_final_g'])
    expect(c('completa')).toEqual(['peso_inicial_g', 'peso_final_g'])
  })
})
