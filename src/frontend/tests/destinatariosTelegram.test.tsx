import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { ModuloAsociado } from '../src/models/cuentas.ts'
import type { DestinatarioTelegram } from '../src/models/telegram.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, Servicios, ServicioTelegram } from '../src/services/tipos.ts'

const CUNA: ModuloAsociado = {
  id: 'cuna-ambiente-01',
  tipo: 'cuna',
  producto_id: 'cuna-01',
  activo: true,
  bebe_id: 'b-1',
  bebe_nombre: 'Luna',
}
const MAMA: DestinatarioTelegram = { id: 'd-1', nombre: 'Mamá', vinculado: false }
const PAPA: DestinatarioTelegram = { id: 'd-2', nombre: 'Papá', vinculado: true }

const ok = <T,>(datos: T): Promise<Resultado<T>> => Promise.resolve({ ok: true, datos })

afterEach(() => vi.unstubAllEnvs())

async function abrir(telegram: Partial<ServicioTelegram>) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    telegram: {
      ...serviciosNoConfigurados.telegram,
      listarDestinatarios: () => ok([MAMA, PAPA]),
      ...telegram,
    },
    cuentas: {
      ...serviciosNoConfigurados.cuentas,
      listarBebes: () => ok([]),
      listarDispositivos: () => ok([CUNA]),
      listarInvitaciones: () => ok([]),
    },
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => ok({ usuario_id: 'u-1', correo: 'ana@ejemplo.test' }),
    },
  }
  render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/bebes']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
  const tarjeta = await screen.findByRole('article', { name: 'Cuna cuna-ambiente-01' })
  fireEvent.click(within(tarjeta).getByRole('button', { name: 'Destinatarios de Telegram' }))
  return screen.findByRole('group', { name: 'Destinatarios de Telegram de cuna-ambiente-01' })
}

describe('Destinatarios de Telegram', () => {
  it('lista más de un destinatario con su estado y aclara que no dan control (CA-06.1, CA-06.2)', async () => {
    const grupo = await abrir({})
    expect(await within(grupo).findByText('Mamá · sin vincular')).toBeInTheDocument()
    expect(within(grupo).getByText('Papá · vinculado')).toBeInTheDocument()
    expect(within(grupo).getByText(/No tienen control sobre el módulo/)).toBeInTheDocument()
    expect(within(grupo).getByText(/fotografías nunca se envían/)).toBeInTheDocument()
  })

  it('un módulo sin destinatarios lo dice y no inventa ninguno', async () => {
    const grupo = await abrir({ listarDestinatarios: () => ok([]) })
    expect(await within(grupo).findByText('Este módulo todavía no tiene destinatarios.')).toBeInTheDocument()
  })

  it('agregar un destinatario recarga la lista', async () => {
    const crearDestinatario = vi.fn((_d: string, nombre: string) =>
      ok({ id: 'd-3', nombre, vinculado: false }),
    )
    const listarDestinatarios = vi.fn(() => ok([MAMA]))
    const grupo = await abrir({ crearDestinatario, listarDestinatarios })
    await within(grupo).findByText('Mamá · sin vincular')
    fireEvent.change(within(grupo).getByLabelText('Nombre del destinatario'), { target: { value: 'Abuela' } })
    fireEvent.click(within(grupo).getByRole('button', { name: 'Agregar destinatario' }))
    await waitFor(() => expect(crearDestinatario).toHaveBeenCalledWith('cuna-ambiente-01', 'Abuela'))
    await waitFor(() => expect(listarDestinatarios).toHaveBeenCalledTimes(2))
  })

  it('genera un código de un solo uso con instrucciones y sin enlace si no hay bot configurado (CA-06.3)', async () => {
    const generarCodigo = vi.fn(() => ok({ codigo: 'a1b2c3d4e5f6a7b8c9d0', vence_en: '2026-11-18T14:15:00Z' }))
    const grupo = await abrir({ generarCodigo })
    fireEvent.click(await within(grupo).findByRole('button', { name: 'Generar código para Mamá' }))
    expect(await within(grupo).findByText('a1b2c3d4e5f6a7b8c9d0')).toBeInTheDocument()
    expect(generarCodigo).toHaveBeenCalledWith('d-1')
    expect(within(grupo).getByText('/start a1b2c3d4e5f6a7b8c9d0')).toBeInTheDocument()
    expect(within(grupo).getByText(/Vence el .*08:15:00/)).toBeInTheDocument()
    expect(within(grupo).queryByRole('link')).not.toBeInTheDocument()
  })

  it('con VITE_TELEGRAM_BOT válido ofrece el enlace de vinculación', async () => {
    vi.stubEnv('VITE_TELEGRAM_BOT', 'CunaInteligenteBot')
    const grupo = await abrir({
      generarCodigo: () => ok({ codigo: 'a1b2c3d4e5f6a7b8c9d0', vence_en: '2026-11-18T14:15:00Z' }),
    })
    fireEvent.click(await within(grupo).findByRole('button', { name: 'Generar código para Mamá' }))
    const enlace = await within(grupo).findByRole('link', { name: 'el enlace de vinculación' })
    expect(enlace).toHaveAttribute('href', 'https://t.me/CunaInteligenteBot?start=a1b2c3d4e5f6a7b8c9d0')
    expect(enlace).toHaveAttribute('rel', 'noreferrer')
  })

  it('retirar un destinatario llama al servicio y recarga; un error se muestra', async () => {
    const retirarDestinatario = vi.fn(() => ok(null))
    const listarDestinatarios = vi.fn(() => ok([MAMA, PAPA]))
    const grupo = await abrir({ retirarDestinatario, listarDestinatarios })
    fireEvent.click(await within(grupo).findByRole('button', { name: 'Retirar a Papá' }))
    await waitFor(() => expect(retirarDestinatario).toHaveBeenCalledWith('d-2'))
    await waitFor(() => expect(listarDestinatarios).toHaveBeenCalledTimes(2))
  })

  it('un fallo al consultar no muestra destinatarios', async () => {
    const grupo = await abrir({
      listarDestinatarios: () => Promise.resolve({ ok: false, error: 'No tienes permiso para esta operación.' }),
    })
    expect(await within(grupo).findByRole('alert')).toHaveTextContent('No tienes permiso')
    expect(within(grupo).queryByText(/Mamá/)).not.toBeInTheDocument()
  })
})
