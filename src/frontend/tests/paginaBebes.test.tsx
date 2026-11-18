import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { Bebe, ModuloAsociado } from '../src/models/cuentas.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, Servicios, ServicioCuentas } from '../src/services/tipos.ts'

const SESION = { usuario_id: 'u-1', correo: 'ana@ejemplo.test' }
const LUNA: Bebe = { id: 'b-1', nombre: 'Luna', fecha_nacimiento: '2026-05-01' }
const SOL: Bebe = { id: 'b-2', nombre: 'Sol', fecha_nacimiento: null }
const CUNA: ModuloAsociado = {
  id: 'cuna-ambiente-01',
  tipo: 'cuna',
  producto_id: 'cuna-01',
  activo: true,
  bebe_id: 'b-1',
  bebe_nombre: 'Luna',
}

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })

function montar(cuentas: Partial<ServicioCuentas>) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    cuentas: {
      ...serviciosNoConfigurados.cuentas,
      listarBebes: () => ok([LUNA, SOL]),
      listarDispositivos: () => ok([CUNA]),
      listarInvitaciones: () => ok([]),
      listarDuenos: () => ok([{ usuario_id: 'u-1', correo: 'ana@ejemplo.test' }]),
      ...cuentas,
    },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => ok(SESION),
    },
  }
  return render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/bebes']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

describe('/bebes', () => {
  it('sin backend configurado no muestra bebés ni módulos', () => {
    render(
      <MemoryRouter initialEntries={['/bebes']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bebés y dispositivos')
    expect(screen.getByText('Todavía no hay datos recibidos del dispositivo.')).toBeInTheDocument()
    expect(screen.queryByText('Luna')).not.toBeInTheDocument()
  })

  it('lista bebés y módulos asociados con sus datos reales (CA-03.3)', async () => {
    montar({})
    expect(await screen.findByText(/Luna · nació el 1 de mayo de 2026/)).toBeInTheDocument()
    expect(screen.getByText('Sol', { selector: 'li' })).toBeInTheDocument()
    const tarjeta = screen.getByRole('article', { name: 'Cuna cuna-ambiente-01' })
    expect(within(tarjeta).getByText(/Bebé asociado: Luna/)).toBeInTheDocument()
  })

  it('un fallo de consulta no muestra datos y avisa', async () => {
    montar({ listarBebes: () => Promise.resolve({ ok: false, error: 'No se pudo completar la operación.' }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar la operación.')
    expect(screen.queryByText('Sol', { selector: 'li' })).not.toBeInTheDocument()
  })

  it('crear un bebé sin nombre muestra el error del servicio (CA-02.3)', async () => {
    const crearBebe = vi.fn(() =>
      Promise.resolve<Resultado<Bebe>>({ ok: false, error: 'Escribe el nombre del bebé.' }),
    )
    montar({ crearBebe })
    const formulario = await screen.findByRole('form', { name: 'Agregar bebé' })
    fireEvent.click(within(formulario).getByRole('button', { name: 'Agregar bebé' }))
    expect(await screen.findByText('Escribe el nombre del bebé.')).toBeInTheDocument()
    expect(crearBebe).toHaveBeenCalledWith('', null)
  })

  it('crear un bebé con fecha opcional recarga la lista', async () => {
    const crearBebe = vi.fn((nombre: string) =>
      Promise.resolve<Resultado<Bebe>>({ ok: true, datos: { id: 'b-3', nombre, fecha_nacimiento: null } }),
    )
    const listarBebes = vi.fn(() => ok([LUNA, SOL]))
    montar({ crearBebe, listarBebes })
    const formulario = await screen.findByRole('form', { name: 'Agregar bebé' })
    fireEvent.change(within(formulario).getByLabelText('Nombre del bebé'), { target: { value: 'Nube' } })
    fireEvent.click(within(formulario).getByRole('button', { name: 'Agregar bebé' }))
    await waitFor(() => expect(crearBebe).toHaveBeenCalledWith('Nube', null))
    await waitFor(() => expect(listarBebes).toHaveBeenCalledTimes(2))
  })

  it('reasignar muestra el aviso de historial y llama al servicio', async () => {
    const asignarDispositivo = vi.fn(() => ok(null))
    montar({ asignarDispositivo })
    const tarjeta = await screen.findByRole('article', { name: 'Cuna cuna-ambiente-01' })
    expect(within(tarjeta).getByText(/conservan su bebé original/)).toBeInTheDocument()
    const guardar = within(tarjeta).getByRole('button', { name: 'Guardar asociación' })
    expect(guardar).toBeDisabled()
    fireEvent.change(within(tarjeta).getByLabelText('Asociar a'), { target: { value: 'b-2' } })
    fireEvent.click(guardar)
    await waitFor(() => expect(asignarDispositivo).toHaveBeenCalledWith('cuna-ambiente-01', 'b-2'))
  })

  it('una segunda cuna rechazada muestra el error y no cambia la lista (CA-03.4)', async () => {
    const asignarDispositivo = vi.fn(() =>
      Promise.resolve<Resultado<null>>({ ok: false, error: 'Ese bebé ya tiene otra cuna asociada.' }),
    )
    montar({ asignarDispositivo })
    const tarjeta = await screen.findByRole('article', { name: 'Cuna cuna-ambiente-01' })
    fireEvent.change(within(tarjeta).getByLabelText('Asociar a'), { target: { value: 'b-2' } })
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Guardar asociación' }))
    expect(await within(tarjeta).findByRole('alert')).toHaveTextContent('otra cuna asociada')
    expect(within(tarjeta).getByText(/Bebé asociado: Luna/)).toBeInTheDocument()
  })

  it('Administrar dueños lista, invita y retira; el último dueño se rechaza (CA-04.2, CA-04.3)', async () => {
    const invitarDueno = vi.fn(() => ok(null))
    const retirarDueno = vi.fn(() =>
      Promise.resolve<Resultado<null>>({ ok: false, error: 'No se puede retirar al último dueño del módulo.' }),
    )
    montar({ invitarDueno, retirarDueno })
    const tarjeta = await screen.findByRole('article', { name: 'Cuna cuna-ambiente-01' })
    fireEvent.click(within(tarjeta).getByRole('button', { name: 'Administrar dueños' }))
    const grupo = await screen.findByRole('group', { name: 'Dueños de cuna-ambiente-01' })
    expect(await within(grupo).findByText('ana@ejemplo.test')).toBeInTheDocument()

    fireEvent.change(within(grupo).getByLabelText('Correo de la persona invitada'), {
      target: { value: 'beto@ejemplo.test' },
    })
    fireEvent.click(within(grupo).getByRole('button', { name: 'Invitar' }))
    await waitFor(() => expect(invitarDueno).toHaveBeenCalledWith('cuna-ambiente-01', 'beto@ejemplo.test'))
    expect(await within(grupo).findByText(/cuando la acepte/)).toBeInTheDocument()

    fireEvent.click(within(grupo).getByRole('button', { name: /Retirar a ana@ejemplo.test/ }))
    expect(await within(grupo).findByRole('alert')).toHaveTextContent('último dueño')
    expect(retirarDueno).toHaveBeenCalledWith('cuna-ambiente-01', 'u-1')
  })

  it('las invitaciones pendientes se aceptan desde la pantalla', async () => {
    const aceptarInvitacion = vi.fn(() => ok(null))
    montar({
      aceptarInvitacion,
      listarInvitaciones: () =>
        ok([{ id: 'i-1', dispositivo_id: 'cuna-colchon-01', tipo: 'colchon' as const, creada_en: '2026-11-18T10:00:00Z' }]),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación a cuna-colchon-01' }))
    await waitFor(() => expect(aceptarInvitacion).toHaveBeenCalledWith('i-1'))
  })
})
