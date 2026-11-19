import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { EstadoModulo, LimitesAmbiente, OrdenModulo } from '../src/models/ordenes.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type {
  Resultado,
  Servicios,
  ServicioHorarios,
  ServicioLimites,
  ServicioOrdenes,
  ServicioVoz,
  SesionVoz,
} from '../src/services/tipos.ts'
import { MENSAJE_INTERVALO } from '../src/utils/ordenes.ts'
import { MENSAJE_CONTEXTO_INSEGURO, MENSAJE_SIN_MICROFONO } from '../src/hooks/useVoz.ts'
import type { Capturador } from '../src/utils/voz.ts'
import { abrirFuncion } from './ayudas.ts'

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })
const falla = <T,>(error: string): Promise<Resultado<T>> => Promise.resolve({ ok: false, error })

const figuras = async () => {
  await abrirFuncion('Secuencias e intervalo')
  return screen.findByRole('region', { name: 'Control de las figuras' })
}

async function regionDe(funcion: string, region: string) {
  await abrirFuncion(funcion)
  return screen.findByRole('region', { name: region })
}

const SIN_ESTADO: EstadoModulo = { estado: {}, actualizado_en: null }

function orden(extra: Partial<OrdenModulo> = {}): OrdenModulo {
  return {
    command_id: 'c-1',
    device_id: 'cuna-figuras-01',
    command: 'led_all',
    params: { on: true },
    creado_en: '2999-11-18T10:00:00Z',
    vence_en: '2999-11-18T10:00:15Z',
    estado: 'pendiente',
    entregado_en: null,
    confirmado_en: null,
    error: null,
    ...extra,
  }
}

type Parciales = {
  ordenes?: Partial<ServicioOrdenes>
  limites?: Partial<ServicioLimites>
  horarios?: Partial<ServicioHorarios>
  voz?: Partial<ServicioVoz>
}

function abrir(ruta: string, p: Parciales = {}, backend = true) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    ordenes: {
      solicitar: () => falla('x'),
      obtenerUltimaOrden: () => ok(null),
      obtenerEstado: () => ok(SIN_ESTADO),
      ...p.ordenes,
    },
    limites: { obtener: () => ok(null), guardar: () => falla('x'), ...p.limites },
    horarios: { listar: () => ok([]), reemplazar: (_d, _t, h) => ok(h), ...p.horarios },
    voz: { abrir: () => falla('x'), registrarActividad: () => ok(null), ...p.voz },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => ok({ usuario_id: 'u-1', correo: 'ana@ejemplo.test' }),
    },
  }
  return render(
    <ProveedorServicios configurado={backend} servicios={servicios}>
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

afterEach(() => vi.unstubAllEnvs())

describe('Figuras LED', () => {
  it('sin la bandera no hay controles que aparenten operar hardware', async () => {
    abrir('/figuras')
    expect(await screen.findByRole('heading', { name: 'Figuras LED' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Control de las figuras' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encender todos' })).not.toBeInTheDocument()
  })

  it('una solicitud no cambia el estado: sigue «Sin confirmación» hasta que la Pico confirme', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden()))
    abrir('/figuras', { ordenes: { solicitar } })
    const panel = await figuras()
    expect(await within(panel).findByText('Sin confirmación de la Pico.')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Encender todos' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-figuras-01', { command: 'led_all', params: { on: true } }),
    )
    expect(await within(panel).findByText(/Solicitud registrada/)).toBeInTheDocument()
    expect(within(panel).getByText('Sin confirmación de la Pico.')).toBeInTheDocument()
  })

  it('muestra la secuencia solo si la Pico la confirmó', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir('/figuras', {
      ordenes: {
        obtenerEstado: () =>
          ok({ estado: { secuencia: 'chase' }, actualizado_en: '2999-11-18T10:00:00Z' }),
      },
    })
    const panel = await figuras()
    expect(
      await within(panel).findByText(/Secuencia activa confirmada por la Pico: Persecución/),
    ).toBeInTheDocument()
  })

  it('rechaza un intervalo menor que 2 s sin llamar al servicio (CA-13.4)', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden()))
    abrir('/figuras', { ordenes: { solicitar } })
    const panel = await figuras()
    const campo = within(panel).getByLabelText(/Intervalo entre pasos/)
    for (const malo of ['', '1', '1.9', '3601', 'abc']) {
      fireEvent.change(campo, { target: { value: malo } })
      fireEvent.click(within(panel).getByRole('button', { name: 'Iniciar secuencia' }))
      expect(await within(panel).findByText(MENSAJE_INTERVALO)).toBeInTheDocument()
    }
    expect(solicitar).not.toHaveBeenCalled()

    fireEvent.change(campo, { target: { value: '2' } })
    const formulario = within(panel).getByRole('form', { name: 'Secuencia' })
    fireEvent.change(within(formulario).getAllByRole('combobox')[0], { target: { value: 'blink_all' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Iniciar secuencia' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-figuras-01', {
        command: 'led_sequence',
        params: { name: 'blink_all', step_s: 2 },
      }),
    )
  })

  it('la perilla del intervalo solo cambia el borrador; la orden sale con «Iniciar secuencia»', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden({ command: 'led_sequence', params: { name: 'chase', step_s: 5 } })))
    abrir('/figuras', { ordenes: { solicitar } })
    const panel = await figuras()
    const perilla = within(panel).getByRole('slider', { name: 'Perilla del intervalo' })
    expect(within(panel).getByText('Intervalo elegido: sin elegir')).toBeInTheDocument()

    fireEvent.keyDown(perilla, { key: 'Home' }) // 2 s
    fireEvent.keyDown(perilla, { key: 'ArrowUp' })
    fireEvent.keyDown(perilla, { key: 'ArrowUp' })
    fireEvent.keyDown(perilla, { key: 'ArrowUp' }) // 5 s
    expect(perilla).toHaveAttribute('aria-valuenow', '5')
    expect(perilla).toHaveAttribute('aria-valuetext', '5 s')
    expect(within(panel).getByLabelText(/Intervalo entre pasos/)).toHaveValue('5')
    fireEvent.click(within(panel).getByRole('button', { name: 'Aumentar 1 s' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Disminuir 1 s' }))
    expect(within(panel).getByText('Intervalo elegido: 5 s')).toBeInTheDocument()
    expect(solicitar).not.toHaveBeenCalled()

    fireEvent.click(within(panel).getByRole('button', { name: 'Iniciar secuencia' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-figuras-01', {
        command: 'led_sequence',
        params: { name: 'chase', step_s: 5 },
      }),
    )
    expect(solicitar).toHaveBeenCalledTimes(1)
    // Lo solicitado se muestra, pero la Pico no informa el intervalo: nada aparece como confirmado.
    expect(await within(panel).findByText(/Última secuencia solicitada: Persecución.*cada 5 s/)).toBeInTheDocument()
    expect(within(panel).getByText('Sin confirmación de la Pico.')).toBeInTheDocument()
  })

  it('arrastrar la perilla no envía órdenes', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden()))
    abrir('/figuras', { ordenes: { solicitar } })
    const panel = await figuras()
    const perilla = within(panel).getByRole('slider', { name: 'Perilla del intervalo' })
    perilla.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    fireEvent.pointerDown(perilla, { pointerId: 1, clientX: 50, clientY: 0 })
    fireEvent.pointerMove(perilla, { pointerId: 1, clientX: 100, clientY: 50 })
    fireEvent.pointerUp(perilla, { pointerId: 1, clientX: 100, clientY: 50 })
    expect(Number(perilla.getAttribute('aria-valuenow'))).toBeGreaterThan(2)
    expect(within(panel).getByLabelText(/Intervalo entre pasos/)).not.toHaveValue('')
    expect(solicitar).not.toHaveBeenCalled()
  })

  it('un fallo al solicitar se muestra y no inventa una orden', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir('/figuras', { ordenes: { solicitar: () => falla('No tienes permiso para esta operación.') } })
    const panel = await figuras()
    fireEvent.click(await within(panel).findByRole('button', { name: 'Apagar todos' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('No tienes permiso')
    expect(within(panel).getByText('No hay órdenes registradas.')).toBeInTheDocument()
  })

  it('sin backend configurado el panel no muestra nada', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir('/figuras', {}, false)
    expect(await screen.findByRole('heading', { name: 'Figuras LED' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Control de las figuras' })).not.toBeInTheDocument()
  })

  it('los horarios se guardan en el servidor y se muestran los guardados', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const reemplazar = vi.fn((_d: string, _t: string, h: string[]) => ok(h))
    abrir('/figuras', {
      horarios: { listar: (_d, tipo) => ok(tipo === 'figuras_encender' ? ['20:00'] : []), reemplazar },
    })
    await abrirFuncion('Horarios')
    const grupo = await screen.findByRole('group', { name: 'Encender figuras' })
    expect(await within(grupo).findByText('20:00')).toBeInTheDocument()
    // Las ruedas de hora y minutos empiezan en 08:00; se llevan a 06:30 tocando una fila de cada una.
    fireEvent.click(within(grupo).getByRole('option', { name: 'Hora 06' }))
    fireEvent.click(within(grupo).getByRole('option', { name: 'Minutos 30' }))
    fireEvent.click(within(grupo).getByRole('button', { name: /Agregar hora/ }))
    fireEvent.click(within(grupo).getByRole('button', { name: /Guardar horarios/ }))
    await waitFor(() =>
      expect(reemplazar).toHaveBeenCalledWith('cuna-figuras-01', 'figuras_encender', ['06:30', '20:00']),
    )
    expect(within(grupo).getByText(/hora de Costa Rica/i)).toBeInTheDocument()
  })
})

describe('Monitoreo de movimiento y audio', () => {
  it('el monitoreo se muestra activado solo con la confirmación de la Pico (CA-08.2)', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden({ device_id: 'cuna-movimiento-01', command: 'motion_set' })))
    abrir('/cuna', { ordenes: { solicitar } })
    const panel = await regionDe('Sensor de movimiento', 'Monitoreo de movimiento')
    expect(await within(panel).findByText('Sin confirmación de la Pico.')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Activar monitoreo' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-movimiento-01', {
        command: 'motion_set',
        params: { enabled: true },
      }),
    )
    expect(within(panel).getByText('Sin confirmación de la Pico.')).toBeInTheDocument()
  })

  it('con el monitoreo confirmado lo dice con la hora', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir('/cuna', {
      ordenes: {
        obtenerEstado: () =>
          ok({ estado: { monitoreo: true }, actualizado_en: '2999-11-18T14:15:00Z' }),
      },
    })
    const panel = await regionDe('Sensor de movimiento', 'Monitoreo de movimiento')
    expect(await within(panel).findByText(/Monitoreo activado, confirmado por la Pico el .*08:15:00/)).toBeInTheDocument()
  })

  it('el audio ofrece solo el catálogo real de la Pico', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden({ device_id: 'cuna-audio-01', command: 'audio_play' })))
    abrir('/cuna', { ordenes: { solicitar } })
    const panel = await regionDe('Parlante', 'Audio de la cuna')
    const opciones = within(within(panel).getByLabelText('Sonido')).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['Tono suave'])
    fireEvent.click(within(panel).getByRole('button', { name: 'Reproducir' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-audio-01', {
        command: 'audio_play',
        params: { sound: 'tono_suave' },
      }),
    )
    // El WAV de prueba ya no se ofrece en la web.
    expect(within(panel).queryByRole('option', { name: /prueba/i })).not.toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Detener audio' }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-audio-01', { command: 'audio_stop', params: {} }),
    )
  })

  it('sin la bandera no aparecen el audio ni el monitoreo', async () => {
    abrir('/cuna')
    expect(await screen.findByRole('heading', { name: 'Cuna' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Audio de la cuna' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Monitoreo de movimiento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Hablar a la cuna' })).not.toBeInTheDocument()
  })
})

describe('Límites de ambiente', () => {
  const campo = (panel: HTMLElement, nombre: RegExp) => within(panel).getByLabelText(nombre)
  const escribir = (panel: HTMLElement) =>
    fireEvent.click(within(panel).getByRole('button', { name: 'Escribir valores' }))
  const tirador = (panel: HTMLElement, nombre: string) => within(panel).getByRole('slider', { name: nombre })
  const pulsar = (el: HTMLElement, tecla: string, veces = 1) => {
    for (let i = 0; i < veces; i++) fireEvent.keyDown(el, { key: tecla })
  }

  it('sin límites guardados lo dice y no inventa valores (CA-10.1)', async () => {
    abrir('/cuna')
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    expect(await within(panel).findByText('Todavía no hay límites guardados.')).toBeInTheDocument()
    // Los deslizadores dicen «Sin elegir» y los valores escritos están ocultos hasta pedirlos.
    expect(tirador(panel, 'Límite inferior de temperatura')).toHaveAttribute('aria-valuetext', 'Sin elegir')
    expect(tirador(panel, 'Límite superior de humedad')).toHaveAttribute('aria-valuetext', 'Sin elegir')
    expect(within(panel).queryByLabelText(/Temperatura mínima/)).not.toBeInTheDocument()
    escribir(panel)
    expect(campo(panel, /Temperatura mínima/)).toHaveValue('')
  })

  it('los valores escritos se despliegan y se ocultan con el botón', async () => {
    abrir('/cuna')
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    const boton = await within(panel).findByRole('button', { name: 'Escribir valores' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(campo(panel, /Humedad máxima/)).toBeInTheDocument()
    fireEvent.click(boton)
    expect(within(panel).queryByLabelText(/Humedad máxima/)).not.toBeInTheDocument()
  })

  it('los deslizadores de dos extremos eligen el rango y se guarda lo que se ve (CA-10.1)', async () => {
    const guardar = vi.fn((_d: string, l: LimitesAmbiente) => ok(l))
    abrir('/cuna', { limites: { guardar } })
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    await within(panel).findByText('Todavía no hay límites guardados.')
    const tMin = tirador(panel, 'Límite inferior de temperatura')
    const tMax = tirador(panel, 'Límite superior de temperatura')
    pulsar(tMin, 'PageUp', 4) // 0 → 20 °C (cada Re Pág suma 10 pasos de 0,5)
    pulsar(tMax, 'PageDown', 4) // 50 → 30 °C
    pulsar(tMax, 'ArrowLeft', 8) // 30 → 26 °C
    pulsar(tirador(panel, 'Límite inferior de humedad'), 'PageUp', 4) // 0 → 40 %
    pulsar(tirador(panel, 'Límite superior de humedad'), 'PageDown', 4) // 100 → 60 %
    expect(tMin).toHaveAttribute('aria-valuetext', '20,0 °C')
    expect(tMax).toHaveAttribute('aria-valuetext', '26,0 °C')
    // El valor se ve también en los campos escritos.
    escribir(panel)
    expect(campo(panel, /Temperatura máxima/)).toHaveValue('26')
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar límites' }))
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith('cuna-ambiente-01', {
        temp_min: 20,
        temp_max: 26,
        hum_min: 40,
        hum_max: 60,
      }),
    )
    expect(await within(panel).findByText('Límites guardados.')).toBeInTheDocument()
  })

  it('un extremo nunca cruza al otro y mover uno deja los dos elegidos', async () => {
    abrir('/cuna')
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    await within(panel).findByText('Todavía no hay límites guardados.')
    const hMin = tirador(panel, 'Límite inferior de humedad')
    const hMax = tirador(panel, 'Límite superior de humedad')
    pulsar(hMax, 'Home') // el máximo no baja de mínimo + paso
    expect(hMax).toHaveAttribute('aria-valuenow', '1')
    expect(hMin).toHaveAttribute('aria-valuenow', '0')
    expect(hMin).toHaveAttribute('aria-valuetext', '0 %')
    pulsar(hMin, 'End') // el mínimo no sube de máximo - paso
    expect(hMin).toHaveAttribute('aria-valuenow', '0')
  })

  it('guarda límites válidos escritos a mano (CA-10.1, CA-10.3)', async () => {
    const guardar = vi.fn((_d: string, l: LimitesAmbiente) => ok(l))
    abrir('/cuna', { limites: { guardar } })
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    await within(panel).findByText('Todavía no hay límites guardados.')
    escribir(panel)
    fireEvent.change(campo(panel, /Temperatura mínima/), { target: { value: '20' } })
    fireEvent.change(campo(panel, /Temperatura máxima/), { target: { value: '26,5' } })
    fireEvent.change(campo(panel, /Humedad mínima/), { target: { value: '40' } })
    fireEvent.change(campo(panel, /Humedad máxima/), { target: { value: '60' } })
    expect(tirador(panel, 'Límite superior de temperatura')).toHaveAttribute('aria-valuenow', '26.5')
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar límites' }))
    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith('cuna-ambiente-01', {
        temp_min: 20,
        temp_max: 26.5,
        hum_min: 40,
        hum_max: 60,
      }),
    )
    expect(await within(panel).findByText('Límites guardados.')).toBeInTheDocument()
  })

  it('el mínimo igual o mayor que el máximo se rechaza sin llamar al servicio (CA-10.4)', async () => {
    const guardar = vi.fn((_d: string, l: LimitesAmbiente) => ok(l))
    abrir('/cuna', {
      limites: {
        guardar,
        obtener: () => ok({ temp_min: 20, temp_max: 26, hum_min: 40, hum_max: 60 }),
      },
    })
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    await waitFor(() =>
      expect(tirador(panel, 'Límite inferior de temperatura')).toHaveAttribute('aria-valuenow', '20'),
    )
    escribir(panel)
    fireEvent.change(campo(panel, /Temperatura mínima/), { target: { value: '30' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar límites' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('el mínimo debe ser menor que el máximo')
    expect(guardar).not.toHaveBeenCalled()
    // Lo guardado en el servidor no cambió: al recargar siguen los valores anteriores.
    expect(campo(panel, /Temperatura máxima/)).toHaveValue('26')
  })

  it('un rechazo del servidor se muestra', async () => {
    abrir('/cuna', {
      limites: { guardar: () => falla('Los límites no son válidos: el mínimo debe ser menor que el máximo y estar en rango.') },
    })
    const panel = await regionDe('Temperatura y humedad', 'Límites de ambiente')
    await within(panel).findByText('Todavía no hay límites guardados.')
    escribir(panel)
    for (const [n, v] of [[/Temperatura mínima/, '10'], [/Temperatura máxima/, '20'], [/Humedad mínima/, '30'], [/Humedad máxima/, '70']] as const) {
      fireEvent.change(campo(panel, n), { target: { value: v } })
    }
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar límites' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Los límites no son válidos')
  })
})

describe('Voz', () => {
  function sesionFalsa() {
    const sesion: SesionVoz & { enviar: ReturnType<typeof vi.fn>; cerrar: ReturnType<typeof vi.fn> } = {
      enviar: vi.fn(() => Promise.resolve(true)),
      cerrar: vi.fn(() => Promise.resolve()),
    }
    return sesion
  }

  function capturadorFalso() {
    const detener = vi.fn()
    let emitir: (pcm: Int16Array) => void = () => {}
    const capturador: Capturador = (alFragmento) => {
      emitir = alFragmento
      return Promise.resolve({ detener })
    }
    return { capturador, detener, emitir: (pcm: Int16Array) => emitir(pcm) }
  }

  // PanelVoz recibe el capturador por propiedad; se monta dentro de la página mediante
  // el módulo de captura real, que aquí se sustituye con vi.mock en cada prueba.
  async function conCaptura(c: Capturador, p: Parciales) {
    vi.stubEnv('VITE_VOZ_HABILITADA', 'true')
    const modulo = await import('../src/utils/voz.ts')
    vi.spyOn(modulo, 'capturarMicrofono').mockImplementation(c)
    return abrir('/cuna', p)
  }

  it('sin la bandera no hay botón de voz', async () => {
    abrir('/cuna')
    await screen.findByRole('heading', { name: 'Cuna' })
    expect(screen.queryByRole('button', { name: 'Hablar' })).not.toBeInTheDocument()
  })

  it('un fallo al abrir el canal se muestra y no se pide el micrófono', async () => {
    vi.stubEnv('VITE_VOZ_HABILITADA', 'true')
    const abrirCanal = vi.fn(() => falla<SesionVoz>('No se pudo abrir el canal de voz.'))
    abrir('/cuna', { voz: { abrir: abrirCanal } })
    const panel = await regionDe('Parlante', 'Hablar a la cuna')
    fireEvent.click(within(panel).getByRole('button', { name: 'Hablar' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('No se pudo abrir el canal de voz.')
    expect(abrirCanal).toHaveBeenCalledWith('cuna-01')
    expect(within(panel).getByRole('button', { name: 'Hablar' })).toBeEnabled()
  })

  it('el texto aclara que la voz no se guarda ni se probó con hardware real', async () => {
    vi.stubEnv('VITE_VOZ_HABILITADA', 'true')
    abrir('/cuna')
    const panel = await regionDe('Parlante', 'Hablar a la cuna')
    expect(within(panel).getByText(/no se graba ni se guarda/)).toBeInTheDocument()
    expect(within(panel).getByText(/Todavía no se probó/)).toBeInTheDocument()
  })

  it('en una dirección sin contexto seguro avisa de https y no abre el canal de voz', async () => {
    vi.stubEnv('VITE_VOZ_HABILITADA', 'true')
    const previo = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    try {
      const abrirCanal = vi.fn(() => ok<SesionVoz>(sesionFalsa()))
      abrir('/cuna', { voz: { abrir: abrirCanal } })
      const panel = await regionDe('Parlante', 'Hablar a la cuna')
      fireEvent.click(within(panel).getByRole('button', { name: 'Hablar' }))
      expect(await within(panel).findByRole('alert')).toHaveTextContent(MENSAJE_CONTEXTO_INSEGURO)
      expect(abrirCanal).not.toHaveBeenCalled()
      expect(within(panel).getByRole('button', { name: 'Hablar' })).toBeEnabled()
    } finally {
      if (previo) Object.defineProperty(window, 'isSecureContext', previo)
      else Reflect.deleteProperty(window, 'isSecureContext')
    }
  })

  it('sin permiso de micrófono cierra el canal y avisa', async () => {
    const sesion = sesionFalsa()
    const rechazo: Capturador = () => Promise.reject(new Error('denegado'))
    await conCaptura(rechazo, { voz: { abrir: () => ok<SesionVoz>(sesion) } })
    const panel = await regionDe('Parlante', 'Hablar a la cuna')
    fireEvent.click(within(panel).getByRole('button', { name: 'Hablar' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent(MENSAJE_SIN_MICROFONO)
    expect(sesion.cerrar).toHaveBeenCalled()
  })

  it('envía fragmentos numerados, registra la actividad y cierra al detener', async () => {
    const sesion = sesionFalsa()
    const falso = capturadorFalso()
    const registrarActividad = vi.fn(() => ok(null))
    await conCaptura(falso.capturador, { voz: { abrir: () => ok<SesionVoz>(sesion), registrarActividad } })
    const panel = await regionDe('Parlante', 'Hablar a la cuna')
    fireEvent.click(within(panel).getByRole('button', { name: 'Hablar' }))
    expect(await within(panel).findByRole('button', { name: 'Dejar de hablar' })).toBeInTheDocument()
    expect(registrarActividad).toHaveBeenCalledWith('cuna-audio-01', 'inicio')

    falso.emitir(new Int16Array(320).fill(1000))
    falso.emitir(new Int16Array(320).fill(-1000))
    expect(sesion.enviar).toHaveBeenCalledTimes(2)
    expect(sesion.enviar.mock.calls.map((c) => c[0])).toEqual([0, 1])
    expect(typeof sesion.enviar.mock.calls[0][1]).toBe('string')

    fireEvent.click(within(panel).getByRole('button', { name: 'Dejar de hablar' }))
    await waitFor(() => expect(sesion.cerrar).toHaveBeenCalled())
    expect(falso.detener).toHaveBeenCalled()
    expect(registrarActividad).toHaveBeenCalledWith('cuna-audio-01', 'fin')
    expect(await within(panel).findByRole('button', { name: 'Hablar' })).toBeInTheDocument()
  })
})
