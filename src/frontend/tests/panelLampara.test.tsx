import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { OrdenLampara } from '../src/models/lampara.ts'
import {
  DISPOSITIVO_LAMPARA_POR_DEFECTO,
  dispositivoLamparaId,
  lamparaHabilitada,
} from '../src/services/configuracion.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, Servicios, Sesion } from '../src/services/tipos.ts'

const SESION: Sesion = { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' }
const OTRA: Sesion = { usuario_id: 'u-2', correo: 'otra@ejemplo.test' }
const AHORA = new Date('2026-11-11T16:04:15Z')

function orden(extra: Partial<OrdenLampara> = {}): OrdenLampara {
  return {
    command_id: 'c-1',
    device_id: DISPOSITIVO_LAMPARA_POR_DEFECTO,
    nivel: 40,
    creado_en: '2026-11-11T16:04:10Z',
    vence_en: '2026-11-11T16:04:25Z',
    estado: 'pendiente',
    entregado_en: null,
    confirmado_en: null,
    nivel_confirmado: null,
    error: null,
    ...extra,
  }
}

type Consulta = Resultado<OrdenLampara | null>
type Solicitud = Resultado<OrdenLampara>

function montar(
  respuestas: Array<() => Promise<Consulta>>,
  solicitud: () => Promise<Solicitud> = () => new Promise(() => {}),
  sesionInicial: Sesion | null = SESION,
) {
  const oyentes = new Set<(s: Sesion | null) => void>()
  let n = 0
  const obtenerUltimaOrdenLampara = vi.fn((_id: string) => {
    const r = respuestas[Math.min(n, respuestas.length - 1)]
    n += 1
    return r()
  })
  const solicitarLampara = vi.fn((_id: string, _nivel: number) => solicitud())
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    lampara: { obtenerUltimaOrdenLampara, solicitarLampara },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => Promise.resolve({ ok: true, datos: sesionInicial }),
      suscribirCambiosSesion: (alCambiar) => {
        oyentes.add(alCambiar)
        return () => {
          oyentes.delete(alCambiar)
        }
      },
    },
  }
  const vista = render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/cuna']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
  return {
    obtenerUltimaOrdenLampara,
    solicitarLampara,
    desmontar: vista.unmount,
    emitir: (s: Sesion | null) => act(() => oyentes.forEach((o) => o(s))),
  }
}

const avanzar = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const ok = (datos: OrdenLampara | null) => () =>
  Promise.resolve<Consulta>({ ok: true, datos })
const falla = () =>
  Promise.resolve<Consulta>({
    ok: false,
    error: 'No se pudo consultar la última orden de la lámpara.',
  })

const panel = () => screen.queryByRole('region', { name: 'Lámpara' })
const estado = () =>
  screen.getByText('Estado de la última orden').nextElementSibling as HTMLElement
const valor = (etiqueta: string) =>
  screen.getByText(etiqueta).nextElementSibling as HTMLElement

function habilitar() {
  vi.stubEnv('VITE_LAMPARA_HABILITADA', 'true')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
})
afterEach(() => {
  vi.useRealTimers()
  vi.stubEnv('VITE_LAMPARA_HABILITADA', '')
  vi.stubEnv('VITE_LAMPARA_DEVICE_ID', '')
})

describe('configuración de la lámpara', () => {
  it('por defecto está deshabilitada y usa cuna-lampara-01', () => {
    expect(lamparaHabilitada()).toBe(false)
    expect(dispositivoLamparaId()).toBe('cuna-lampara-01')
  })

  it('solo el valor exacto "true" la habilita', () => {
    for (const v of ['false', '1', 'TRUE', 'si', '']) {
      vi.stubEnv('VITE_LAMPARA_HABILITADA', v)
      expect(lamparaHabilitada()).toBe(false)
    }
    vi.stubEnv('VITE_LAMPARA_HABILITADA', ' true ')
    expect(lamparaHabilitada()).toBe(true)
  })

  it('VITE_LAMPARA_DEVICE_ID reemplaza el módulo', () => {
    vi.stubEnv('VITE_LAMPARA_DEVICE_ID', ' cuna-lampara-02 ')
    expect(dispositivoLamparaId()).toBe('cuna-lampara-02')
  })
})

describe('Cuna sin el flag', () => {
  it('no muestra el panel ni consulta la lámpara', async () => {
    const { obtenerUltimaOrdenLampara } = montar([ok(orden())])
    await avanzar(10_000)
    expect(panel()).not.toBeInTheDocument()
    expect(screen.queryByText('Solicitar nivel')).not.toBeInTheDocument()
    expect(obtenerUltimaOrdenLampara).not.toHaveBeenCalled()
  })

  it('con flag pero sin sesión tampoco aparece ni consulta', async () => {
    habilitar()
    const { obtenerUltimaOrdenLampara } = montar([ok(orden())], undefined, null)
    await avanzar(10_000)
    expect(panel()).not.toBeInTheDocument()
    expect(obtenerUltimaOrdenLampara).not.toHaveBeenCalled()
  })
})

describe('Panel de lámpara', () => {
  it('pide el estado inicial con el módulo configurado y consulta cada 2 s', async () => {
    habilitar()
    const { obtenerUltimaOrdenLampara } = montar([ok(null)])
    await avanzar()
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledWith('cuna-lampara-01')
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledTimes(1)
    expect(screen.getByText('No hay órdenes registradas para esta lámpara.')).toBeInTheDocument()
    await avanzar(1_999)
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledTimes(1)
    await avanzar(1)
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledTimes(2)
  })

  it('no superpone consultas mientras una sigue pendiente', async () => {
    habilitar()
    const { obtenerUltimaOrdenLampara } = montar([() => new Promise(() => {})])
    await avanzar(10_000)
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Consultando la última orden…')).toBeInTheDocument()
  })

  it('pendiente: solicitud registrada y nivel confirmado sin confirmar', async () => {
    habilitar()
    montar([ok(orden())])
    await avanzar()
    expect(estado()).toHaveTextContent('Solicitud registrada')
    expect(valor('Nivel pedido')).toHaveTextContent('40 %')
    expect(valor('Nivel confirmado por la Pico')).toHaveTextContent('Sin confirmar')
  })

  it('enviada, confirmada y error se distinguen; el nivel confirmado es aparte', async () => {
    habilitar()
    montar([
      ok(orden({ estado: 'enviado', entregado_en: '2026-11-11T16:04:11Z' })),
      ok(
        orden({
          estado: 'confirmado',
          nivel_confirmado: 35,
          confirmado_en: '2026-11-11T16:04:12Z',
        }),
      ),
      ok(orden({ estado: 'error', error: 'fuera_de_rango:level' })),
    ])
    await avanzar()
    expect(estado()).toHaveTextContent('Orden enviada')
    expect(valor('Nivel confirmado por la Pico')).toHaveTextContent('Sin confirmar')
    await avanzar(2_000)
    expect(estado()).toHaveTextContent('Confirmada por la Pico')
    expect(valor('Nivel pedido')).toHaveTextContent('40 %')
    expect(valor('Nivel confirmado por la Pico')).toHaveTextContent('35 %')
    await avanzar(2_000)
    expect(estado()).toHaveTextContent('Error')
    expect(screen.queryByText(/fuera_de_rango/)).not.toBeInTheDocument()
    expect(valor('Nivel confirmado por la Pico')).toHaveTextContent('Sin confirmar')
  })

  it('confirmada con nivel 0 muestra 0 % y aclara que no prueba la luz', async () => {
    habilitar()
    montar([ok(orden({ nivel: 0, estado: 'confirmado', nivel_confirmado: 0 }))])
    await avanzar()
    expect(valor('Nivel confirmado por la Pico')).toHaveTextContent('0 %')
    expect(screen.getByText(/no comprueba que la luz esté encendida/)).toBeInTheDocument()
    expect(screen.queryByText(/encendida\./i, { selector: 'dd' })).not.toBeInTheDocument()
  })

  it('pendiente o enviada que vence pasa a sin respuesta', async () => {
    habilitar()
    montar([ok(orden({ estado: 'enviado' }))])
    await avanzar()
    expect(estado()).toHaveTextContent('Orden enviada')
    await avanzar(10_000) // 16:04:25 exacto: aún vigente
    expect(estado()).toHaveTextContent('Orden enviada')
    await avanzar(1_000)
    expect(estado()).toHaveTextContent('Sin respuesta')
    expect(valor('Nivel confirmado por la Pico')).toHaveTextContent('Sin confirmar')
  })

  it('un fallo posterior conserva la última orden y avisa', async () => {
    habilitar()
    montar([ok(orden()), falla])
    await avanzar()
    await avanzar(2_000)
    expect(
      screen.getByText('No se pudo consultar la última orden de la lámpara.'),
    ).toBeInTheDocument()
    expect(valor('Nivel pedido')).toHaveTextContent('40 %')
  })
})

describe('Panel de lámpara: solicitud', () => {
  it('niveles inválidos no llaman al servicio', async () => {
    habilitar()
    const { solicitarLampara } = montar([ok(null)])
    await avanzar()
    const campo = screen.getByLabelText('Nivel pedido (0 a 100)')
    for (const v of ['', '101', '-1', '4.5']) {
      fireEvent.change(campo, { target: { value: v } })
      fireEvent.click(screen.getByRole('button', { name: 'Solicitar nivel' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Ingrese un número entero de 0 a 100.')
      expect(campo).toHaveAttribute('aria-invalid', 'true')
    }
    expect(solicitarLampara).not.toHaveBeenCalled()
  })

  it('el botón envía el nivel entero, no se duplica en curso y muestra la orden devuelta', async () => {
    habilitar()
    let resolver!: (r: Solicitud) => void
    const { solicitarLampara } = montar(
      [ok(null)],
      () => new Promise<Solicitud>((r) => (resolver = r)),
    )
    await avanzar()
    fireEvent.change(screen.getByLabelText('Nivel pedido (0 a 100)'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar nivel' }))
    await avanzar()
    expect(solicitarLampara).toHaveBeenCalledWith('cuna-lampara-01', 0)
    const boton = screen.getByRole('button', { name: 'Enviando…' })
    expect(boton).toBeDisabled()
    fireEvent.submit(boton.closest('form')!)
    expect(solicitarLampara).toHaveBeenCalledTimes(1)
    await act(async () => resolver({ ok: true, datos: orden({ nivel: 0 }) }))
    expect(estado()).toHaveTextContent('Solicitud registrada')
    expect(valor('Nivel pedido')).toHaveTextContent('0 %')
    expect(screen.getByRole('button', { name: 'Solicitar nivel' })).toBeEnabled()
  })

  it('un fallo de solicitud muestra aviso genérico y conserva la orden previa', async () => {
    habilitar()
    montar(
      [ok(orden({ nivel: 70 }))],
      () => Promise.resolve({ ok: false, error: 'No se pudo registrar la solicitud de la lámpara.' }),
    )
    await avanzar()
    fireEvent.change(screen.getByLabelText('Nivel pedido (0 a 100)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar nivel' }))
    await avanzar()
    expect(screen.getByText('No se pudo registrar la solicitud de la lámpara.')).toBeInTheDocument()
    expect(valor('Nivel pedido')).toHaveTextContent('70 %')
  })

  it('una consulta iniciada antes de la solicitud no pisa la orden nueva', async () => {
    habilitar()
    let resolverConsulta!: (r: Consulta) => void
    montar(
      [ok(orden({ command_id: 'vieja', nivel: 70 })), () => new Promise<Consulta>((r) => (resolverConsulta = r))],
      () => Promise.resolve({ ok: true, datos: orden({ command_id: 'nueva', nivel: 10 }) }),
    )
    await avanzar()
    await avanzar(2_000) // segunda consulta queda en vuelo
    fireEvent.change(screen.getByLabelText('Nivel pedido (0 a 100)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar nivel' }))
    await avanzar()
    expect(valor('Nivel pedido')).toHaveTextContent('10 %')
    await act(async () => resolverConsulta({ ok: true, datos: orden({ command_id: 'vieja', nivel: 70 }) }))
    expect(valor('Nivel pedido')).toHaveTextContent('10 %')
  })
})

describe('Panel de lámpara: cuenta y desmontaje', () => {
  it('al cerrar sesión desaparece el panel y se deja de consultar', async () => {
    habilitar()
    const { obtenerUltimaOrdenLampara, emitir } = montar([ok(orden())])
    await avanzar()
    expect(panel()).toBeInTheDocument()
    emitir(null)
    await avanzar(10_000)
    expect(panel()).not.toBeInTheDocument()
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledTimes(1)
  })

  it('con otra cuenta no se ve la orden anterior ni su respuesta tardía', async () => {
    habilitar()
    let resolver!: (r: Consulta) => void
    const { emitir } = montar([ok(orden({ nivel: 70 })), () => new Promise<Consulta>((r) => (resolver = r))])
    await avanzar()
    expect(valor('Nivel pedido')).toHaveTextContent('70 %')
    emitir(OTRA)
    await avanzar()
    expect(screen.getByText('Consultando la última orden…')).toBeInTheDocument()
    expect(screen.queryByText('70 %')).not.toBeInTheDocument()
    await act(async () => resolver({ ok: true, datos: orden({ nivel: 20 }) }))
    expect(valor('Nivel pedido')).toHaveTextContent('20 %')
  })

  it('una solicitud en curso de la cuenta anterior se descarta al cambiar de cuenta', async () => {
    habilitar()
    let resolver!: (r: Solicitud) => void
    const { emitir } = montar(
      [ok(null)],
      () => new Promise<Solicitud>((r) => (resolver = r)),
    )
    await avanzar()
    fireEvent.change(screen.getByLabelText('Nivel pedido (0 a 100)'), { target: { value: '55' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar nivel' }))
    await avanzar()
    emitir(OTRA)
    await avanzar()
    await act(async () => resolver({ ok: true, datos: orden({ nivel: 55 }) }))
    expect(screen.queryByText('55 %')).not.toBeInTheDocument()
  })

  it('al desmontar deja de consultar e ignora la respuesta tardía', async () => {
    habilitar()
    let resolver!: (r: Consulta) => void
    const { obtenerUltimaOrdenLampara, desmontar } = montar([
      () => new Promise<Consulta>((r) => (resolver = r)),
    ])
    await avanzar()
    desmontar()
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => resolver({ ok: true, datos: orden() }))
    await avanzar(10_000)
    expect(obtenerUltimaOrdenLampara).toHaveBeenCalledTimes(1)
    expect(errores).not.toHaveBeenCalled()
    errores.mockRestore()
  })
})
