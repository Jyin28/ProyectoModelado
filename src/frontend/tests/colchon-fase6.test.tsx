import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { ConfigColchon, EventoColchon } from '../src/models/colchon.ts'
import type { EstadoModulo, OrdenModulo } from '../src/models/ordenes.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type {
  Resultado,
  Servicios,
  ServicioColchon,
  ServicioOrdenes,
} from '../src/services/tipos.ts'
import {
  MENSAJE_CONFIG_ALARMA,
  MENSAJE_CONFIG_DURACION,
  MENSAJE_CONFIG_TOLERANCIA,
} from '../src/utils/colchon.ts'

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })
const falla = <T,>(error: string): Promise<Resultado<T>> => Promise.resolve({ ok: false, error })

const CONFIG: ConfigColchon = { duracion_s: 300, tolerancia_pct: 10, alarma_s: 60 }
const SIN_ESTADO: EstadoModulo = { estado: {}, actualizado_en: null }

function orden(extra: Partial<OrdenModulo> = {}): OrdenModulo {
  return {
    command_id: 'c-1',
    device_id: 'cuna-colchon-01',
    command: 'mattress_arm',
    params: {},
    creado_en: '2999-11-18T10:00:00Z',
    vence_en: '2999-11-18T10:00:15Z',
    estado: 'pendiente',
    entregado_en: null,
    confirmado_en: null,
    error: null,
    ...extra,
  }
}

type Parciales = { colchon?: Partial<ServicioColchon>; ordenes?: Partial<ServicioOrdenes> }

function abrir(p: Parciales = {}, backend = true) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    colchon: {
      obtenerConfig: () => ok(null),
      guardarConfig: () => falla('x'),
      listarEventos: () => ok([]),
      ...p.colchon,
    },
    ordenes: {
      solicitar: () => falla('x'),
      obtenerUltimaOrden: () => ok(null),
      obtenerEstado: () => ok(SIN_ESTADO),
      ...p.ordenes,
    },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => ok({ usuario_id: 'u-1', correo: 'ana@ejemplo.test' }),
    },
  }
  return render(
    <ProveedorServicios configurado={backend} servicios={servicios}>
      <MemoryRouter initialEntries={['/colchon']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

const panel = () => screen.findByRole('region', { name: 'Monitoreo del colchón' })

afterEach(() => vi.unstubAllEnvs())

describe('Colchón: pantalla', () => {
  it('sin backend no muestra el panel ni datos', async () => {
    abrir({}, false)
    expect(await screen.findByRole('heading', { name: 'Colchón' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Monitoreo del colchón' })).not.toBeInTheDocument()
  })

  it('sin datos reales no inventa estado, configuración ni eventos', async () => {
    abrir()
    const p = await panel()
    expect(within(p).getByTestId('estado-colchon')).toHaveTextContent('Sin confirmación de la Pico.')
    expect(await within(p).findByText('Todavía no hay configuración guardada.')).toBeInTheDocument()
    expect(await within(p).findByText('Todavía no hay eventos del colchón.')).toBeInTheDocument()
    expect(within(p).getByLabelText(/Duración del monitoreo/)).toHaveValue('')
  })

  it('no muestra el peso: ni lecturas ni el último peso de la alarma', async () => {
    abrir({
      ordenes: {
        obtenerEstado: () =>
          ok({
            estado: { colchon: 'alarma', referencia_g: 1000, ultimo_peso_g: 890 },
            actualizado_en: '2999-11-18T14:15:00Z',
          }),
      },
    })
    const p = await panel()
    await waitFor(() => expect(within(p).getByTestId('estado-colchon')).toHaveTextContent('ALARMA'))
    expect(p.textContent).not.toContain('890')
  })

  it.each([
    [{ colchon: 'activo', referencia_g: 1000 }, /Monitoreo activo\. Referencia medida por la Pico: 1000 g\. Informado por la Pico el .*08:15:00/],
    [{ colchon: 'alarma', referencia_g: 1000 }, /ALARMA: el peso bajó más que la tolerancia\. Informado por la Pico el .*08:15:00/],
    [{ colchon: 'detenido', motivo: 'boton' }, /Monitoreo detenido con el botón\. Informado por la Pico el .*08:15:00/],
    [{ colchon: 'detenido', motivo: 'wifi' }, /Monitoreo detenido por pérdida de WiFi/],
    [{ colchon: 'detenido', motivo: 'reinicio' }, /Monitoreo detenido al reiniciarse o reconectarse el módulo/],
    [{ colchon: 'detenido', motivo: 'app' }, /Monitoreo detenido desde la app/],
    [{ colchon: 'detenido', motivo: 'temporizador' }, /al terminar el tiempo de la alarma/],
    [{ colchon: 'detenido', motivo: 'duracion' }, /al terminar la duración/],
  ])('el estado %j se muestra con texto y hora de Costa Rica', async (estado, texto) => {
    abrir({
      ordenes: { obtenerEstado: () => ok({ estado, actualizado_en: '2999-11-18T14:15:00Z' }) },
    })
    const p = await panel()
    await waitFor(() => expect(within(p).getByTestId('estado-colchon')).toHaveTextContent(texto))
  })

  it('un estado desconocido se muestra como sin confirmación', async () => {
    abrir({
      ordenes: {
        obtenerEstado: () => ok({ estado: { colchon: 'inventado' }, actualizado_en: '2999-11-18T14:15:00Z' }),
      },
    })
    const p = await panel()
    await within(p).findByText('Todavía no hay eventos del colchón.')
    expect(within(p).getByTestId('estado-colchon')).toHaveTextContent('Sin confirmación de la Pico.')
  })

  it('lista los eventos con hora de Costa Rica', async () => {
    const eventos: EventoColchon[] = [
      { event_id: 'e2', tipo: 'colchon_detenido', descripcion: 'Monitoreo del colchón detenido con el botón', ts: '2999-11-18T14:20:00Z' },
      { event_id: 'e1', tipo: 'alarma_colchon', descripcion: 'Alarma del colchón: el peso bajó más que la tolerancia', ts: '2999-11-18T14:15:00Z' },
    ]
    abrir({ colchon: { listarEventos: () => ok(eventos) } })
    const p = await panel()
    const items = await within(p).findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(/detenido con el botón · .*08:20:00/)
    expect(items[1]).toHaveTextContent(/Alarma del colchón.* · .*08:15:00/)
  })

  it('un fallo al consultar eventos se muestra', async () => {
    abrir({ colchon: { listarEventos: () => falla('x') } })
    const p = await panel()
    expect(await within(p).findByRole('alert')).toHaveTextContent('No se pudieron consultar los eventos del colchón.')
  })
})

describe('Colchón: configuración', () => {
  const campo = (p: HTMLElement, nombre: RegExp) => within(p).getByLabelText(nombre)
  const escribir = (p: HTMLElement, duracion: string, tolerancia: string, alarma: string) => {
    fireEvent.change(campo(p, /Duración del monitoreo/), { target: { value: duracion } })
    fireEvent.change(campo(p, /Tolerancia/), { target: { value: tolerancia } })
    fireEvent.change(campo(p, /Duración de la alarma/), { target: { value: alarma } })
  }

  it('guarda una configuración válida y muestra la guardada', async () => {
    const guardarConfig = vi.fn((_d: string, c: ConfigColchon) => ok(c))
    abrir({ colchon: { guardarConfig } })
    const p = await panel()
    await within(p).findByText('Todavía no hay configuración guardada.')
    escribir(p, '600', '12,5', '30')
    fireEvent.click(within(p).getByRole('button', { name: 'Guardar configuración' }))
    await waitFor(() =>
      expect(guardarConfig).toHaveBeenCalledWith('cuna-colchon-01', {
        duracion_s: 600,
        tolerancia_pct: 12.5,
        alarma_s: 30,
      }),
    )
    expect(await within(p).findByText('Configuración guardada.')).toBeInTheDocument()
  })

  it('carga la configuración guardada en los campos', async () => {
    abrir({ colchon: { obtenerConfig: () => ok(CONFIG) } })
    const p = await panel()
    await waitFor(() => expect(campo(p, /Duración del monitoreo/)).toHaveValue('300'))
    expect(campo(p, /Tolerancia/)).toHaveValue('10')
    expect(campo(p, /Duración de la alarma/)).toHaveValue('60')
  })

  it.each([
    ['0', '10', '60', MENSAJE_CONFIG_DURACION],
    ['86401', '10', '60', MENSAJE_CONFIG_DURACION],
    ['1.5', '10', '60', MENSAJE_CONFIG_DURACION],
    ['', '10', '60', MENSAJE_CONFIG_DURACION],
    ['300', '0', '60', MENSAJE_CONFIG_TOLERANCIA],
    ['300', '100', '60', MENSAJE_CONFIG_TOLERANCIA],
    ['300', 'mucha', '60', MENSAJE_CONFIG_TOLERANCIA],
    ['300', '10', '0', MENSAJE_CONFIG_ALARMA],
    ['300', '10', '61', MENSAJE_CONFIG_ALARMA],
    ['300', '10', '', MENSAJE_CONFIG_ALARMA],
  ])('%s, %s, %s se rechaza sin llamar al servicio', async (d, t, a, mensaje) => {
    const guardarConfig = vi.fn((_d: string, c: ConfigColchon) => ok(c))
    abrir({ colchon: { guardarConfig, obtenerConfig: () => ok(CONFIG) } })
    const p = await panel()
    await waitFor(() => expect(campo(p, /Duración del monitoreo/)).toHaveValue('300'))
    escribir(p, d, t, a)
    fireEvent.click(within(p).getByRole('button', { name: 'Guardar configuración' }))
    expect(await within(p).findByRole('alert')).toHaveTextContent(mensaje)
    expect(guardarConfig).not.toHaveBeenCalled()
  })

  it('un rechazo del servidor se muestra', async () => {
    abrir({
      colchon: {
        guardarConfig: () => falla('La configuración no es válida: revisa la duración, la tolerancia y la alarma.'),
      },
    })
    const p = await panel()
    await within(p).findByText('Todavía no hay configuración guardada.')
    escribir(p, '300', '10', '60')
    fireEvent.click(within(p).getByRole('button', { name: 'Guardar configuración' }))
    expect(await within(p).findByRole('alert')).toHaveTextContent('La configuración no es válida')
  })
})

describe('Colchón: controles', () => {
  it('sin la bandera no hay controles que aparenten operar hardware', async () => {
    abrir({ colchon: { obtenerConfig: () => ok(CONFIG) } })
    const p = await panel()
    await within(p).findByText('Todavía no hay eventos del colchón.')
    for (const nombre of ['Activar monitoreo', 'Detener monitoreo', /Rearmar/]) {
      expect(within(p).queryByRole('button', { name: nombre })).not.toBeInTheDocument()
    }
  })

  it('activar exige una configuración guardada', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir()
    const p = await panel()
    await within(p).findByText('Guarda la configuración para poder activar el monitoreo.')
    expect(within(p).getByRole('button', { name: 'Activar monitoreo' })).toBeDisabled()
    expect(within(p).getByRole('button', { name: /Rearmar/ })).toBeDisabled()
    expect(within(p).getByRole('button', { name: 'Detener monitoreo' })).toBeEnabled()
  })

  it('activar manda la configuración guardada y no cambia el estado hasta que la Pico informe', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden()))
    abrir({ colchon: { obtenerConfig: () => ok(CONFIG) }, ordenes: { solicitar } })
    const p = await panel()
    const boton = within(p).getByRole('button', { name: 'Activar monitoreo' })
    await waitFor(() => expect(boton).toBeEnabled())
    fireEvent.click(boton)
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-colchon-01', {
        command: 'mattress_arm',
        params: { duration_s: 300, tolerance_pct: 10, alarm_s: 60 },
      }),
    )
    expect(await within(p).findByText(/Solicitud registrada/)).toBeInTheDocument()
    expect(within(p).getByTestId('estado-colchon')).toHaveTextContent('Sin confirmación de la Pico.')
  })

  it('detener y rearmar mandan sus comandos', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden({ command: 'mattress_stop' })))
    abrir({ colchon: { obtenerConfig: () => ok(CONFIG) }, ordenes: { solicitar } })
    const p = await panel()
    await waitFor(() => expect(within(p).getByRole('button', { name: /Rearmar/ })).toBeEnabled())
    fireEvent.click(within(p).getByRole('button', { name: 'Detener monitoreo' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-colchon-01', { command: 'mattress_stop', params: {} }),
    )
    await waitFor(() => expect(within(p).getByRole('button', { name: 'Detener monitoreo' })).toBeEnabled())
    fireEvent.click(within(p).getByRole('button', { name: /Rearmar/ }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-colchon-01', {
        command: 'mattress_rearm',
        params: { duration_s: 300, tolerance_pct: 10, alarm_s: 60 },
      }),
    )
  })

  it('un fallo al solicitar se muestra y no inventa una orden', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir({ ordenes: { solicitar: () => falla('No tienes permiso para esta operación.') } })
    const p = await panel()
    fireEvent.click(await within(p).findByRole('button', { name: 'Detener monitoreo' }))
    expect(await within(p).findByText('No tienes permiso para esta operación.')).toBeInTheDocument()
    expect(within(p).getByText('No hay órdenes registradas.')).toBeInTheDocument()
  })
})
