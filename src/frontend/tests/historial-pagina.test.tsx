import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { Bebe } from '../src/models/cuentas.ts'
import type { RegistroHistorial, RespuestaHistorial } from '../src/models/historial.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, Servicios } from '../src/services/tipos.ts'
import { crAUtc } from '../src/utils/tiempo.ts'

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })
const falla = <T,>(error: string): Promise<Resultado<T>> => Promise.resolve({ ok: false, error })

const LUNA: Bebe = { id: 'b-luna', nombre: 'Luna', fecha_nacimiento: null }
const MATEO: Bebe = { id: 'b-mateo', nombre: 'Mateo', fecha_nacimiento: null }

// Instante UTC de una hora de reloj de Costa Rica del 18 de noviembre de 2026.
const cr = (hhmm: string, dia = '2026-11-18') => new Date(crAUtc(dia, hhmm)!).toISOString()

function reg(bebe: string, extra: Partial<RegistroHistorial> & { ts: string; tipo: string }): RegistroHistorial {
  return {
    registro_id: `${bebe}-${extra.tipo}-${extra.ts}`,
    bebe_id: bebe,
    device_id: 'cuna-habitacion-01',
    descripcion: null,
    valor: null,
    unidad: null,
    toma: null,
    foto: null,
    ...extra,
  }
}

function respuesta(registros: RegistroHistorial[], extra: Partial<RespuestaHistorial> = {}): RespuestaHistorial {
  return {
    ahora: '2026-11-19T12:00:00Z',
    desde: '2026-11-18T00:00:00Z',
    hasta: '2026-11-19T00:00:00Z',
    truncado: false,
    registros,
    ...extra,
  }
}

type Consultar = Servicios['historial']['consultar']

function abrir(consultar: Consultar, bebes: Bebe[] = [LUNA, MATEO], backend = true, urlFoto?: () => Promise<Resultado<string>>) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    historial: { consultar },
    cuentas: {
      ...serviciosNoConfigurados.cuentas,
      listarBebes: () => ok(bebes),
      listarDispositivos: () => ok([]),
      listarInvitaciones: () => ok([]),
    },
    habitacion: { ...serviciosNoConfigurados.habitacion, urlFoto: urlFoto ?? (() => falla('x')) },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => ok({ usuario_id: 'u-1', correo: 'ana@ejemplo.test' }),
    },
  }
  return render(
    <ProveedorServicios configurado={backend} servicios={servicios}>
      <MemoryRouter initialEntries={['/historial']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

const consultarBoton = () => screen.findByRole('button', { name: 'Consultar' })

async function consultarNoche(fecha = '2026-11-18') {
  const boton = await consultarBoton()
  fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: fecha } })
  fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '19:00' } })
  fireEvent.change(screen.getByLabelText('Hora de fin'), { target: { value: '07:00' } })
  fireEvent.click(boton)
}

afterEach(() => vi.unstubAllEnvs())

describe('Historial: pantalla', () => {
  it('sin backend no muestra datos ni consulta nada', async () => {
    const consultar = vi.fn()
    abrir(consultar, [LUNA], false)
    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay datos recibidos del dispositivo.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Consultar' })).not.toBeInTheDocument()
    expect(consultar).not.toHaveBeenCalled()
  })

  it('sin bebés lo dice y no ofrece consultar', async () => {
    abrir(vi.fn(), [])
    expect(await screen.findByText(/Todavía no hay bebés registrados/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Consultar' })).not.toBeInTheDocument()
  })

  it('consulta el bebé elegido y el intervalo [19:00, 07:00) que cruza la medianoche', async () => {
    const consultar = vi.fn<Consultar>(() => ok(respuesta([])))
    abrir(consultar)
    await consultarNoche()
    await waitFor(() => expect(consultar).toHaveBeenCalledTimes(1))
    expect(consultar).toHaveBeenCalledWith('b-luna', crAUtc('2026-11-18', '19:00'), crAUtc('2026-11-19', '07:00'))
  })

  it('cambia de bebé y consulta solo ese bebé (CA-25.2)', async () => {
    const consultar = vi.fn<Consultar>((bebeId) =>
      ok(respuesta([reg(bebeId, { tipo: 'puerta', ts: cr('22:00'), descripcion: `Puerta de ${bebeId}` })])),
    )
    abrir(consultar)
    const boton = await consultarBoton()
    fireEvent.change(screen.getByLabelText('Bebé'), { target: { value: 'b-mateo' } })
    fireEvent.click(boton)
    expect(await screen.findByText(/Puerta de b-mateo/)).toBeInTheDocument()
    expect(consultar.mock.calls[0][0]).toBe('b-mateo')
    expect(screen.queryByText(/Puerta de b-luna/)).not.toBeInTheDocument()
  })

  it('un intervalo sin registros se informa así y no inventa actividad (CA-25.4)', async () => {
    abrir(() => ok(respuesta([])))
    await consultarNoche()
    expect(await screen.findByText(/No hay registros entre/)).toBeInTheDocument()
    expect(screen.getByText('No hay eventos en este intervalo.')).toBeInTheDocument()
    expect(screen.queryByText('Movimientos')).not.toBeInTheDocument()
  })

  it('muestra resumen, eventos por hora y eventos con hora de Costa Rica', async () => {
    abrir(() =>
      ok(
        respuesta([
          reg('b-luna', { tipo: 'movimiento', ts: cr('22:10'), descripcion: 'Movimiento detectado' }),
          reg('b-luna', { tipo: 'movimiento', ts: cr('22:40'), descripcion: 'Movimiento detectado' }),
          reg('b-luna', { tipo: 'temperatura_ambiente', ts: cr('22:00'), valor: 21.5, unidad: '°C' }),
          reg('b-luna', { tipo: 'temperatura_ambiente', ts: cr('23:00'), valor: 24, unidad: '°C' }),
        ]),
      ),
    )
    await consultarNoche()
    const resumen = await screen.findByRole('region', { name: 'Resumen del intervalo' })
    expect(within(resumen).getByText('Movimientos').nextElementSibling).toHaveTextContent('2')
    expect(resumen).toHaveTextContent('de 21,5 a 24 °C')

    fireEvent.click(screen.getByText('Ver eventos por hora como tabla'))
    const tabla = screen.getByRole('table')
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(12)
    // 22:00 a 23:00 es la cuarta hora de la noche: 2 movimientos. La 19:00 no tiene datos.
    expect(filas[0]).toHaveTextContent('Sin datos')
    expect(within(filas[3]).getAllByRole('cell')[1]).toHaveTextContent('2')
    // 23:00 trae una medición y ningún evento: «0», no «Sin datos».
    expect(within(filas[4]).getAllByRole('cell')[1]).toHaveTextContent('0')

    const lista = screen.getByRole('list', { name: 'Eventos del intervalo' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(lista).toHaveTextContent('18 de noviembre de 2026')
  })

  it('un error del servidor se muestra con un mensaje fijo y sin datos', async () => {
    abrir(() => falla('No se pudo consultar el historial.'))
    await consultarNoche()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el historial.')
    expect(screen.queryByRole('region', { name: 'Resumen del intervalo' })).not.toBeInTheDocument()
  })

  it('un resultado parcial se avisa y no permite exportar', async () => {
    abrir(() => ok(respuesta([reg('b-luna', { tipo: 'puerta', ts: cr('22:00') })], { truncado: true })))
    await consultarNoche()
    expect(await screen.findByText(/este resultado es parcial/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar a Excel' })).not.toBeInTheDocument()
    expect(screen.getByText(/Acórtalo para poder exportar/)).toBeInTheDocument()
  })

  it('un intervalo con la fecha vacía no consulta', async () => {
    const consultar = vi.fn<Consultar>(() => ok(respuesta([])))
    abrir(consultar)
    const boton = await consultarBoton()
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '' } })
    fireEvent.click(boton)
    expect(consultar).not.toHaveBeenCalled()
  })

  it('la foto solo aparece si el servidor la entrega, y se abre con un enlace', async () => {
    const urlFoto = vi.fn(() => ok('https://ejemplo.test/firmada'))
    abrir(
      () =>
        ok(
          respuesta([
            reg('b-luna', {
              tipo: 'foto_tomada',
              ts: cr('22:00'),
              descripcion: 'Foto',
              foto: { estado: 'guardada', ruta: 'cuna-habitacion-01/x.jpg', motivo: null },
            }),
            reg('b-luna', { tipo: 'puerta', ts: cr('22:30'), descripcion: 'Puerta' }),
          ]),
        ),
      [LUNA],
      true,
      urlFoto,
    )
    await consultarNoche()
    const botones = await screen.findAllByRole('button', { name: 'Ver foto' })
    expect(botones).toHaveLength(1)
    fireEvent.click(botones[0])
    expect(await screen.findByRole('img', { name: /Fotografía del evento/ })).toHaveAttribute('src', 'https://ejemplo.test/firmada')
    expect(urlFoto).toHaveBeenCalledWith('cuna-habitacion-01/x.jpg')
  })

  it('exportar entrega todos los registros, incluidas las mediciones, con el nombre del bebé', async () => {
    const registros = [
      reg('b-luna', { tipo: 'puerta', ts: cr('22:00') }),
      reg('b-luna', { tipo: 'temperatura_ambiente', ts: cr('22:00'), valor: 21, unidad: '°C' }),
    ]
    const exportar = vi.fn(async () => {})
    // La página usa la exportación real; aquí se comprueba el botón por separado.
    const { default: BotonExportar } = await import('../src/components/BotonExportar.tsx')
    render(<BotonExportar registros={registros} nombreBebe="Luna" desde={crAUtc('2026-11-18', '19:00')!} truncado={false} exportar={exportar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    await waitFor(() => expect(exportar).toHaveBeenCalledTimes(1))
    expect(exportar).toHaveBeenCalledWith(registros, 'historial-luna-2026-11-18.xlsx')
    expect(await screen.findByText('Archivo generado.')).toBeInTheDocument()
  })

  it('exportar un intervalo sin registros sigue permitido (solo encabezados)', async () => {
    const { default: BotonExportar } = await import('../src/components/BotonExportar.tsx')
    const exportar = vi.fn(async () => {})
    render(<BotonExportar registros={[]} nombreBebe="Luna" desde={0} truncado={false} exportar={exportar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    await waitFor(() => expect(exportar).toHaveBeenCalledWith([], expect.stringMatching(/^historial-luna-/)))
  })

  it('si la exportación falla muestra un mensaje fijo', async () => {
    const { default: BotonExportar } = await import('../src/components/BotonExportar.tsx')
    render(
      <BotonExportar
        registros={[]}
        nombreBebe="Luna"
        desde={0}
        truncado={false}
        exportar={async () => {
          throw new Error('detalle interno')
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el archivo de Excel.')
    expect(screen.queryByText(/detalle interno/)).not.toBeInTheDocument()
  })
})
