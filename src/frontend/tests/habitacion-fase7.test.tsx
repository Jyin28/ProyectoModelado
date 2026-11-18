import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { EventoHabitacion, FotoHabitacion } from '../src/models/habitacion.ts'
import type { EstadoModulo, OrdenModulo } from '../src/models/ordenes.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type {
  Resultado,
  Servicios,
  ServicioHabitacion,
  ServicioHorarios,
  ServicioOrdenes,
} from '../src/services/tipos.ts'

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })
const falla = <T,>(error: string): Promise<Resultado<T>> => Promise.resolve({ ok: false, error })

const SIN_ESTADO: EstadoModulo = { estado: {}, actualizado_en: null }

function orden(extra: Partial<OrdenModulo> = {}): OrdenModulo {
  return {
    command_id: 'c-1',
    device_id: 'cuna-habitacion-01',
    command: 'room_monitor_set',
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

const PUERTA: EventoHabitacion = {
  event_id: 'ev-1',
  tipo: 'puerta',
  descripcion: 'Se abrió la puerta de la habitación',
  ts: '2999-11-18T14:15:00Z',
}
const MOVIMIENTO: EventoHabitacion = {
  event_id: 'ev-2',
  tipo: 'movimiento_habitacion',
  descripcion: 'Se detectó movimiento en la habitación',
  ts: '2999-11-18T14:20:00Z',
}
const base = { ruta: null, motivo: null, resuelta_en: null } as const
const FOTO_GUARDADA: FotoHabitacion = {
  event_id: 'ev-1',
  estado: 'guardada',
  ruta: 'cuna-habitacion-01/ev-1.jpg',
  motivo: null,
  solicitada_en: '2999-11-18T14:15:01Z',
  resuelta_en: '2999-11-18T14:16:00Z',
}
const FOTO_PENDIENTE: FotoHabitacion = {
  ...base,
  event_id: 'ev-2',
  estado: 'pendiente',
  solicitada_en: '2999-11-18T14:20:01Z',
}

type Parciales = {
  habitacion?: Partial<ServicioHabitacion>
  ordenes?: Partial<ServicioOrdenes>
  horarios?: Partial<ServicioHorarios>
}

function abrir(p: Parciales = {}, ruta = '/habitacion', backend = true) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    habitacion: {
      listarEventos: () => ok([]),
      listarFotos: () => ok([]),
      urlFoto: () => falla('x'),
      subirFoto: () => falla('x'),
      marcarFallida: () => falla('x'),
      ...p.habitacion,
    },
    ordenes: {
      solicitar: () => falla('x'),
      obtenerUltimaOrden: () => ok(null),
      obtenerEstado: () => ok(SIN_ESTADO),
      ...p.ordenes,
    },
    horarios: {
      listar: () => ok([]),
      reemplazar: (_d, _t, horas) => ok(horas),
      ...p.horarios,
    },
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

const eventos = () => screen.findByRole('region', { name: 'Eventos de la habitación' })
const monitoreo = () => screen.findByRole('region', { name: 'Monitoreo de la habitación' })

afterEach(() => vi.unstubAllEnvs())

describe('Habitación: pantalla', () => {
  it('sin backend no muestra paneles ni datos', async () => {
    abrir({}, '/habitacion', false)
    expect(await screen.findByRole('heading', { name: 'Habitación' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Eventos de la habitación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Monitoreo de la habitación' })).not.toBeInTheDocument()
  })

  it('el menú principal enlaza la habitación', async () => {
    abrir()
    expect(await screen.findByRole('link', { name: 'Habitación' })).toHaveAttribute('href', '/habitacion')
  })

  it('sin datos reales no inventa eventos ni fotos', async () => {
    abrir()
    const p = await eventos()
    expect(await within(p).findByText('Todavía no hay eventos de la habitación.')).toBeInTheDocument()
    expect(within(p).queryByRole('listitem')).not.toBeInTheDocument()
    expect(within(p).queryByRole('img')).not.toBeInTheDocument()
  })

  it('lista los eventos con hora de Costa Rica y el estado de cada foto', async () => {
    abrir({
      habitacion: {
        listarEventos: () => ok([MOVIMIENTO, PUERTA]),
        listarFotos: () => ok([FOTO_PENDIENTE, FOTO_GUARDADA]),
      },
    })
    const p = await eventos()
    const items = await within(p).findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(/Se detectó movimiento en la habitación · .*08:20:00/)
    expect(within(items[0]).getByTestId('foto-ev-2')).toHaveTextContent('Foto pendiente: esperando la cámara.')
    expect(items[1]).toHaveTextContent(/Se abrió la puerta de la habitación · .*08:15:00/)
    expect(within(items[1]).getByTestId('foto-ev-1')).toHaveTextContent('Foto guardada.')
    // Sin foto abierta no hay imagen en la pantalla.
    expect(within(p).queryByRole('img')).not.toBeInTheDocument()
  })

  it('una foto fallida dice por qué', async () => {
    abrir({
      habitacion: {
        listarEventos: () => ok([PUERTA]),
        listarFotos: () =>
          ok([
            {
              ...base,
              event_id: 'ev-1',
              estado: 'fallida',
              motivo: 'camara_no_disponible',
              solicitada_en: '2999-11-18T14:15:01Z',
              resuelta_en: '2999-11-18T14:17:00Z',
            },
          ]),
      },
    })
    const p = await eventos()
    expect(await within(p).findByTestId('foto-ev-1')).toHaveTextContent(
      'No se tomó la foto: la cámara no estuvo disponible.',
    )
  })

  it('un fallo al consultar se muestra', async () => {
    abrir({ habitacion: { listarEventos: () => falla('x') } })
    const p = await eventos()
    expect(await within(p).findByRole('alert')).toHaveTextContent(
      'No se pudieron consultar los eventos de la habitación.',
    )
  })

  it('«Ver foto» pide el enlace de la ruta guardada y muestra la imagen; «Ocultar foto» la quita', async () => {
    const urlFoto = vi.fn(() => ok('https://almacen.test/firmada'))
    abrir({
      habitacion: { listarEventos: () => ok([PUERTA]), listarFotos: () => ok([FOTO_GUARDADA]), urlFoto },
    })
    const p = await eventos()
    fireEvent.click(await within(p).findByRole('button', { name: 'Ver foto' }))
    const imagen = await within(p).findByRole('img')
    expect(urlFoto).toHaveBeenCalledWith('cuna-habitacion-01/ev-1.jpg')
    expect(imagen).toHaveAttribute('src', 'https://almacen.test/firmada')
    expect(imagen).toHaveAccessibleName(/Fotografía del evento del .*08:15:00/)
    fireEvent.click(within(p).getByRole('button', { name: 'Ocultar foto' }))
    expect(within(p).queryByRole('img')).not.toBeInTheDocument()
  })

  it('si no se puede abrir la foto, lo dice y no muestra imagen', async () => {
    abrir({
      habitacion: {
        listarEventos: () => ok([PUERTA]),
        listarFotos: () => ok([FOTO_GUARDADA]),
        urlFoto: () => falla('No se pudo abrir la fotografía.'),
      },
    })
    const p = await eventos()
    fireEvent.click(await within(p).findByRole('button', { name: 'Ver foto' }))
    expect(await within(p).findByText('No se pudo abrir la fotografía.')).toBeInTheDocument()
    expect(within(p).queryByRole('img')).not.toBeInTheDocument()
  })

  it('las fotos pendientes o fallidas no ofrecen «Ver foto»', async () => {
    abrir({ habitacion: { listarEventos: () => ok([MOVIMIENTO]), listarFotos: () => ok([FOTO_PENDIENTE]) } })
    const p = await eventos()
    await within(p).findByTestId('foto-ev-2')
    expect(within(p).queryByRole('button', { name: 'Ver foto' })).not.toBeInTheDocument()
  })
})

describe('Habitación: controles', () => {
  it('sin la bandera no hay controles que aparenten operar hardware', async () => {
    abrir()
    await eventos()
    expect(screen.queryByRole('region', { name: 'Monitoreo de la habitación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Activar monitoreo/ })).not.toBeInTheDocument()
  })

  it('sin confirmación no inventa el estado de ningún sensor', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir()
    const p = await monitoreo()
    expect(within(p).getByTestId('estado-puerta')).toHaveTextContent('Sin confirmación de la Pico.')
    expect(within(p).getByTestId('estado-movimiento')).toHaveTextContent('Sin confirmación de la Pico.')
  })

  it('cada sensor muestra solo su propio estado confirmado, con hora de Costa Rica', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir({
      ordenes: {
        obtenerEstado: () =>
          ok({ estado: { monitoreo_puerta: true }, actualizado_en: '2999-11-18T14:15:00Z' }),
      },
    })
    const p = await monitoreo()
    await waitFor(() =>
      expect(within(p).getByTestId('estado-puerta')).toHaveTextContent(
        /Monitoreo activado, confirmado por la Pico el .*08:15:00/,
      ),
    )
    expect(within(p).getByTestId('estado-movimiento')).toHaveTextContent('Sin confirmación de la Pico.')
  })

  it.each([
    ['Activar monitoreo de puerta', { sensor: 'puerta', enabled: true }],
    ['Desactivar monitoreo de puerta', { sensor: 'puerta', enabled: false }],
    ['Activar monitoreo de movimiento', { sensor: 'movimiento', enabled: true }],
    ['Desactivar monitoreo de movimiento', { sensor: 'movimiento', enabled: false }],
  ])('«%s» manda room_monitor_set y no cambia el estado hasta que la Pico confirme', async (nombre, params) => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const solicitar = vi.fn(() => ok(orden()))
    abrir({ ordenes: { solicitar } })
    const p = await monitoreo()
    fireEvent.click(within(p).getByRole('button', { name: nombre }))
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('cuna-habitacion-01', { command: 'room_monitor_set', params }),
    )
    expect(await within(p).findByText(/Solicitud registrada/)).toBeInTheDocument()
    expect(within(p).getByTestId('estado-puerta')).toHaveTextContent('Sin confirmación de la Pico.')
    expect(within(p).getByTestId('estado-movimiento')).toHaveTextContent('Sin confirmación de la Pico.')
  })

  it('un fallo al solicitar se muestra y no inventa una orden', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir({ ordenes: { solicitar: () => falla('No tienes permiso para esta operación.') } })
    const p = await monitoreo()
    fireEvent.click(within(p).getByRole('button', { name: 'Activar monitoreo de puerta' }))
    expect(await within(p).findByText('No tienes permiso para esta operación.')).toBeInTheDocument()
    expect(within(p).getByText('No hay órdenes registradas.')).toBeInTheDocument()
  })

  it('cada sensor tiene sus horarios de activar y desactivar', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const listar = vi.fn((_d: string, _t: string) => ok<string[]>([]))
    abrir({ horarios: { listar } })
    await monitoreo()
    await waitFor(() => {
      const tipos = listar.mock.calls.map((c) => c[1]).sort()
      expect(tipos).toEqual([
        'habitacion_movimiento_activar',
        'habitacion_movimiento_desactivar',
        'habitacion_puerta_activar',
        'habitacion_puerta_desactivar',
      ])
    })
    expect(listar.mock.calls.every((c) => c[0] === 'cuna-habitacion-01')).toBe(true)
  })
})

describe('Habitación: cámara del teléfono', () => {
  const pendiente = (p: Parciales['habitacion'] = {}) => ({
    listarEventos: () => ok([MOVIMIENTO, PUERTA]),
    listarFotos: () => ok([FOTO_PENDIENTE, FOTO_GUARDADA]),
    ...p,
  })

  it('sin la bandera dice que no está habilitada y no lista fotos', async () => {
    abrir({ habitacion: pendiente() }, '/habitacion/camara')
    expect(await screen.findByText('La cámara del teléfono no está habilitada en esta instalación.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Cámara de la habitación' })).not.toBeInTheDocument()
  })

  it('la pantalla de la habitación ofrece el enlace solo con la bandera', async () => {
    abrir()
    await eventos()
    expect(screen.queryByRole('link', { name: /como cámara/ })).not.toBeInTheDocument()
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    abrir()
    expect(await screen.findByRole('link', { name: /como cámara/ })).toHaveAttribute('href', '/habitacion/camara')
  })

  it('lista solo las fotos sin resolver, con su evento', async () => {
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    abrir({ habitacion: pendiente() }, '/habitacion/camara')
    const p = await screen.findByRole('region', { name: 'Cámara de la habitación' })
    const items = await within(p).findAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent(/Se detectó movimiento en la habitación · .*08:20:00/)
    expect(items[0]).toHaveTextContent('Foto pendiente: esperando la cámara.')
  })

  it('sin fotos pendientes lo dice', async () => {
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    abrir({ habitacion: pendiente({ listarFotos: () => ok([FOTO_GUARDADA]) }) }, '/habitacion/camara')
    const p = await screen.findByRole('region', { name: 'Cámara de la habitación' })
    expect(await within(p).findByText('No hay fotos pendientes.')).toBeInTheDocument()
  })

  it('subir la foto llama al servicio con el evento y el archivo, y avisa el resultado', async () => {
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    const subirFoto = vi.fn((_d: string, _e: string, _a: Blob) => ok(null))
    abrir({ habitacion: pendiente({ subirFoto }) }, '/habitacion/camara')
    const p = await screen.findByRole('region', { name: 'Cámara de la habitación' })
    const campo = await within(p).findByLabelText(/Tomar o elegir foto de/)
    expect(campo).toHaveAttribute('accept', 'image/jpeg,image/png')
    expect(campo).toHaveAttribute('capture', 'environment')
    const archivo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(campo, { target: { files: [archivo] } })
    await waitFor(() => expect(subirFoto).toHaveBeenCalledWith('cuna-habitacion-01', 'ev-2', archivo))
    expect(await within(p).findByText('Foto guardada.')).toBeInTheDocument()
  })

  it('un error al subir se muestra con el mensaje del servicio', async () => {
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    abrir(
      { habitacion: pendiente({ subirFoto: () => falla('La foto debe ser JPEG o PNG.') }) },
      '/habitacion/camara',
    )
    const p = await screen.findByRole('region', { name: 'Cámara de la habitación' })
    const campo = await within(p).findByLabelText(/Tomar o elegir foto de/)
    fireEvent.change(campo, { target: { files: [new File(['x'], 'v.mp4', { type: 'video/mp4' })] } })
    expect(await within(p).findByRole('alert')).toHaveTextContent('La foto debe ser JPEG o PNG.')
  })

  it('«No se pudo tomar» deja constancia de que la cámara no estuvo disponible', async () => {
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    const marcarFallida = vi.fn((_e: string, _m: string) => ok(null))
    abrir({ habitacion: pendiente({ marcarFallida }) }, '/habitacion/camara')
    const p = await screen.findByRole('region', { name: 'Cámara de la habitación' })
    fireEvent.click(await within(p).findByRole('button', { name: /No se pudo tomar la foto de/ }))
    await waitFor(() => expect(marcarFallida).toHaveBeenCalledWith('ev-2', 'camara_no_disponible'))
    expect(
      await within(p).findByText('Quedó registrado que la cámara no estuvo disponible.'),
    ).toBeInTheDocument()
  })

  it('una foto fallida se puede reintentar pero no vuelve a marcarse como fallida', async () => {
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    const fallida: FotoHabitacion = {
      ...base,
      event_id: 'ev-2',
      estado: 'fallida',
      motivo: 'carga_fallida',
      solicitada_en: '2999-11-18T14:20:01Z',
      resuelta_en: '2999-11-18T14:21:00Z',
    }
    abrir({ habitacion: pendiente({ listarFotos: () => ok([fallida]) }) }, '/habitacion/camara')
    const p = await screen.findByRole('region', { name: 'Cámara de la habitación' })
    expect(await within(p).findByLabelText(/Tomar o elegir foto de/)).toBeInTheDocument()
    expect(within(p).getByText(/no se pudo subir la imagen/)).toBeInTheDocument()
    expect(within(p).queryByRole('button', { name: /No se pudo tomar/ })).not.toBeInTheDocument()
  })
})
