import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { Toma } from '../src/models/alimentacion.ts'
import type { EstadoModulo, OrdenModulo } from '../src/models/ordenes.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type {
  Resultado,
  ServicioAlimentacion,
  Servicios,
  ServicioHorarios,
  ServicioOrdenes,
} from '../src/services/tipos.ts'

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })
const falla = <T,>(error: string): Promise<Resultado<T>> => Promise.resolve({ ok: false, error })

const SIN_ESTADO: EstadoModulo = { estado: {}, actualizado_en: null }
const TOMA_ID = '1111aaaa-2222-4333-8444-55555555bbbb'

function toma(extra: Partial<Toma> = {}): Toma {
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

function orden(extra: Partial<OrdenModulo> = {}): OrdenModulo {
  return {
    command_id: 'c-1',
    device_id: 'cuna-alimentacion-01',
    command: 'feeding_weigh',
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

const lista = (...tomas: Toma[]) => ok({ ahora: '2999-11-18T15:00:00Z', tomas })

type Parciales = {
  alimentacion?: Partial<ServicioAlimentacion>
  ordenes?: Partial<ServicioOrdenes>
  horarios?: Partial<ServicioHorarios>
}

function abrir(p: Parciales = {}, backend = true) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    alimentacion: {
      listarTomas: () => lista(),
      crearToma: () => falla('x'),
      cambiarEstado: () => falla('x'),
      pedirPeso: () => falla('x'),
      corregir: () => falla('x'),
      obtenerLimites: () => ok(null),
      guardarLimites: () => falla('x'),
      ultimaTemperatura: () => ok(null),
      ...p.alimentacion,
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
      <MemoryRouter initialEntries={['/alimentacion']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

const panelToma = () => screen.findByRole('region', { name: 'Toma' })
const abierta = (p: HTMLElement) => within(p).findByRole('group', { name: 'Toma abierta' })
const clic = async (p: HTMLElement, nombre: string | RegExp) =>
  fireEvent.click(await within(p).findByRole('button', { name: nombre }))

afterEach(() => vi.unstubAllEnvs())

describe('Alimentación: pantalla', () => {
  it('sin backend no muestra paneles ni datos', async () => {
    abrir({}, false)
    expect(await screen.findByRole('heading', { name: 'Alimentación' })).toBeInTheDocument()
    for (const nombre of ['Toma', 'Temperatura del biberón', 'Límites de temperatura del biberón']) {
      expect(screen.queryByRole('region', { name: nombre })).not.toBeInTheDocument()
    }
  })

  it('el menú principal enlaza la alimentación', async () => {
    abrir()
    expect(await screen.findByRole('link', { name: 'Alimentación' })).toHaveAttribute('href', '/alimentacion')
  })

  it('no ofrece calentar, enfriar ni dar de comer', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir({ alimentacion: { listarTomas: () => lista(toma()) } })
    await panelToma()
    expect(screen.queryByRole('button', { name: /calent|enfri|suministr|dispens|alimentar/i })).not.toBeInTheDocument()
  })

  it('sin tomas no inventa nada y permite crear una', async () => {
    const crearToma = vi.fn(() => ok(toma()))
    abrir({ alimentacion: { crearToma } })
    const p = await panelToma()
    expect(await within(p).findByText('No hay una toma abierta.')).toBeInTheDocument()
    expect(within(p).getByText('Todavía no hay tomas registradas.')).toBeInTheDocument()
    await clic(p, 'Nueva toma')
    await waitFor(() => expect(crearToma).toHaveBeenCalledTimes(1))
    const [dispositivo, id] = crearToma.mock.calls[0] as unknown as [string, string]
    expect(dispositivo).toBe('cuna-alimentacion-01')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('un fallo al consultar las tomas se muestra', async () => {
    abrir({ alimentacion: { listarTomas: () => falla('x') } })
    const p = await panelToma()
    expect(await within(p).findByText('No se pudieron consultar las tomas.')).toBeInTheDocument()
  })
})

describe('Alimentación: pasos de la toma', () => {
  it('preparando sin órdenes habilitadas no ofrece pesar y lo explica', async () => {
    abrir({ alimentacion: { listarTomas: () => lista(toma()) } })
    const p = await panelToma()
    expect(await within(p).findByTestId('estado-toma')).toHaveTextContent('Estado: Preparando.')
    expect(within(p).queryByRole('button', { name: /Pesar/ })).not.toBeInTheDocument()
    expect(within(p).getByText(/requiere habilitar las órdenes/)).toBeInTheDocument()
    expect(within(await abierta(p)).getByText(/Peso inicial: sin dato/)).toBeInTheDocument()
  })

  it('con órdenes habilitadas pesa con la Pico: manda el momento y un command_id nuevo', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const pedirPeso = vi.fn(() => ok(null))
    abrir({
      alimentacion: { listarTomas: () => lista(toma()), pedirPeso },
      ordenes: { obtenerUltimaOrden: () => ok(orden()) },
    })
    const p = await panelToma()
    await clic(p, 'Pesar biberón lleno')
    await waitFor(() => expect(pedirPeso).toHaveBeenCalledTimes(1))
    const [id, momento, commandId] = pedirPeso.mock.calls[0] as unknown as [string, string, string]
    expect([id, momento]).toEqual([TOMA_ID, 'inicial'])
    expect(commandId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await within(p).findByText(/Solicitud registrada/)).toBeInTheDocument()
  })

  it('el peso no se muestra hasta que llega al servidor', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    abrir({ alimentacion: { listarTomas: () => lista(toma()), pedirPeso: () => ok(null) } })
    const p = await panelToma()
    await clic(p, 'Pesar biberón lleno')
    expect(within(await abierta(p)).getByText(/Peso inicial: sin dato/)).toBeInTheDocument()
  })

  it('iniciar sin peso inicial muestra el mensaje fijo del servidor', async () => {
    const cambiarEstado = vi.fn(() => falla<Toma>('Pesa el biberón antes de iniciar la toma.'))
    abrir({ alimentacion: { listarTomas: () => lista(toma()), cambiarEstado } })
    const p = await panelToma()
    await clic(p, 'Iniciar toma')
    expect(await within(p).findByRole('alert')).toHaveTextContent('Pesa el biberón antes de iniciar la toma.')
    expect(cambiarEstado).toHaveBeenCalledWith(TOMA_ID, 'iniciar')
  })

  it('preparando permite cancelar', async () => {
    const cambiarEstado = vi.fn(() => ok(toma({ estado: 'cancelada' })))
    abrir({ alimentacion: { listarTomas: () => lista(toma({ peso_inicial_g: 200 })), cambiarEstado } })
    const p = await panelToma()
    expect(within(await abierta(p)).getByText(/Peso inicial: 200 g/)).toBeInTheDocument()
    await clic(p, 'Cancelar toma')
    await waitFor(() => expect(cambiarEstado).toHaveBeenCalledWith(TOMA_ID, 'cancelar'))
  })

  it('en curso muestra la duración activa y ofrece pausar y finalizar', async () => {
    const cambiarEstado = vi.fn(() => ok(toma({ estado: 'pausada' })))
    abrir({
      alimentacion: {
        listarTomas: () =>
          lista(toma({ estado: 'en_curso', peso_inicial_g: 200, inicio: '2999-11-18T14:47:00Z', duracion_activa_s: 780 })),
        cambiarEstado,
      },
    })
    const p = await panelToma()
    expect(await within(p).findByTestId('duracion-toma')).toHaveTextContent('Duración activa: 13 min')
    expect(within(p).queryByRole('button', { name: 'Iniciar toma' })).not.toBeInTheDocument()
    await clic(p, 'Pausar toma')
    await waitFor(() => expect(cambiarEstado).toHaveBeenCalledWith(TOMA_ID, 'pausar'))
    expect(within(p).getByRole('button', { name: 'Finalizar toma' })).toBeInTheDocument()
  })

  it('en pausa ofrece reanudar y la duración no avanza', async () => {
    abrir({
      alimentacion: {
        listarTomas: () => lista(toma({ estado: 'pausada', peso_inicial_g: 200, duracion_activa_s: 300 })),
      },
    })
    const p = await panelToma()
    expect(await within(p).findByTestId('duracion-toma')).toHaveTextContent('5 min 0 s')
    expect(within(p).getByRole('button', { name: 'Reanudar toma' })).toBeInTheDocument()
    expect(within(p).getByTestId('estado-toma')).toHaveTextContent('Pausada')
  })

  it('por cerrar: pesa al final y cerrar sin peso final muestra el mensaje fijo', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const pedirPeso = vi.fn(() => ok(null))
    const cambiarEstado = vi.fn(() =>
      falla<Toma>('Falta el peso final o es mayor que el inicial. Pesa de nuevo o corrige el peso.'),
    )
    abrir({
      alimentacion: {
        listarTomas: () => lista(toma({ estado: 'por_cerrar', peso_inicial_g: 200, duracion_activa_s: 600 })),
        pedirPeso,
        cambiarEstado,
      },
    })
    const p = await panelToma()
    await clic(p, 'Pesar biberón al terminar')
    await waitFor(() => expect(pedirPeso).toHaveBeenCalledWith(TOMA_ID, 'final', expect.any(String)))
    await clic(p, 'Cerrar toma')
    expect(await within(p).findByRole('alert')).toHaveTextContent('Falta el peso final o es mayor que el inicial')
  })

  it('el pesaje de control es solo un pesaje: pide momento control', async () => {
    vi.stubEnv('VITE_ORDENES_HABILITADAS', 'true')
    const pedirPeso = vi.fn(() => ok(null))
    abrir({
      alimentacion: {
        listarTomas: () => lista(toma({ estado: 'en_curso', peso_inicial_g: 200, duracion_activa_s: 60 })),
        pedirPeso,
      },
    })
    const p = await panelToma()
    await clic(p, 'Pesar de control')
    await waitFor(() => expect(pedirPeso).toHaveBeenCalledWith(TOMA_ID, 'control', expect.any(String)))
  })

  it('un pesaje fallido dice el motivo sin inventar un peso', async () => {
    abrir({ alimentacion: { listarTomas: () => lista(toma({ peso_error: 'sin_calibracion' })) } })
    const p = await panelToma()
    expect(await within(p).findByRole('alert')).toHaveTextContent(
      'El último pesaje falló: la balanza no está calibrada.',
    )
    expect(within(await abierta(p)).getByText(/Peso inicial: sin dato/)).toBeInTheDocument()
  })

  it('una toma completa muestra lo ingerido y no ofrece acciones de toma', async () => {
    abrir({
      alimentacion: {
        listarTomas: () =>
          lista(
            toma({
              estado: 'completa',
              peso_inicial_g: 200,
              peso_final_g: 150,
              ingerido_g: 50,
              inicio: '2999-11-18T14:00:00Z',
              fin: '2999-11-18T14:15:00Z',
              duracion_activa_s: 780,
              pausas: [{ inicio: '2999-11-18T14:05:00Z', fin: '2999-11-18T14:07:00Z' }],
            }),
          ),
      },
    })
    const p = await panelToma()
    const historial = await within(p).findByRole('list', { name: 'Tomas registradas' })
    expect(historial).toHaveTextContent('Completa')
    expect(historial).toHaveTextContent('Ingerido: 50 g')
    expect(historial).toHaveTextContent('Duración activa: 13 min 0 s')
    expect(historial).toHaveTextContent('Pausas: 1')
    expect(within(p).getByText('No hay una toma abierta.')).toBeInTheDocument()
  })
})

describe('Alimentación: correcciones', () => {
  const COMPLETA = toma({
    estado: 'completa',
    peso_inicial_g: 200,
    peso_final_g: 150,
    ingerido_g: 50,
    duracion_activa_s: 780,
    correcciones: [
      {
        campo: 'peso_final_g',
        valor_anterior: 160,
        valor_nuevo: 150,
        motivo: 'balanza movida',
        creada_en: '2999-11-18T14:20:00Z',
        propia: true,
      },
      {
        campo: 'peso_inicial_g',
        valor_anterior: null,
        valor_nuevo: 200,
        motivo: 'se perdió el pesaje',
        creada_en: '2999-11-18T14:25:00Z',
        propia: false,
      },
    ],
  })

  it('el historial muestra anterior, nuevo, autor, fecha de Costa Rica y motivo', async () => {
    abrir({ alimentacion: { listarTomas: () => lista(COMPLETA) } })
    const p = await panelToma()
    const items = await within(p).findAllByRole('listitem')
    const lista_ = within(p).getByRole('list', { name: 'Correcciones de la toma' })
    const filas = within(lista_).getAllByRole('listitem')
    expect(items.length).toBeGreaterThan(2)
    expect(filas[0]).toHaveTextContent(/Peso final: de 160 g a 150 g\. Autor: Tú\..*08:20:00\. Motivo: balanza movida/)
    expect(filas[1]).toHaveTextContent(/Peso inicial: de sin valor a 200 g\. Autor: Otro dueño\..*08:25:00\. Motivo: se perdió el pesaje/)
  })

  it('el motivo es obligatorio y sin él no se envía nada', async () => {
    const corregir = vi.fn(() => ok(COMPLETA))
    abrir({ alimentacion: { listarTomas: () => lista(COMPLETA), corregir } })
    const p = await panelToma()
    await clic(p, 'Corregir peso')
    const form = await within(p).findByRole('form', { name: 'Corregir peso de la toma' })
    fireEvent.change(within(form).getByLabelText('Peso corregido (g)'), { target: { value: '140' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar corrección' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Explica el motivo de la corrección')
    expect(corregir).not.toHaveBeenCalled()
  })

  it('un peso inválido no se envía', async () => {
    const corregir = vi.fn(() => ok(COMPLETA))
    abrir({ alimentacion: { listarTomas: () => lista(COMPLETA), corregir } })
    const p = await panelToma()
    await clic(p, 'Corregir peso')
    const form = await within(p).findByRole('form', { name: 'Corregir peso de la toma' })
    fireEvent.change(within(form).getByLabelText('Peso corregido (g)'), { target: { value: '-4' } })
    fireEvent.change(within(form).getByLabelText('Motivo de la corrección'), { target: { value: 'x' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar corrección' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Escribe el peso en gramos')
    expect(corregir).not.toHaveBeenCalled()
  })

  it('una corrección válida llama al servicio con campo, valor y motivo', async () => {
    const corregir = vi.fn(() => ok(COMPLETA))
    abrir({ alimentacion: { listarTomas: () => lista(COMPLETA), corregir } })
    const p = await panelToma()
    await clic(p, 'Corregir peso')
    const form = await within(p).findByRole('form', { name: 'Corregir peso de la toma' })
    fireEvent.change(within(form).getByLabelText('Peso a corregir'), { target: { value: 'peso_final_g' } })
    fireEvent.change(within(form).getByLabelText('Peso corregido (g)'), { target: { value: '140,5' } })
    fireEvent.change(within(form).getByLabelText('Motivo de la corrección'), { target: { value: ' balanza movida ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar corrección' }))
    await waitFor(() => expect(corregir).toHaveBeenCalledWith(TOMA_ID, 'peso_final_g', 140.5, 'balanza movida'))
  })

  it('un rechazo del servidor se muestra y el formulario sigue abierto', async () => {
    const corregir = vi.fn(() => falla<Toma>('El peso corregido no es válido para esta toma.'))
    abrir({ alimentacion: { listarTomas: () => lista(COMPLETA), corregir } })
    const p = await panelToma()
    await clic(p, 'Corregir peso')
    const form = await within(p).findByRole('form', { name: 'Corregir peso de la toma' })
    fireEvent.change(within(form).getByLabelText('Peso corregido (g)'), { target: { value: '900' } })
    fireEvent.change(within(form).getByLabelText('Motivo de la corrección'), { target: { value: 'prueba' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar corrección' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('El peso corregido no es válido para esta toma.')
  })

  it('una toma en preparación no se puede corregir', async () => {
    abrir({ alimentacion: { listarTomas: () => lista(toma()) } })
    const p = await panelToma()
    await within(p).findByRole('list', { name: 'Tomas registradas' })
    expect(within(p).queryByRole('button', { name: 'Corregir peso' })).not.toBeInTheDocument()
  })
})

describe('Alimentación: temperatura, límites y recordatorios', () => {
  const temperatura = () => screen.findByRole('region', { name: 'Temperatura del biberón' })

  it('sin lectura dice «Sin datos»', async () => {
    abrir()
    const p = await temperatura()
    expect(await within(p).findByTestId('temperatura-biberon')).toHaveTextContent('Sin datos')
  })

  it('una lectura reciente se muestra con su hora', async () => {
    abrir({ alimentacion: { ultimaTemperatura: () => ok({ valor: 37.5, ts: new Date().toISOString() }) } })
    const p = await temperatura()
    const t = await within(p).findByTestId('temperatura-biberon')
    expect(t).toHaveTextContent('Última lectura: 37,5 °C')
    expect(t).toHaveAttribute('data-desactualizado', 'false')
    expect(t).not.toHaveTextContent('Desactualizado')
  })

  it('una lectura vieja se marca como desactualizada', async () => {
    abrir({ alimentacion: { ultimaTemperatura: () => ok({ valor: 37.5, ts: '2000-01-01T00:00:00Z' }) } })
    const p = await temperatura()
    const t = await within(p).findByTestId('temperatura-biberon')
    expect(t).toHaveTextContent('Desactualizado.')
    expect(t).toHaveAttribute('data-desactualizado', 'true')
  })

  it('un fallo al consultar la temperatura se avisa', async () => {
    abrir({ alimentacion: { ultimaTemperatura: () => falla('x') } })
    const p = await temperatura()
    expect(await within(p).findByRole('alert')).toHaveTextContent('No se pudo consultar la temperatura del biberón.')
  })

  const limites = () => screen.findByRole('region', { name: 'Límites de temperatura del biberón' })

  it('sin límites guardados lo dice y no inventa valores', async () => {
    abrir()
    const p = await limites()
    expect(await within(p).findByText('Todavía no hay límites guardados.')).toBeInTheDocument()
    expect(within(p).getByLabelText('Temperatura mínima (°C)')).toHaveValue('')
  })

  it('carga los límites guardados y valida antes de enviar', async () => {
    const guardarLimites = vi.fn(() => ok({ temp_min: 30, temp_max: 40 }))
    abrir({ alimentacion: { obtenerLimites: () => ok({ temp_min: 35, temp_max: 39 }), guardarLimites } })
    const p = await limites()
    await waitFor(() => expect(within(p).getByLabelText('Temperatura mínima (°C)')).toHaveValue('35'))
    fireEvent.change(within(p).getByLabelText('Temperatura mínima (°C)'), { target: { value: '41' } })
    fireEvent.click(within(p).getByRole('button', { name: 'Guardar límites del biberón' }))
    expect(await within(p).findByRole('alert')).toHaveTextContent('El mínimo debe ser menor que el máximo.')
    expect(guardarLimites).not.toHaveBeenCalled()
    fireEvent.change(within(p).getByLabelText('Temperatura mínima (°C)'), { target: { value: '30' } })
    fireEvent.change(within(p).getByLabelText('Temperatura máxima (°C)'), { target: { value: '40' } })
    fireEvent.click(within(p).getByRole('button', { name: 'Guardar límites del biberón' }))
    await waitFor(() => expect(guardarLimites).toHaveBeenCalledWith('cuna-alimentacion-01', { temp_min: 30, temp_max: 40 }))
    expect(await within(p).findByText('Límites guardados.')).toBeInTheDocument()
  })

  it('el rechazo del servidor deja los límites guardados como estaban', async () => {
    abrir({
      alimentacion: {
        obtenerLimites: () => ok({ temp_min: 35, temp_max: 39 }),
        guardarLimites: () => falla('Los límites de temperatura no son válidos.'),
      },
    })
    const p = await limites()
    await waitFor(() => expect(within(p).getByLabelText('Temperatura máxima (°C)')).toHaveValue('39'))
    fireEvent.click(within(p).getByRole('button', { name: 'Guardar límites del biberón' }))
    expect(await within(p).findByRole('alert')).toHaveTextContent('Los límites de temperatura no son válidos.')
    expect(within(p).queryByText('Límites guardados.')).not.toBeInTheDocument()
  })

  it('los recordatorios usan el horario recordatorio_alimentacion y dicen que no mandan órdenes', async () => {
    const listar = vi.fn(() => ok(['08:00', '11:00']))
    abrir({ horarios: { listar } })
    const grupo = await screen.findByRole('group', { name: 'Recordatorios de alimentación' })
    expect(await within(grupo).findByText('08:00')).toBeInTheDocument()
    expect(within(grupo).getByText('11:00')).toBeInTheDocument()
    expect(listar).toHaveBeenCalledWith('cuna-alimentacion-01', 'recordatorio_alimentacion')
    expect(grupo).toHaveTextContent('Es solo un aviso: no envía ninguna orden a la Pico.')
  })
})
