import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Resultado, ResultadoRegistro, Servicios } from '../src/services/tipos.ts'

function montar(registrarse: (c: string, p: string) => Promise<Resultado<ResultadoRegistro>>) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    auth: {
      ...serviciosNoConfigurados.auth,
      registrarse,
      obtenerSesion: () => Promise.resolve({ ok: true, datos: null }),
    },
  }
  return render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/registro']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

async function enviar(correo: string, contrasena: string) {
  fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: correo } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: contrasena } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('/registro', () => {
  it('sin backend configurado no ofrece formulario', () => {
    render(
      <MemoryRouter initialEntries={['/registro']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('Registro no disponible: el backend no está configurado.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('un correo ya registrado muestra el error y no confirma nada (CA-01.4)', async () => {
    const registrarse = vi.fn(() =>
      Promise.resolve<Resultado<ResultadoRegistro>>({ ok: false, error: 'Ese correo ya está registrado.' }),
    )
    montar(registrarse)
    await enviar('ana@ejemplo.test', 'clave-larga-1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese correo ya está registrado.')
    expect(registrarse).toHaveBeenCalledWith('ana@ejemplo.test', 'clave-larga-1')
    expect(screen.queryByText(/Cuenta creada/)).not.toBeInTheDocument()
  })

  it('campos vacíos muestran el error del servicio', async () => {
    const registrarse = vi.fn(() =>
      Promise.resolve<Resultado<ResultadoRegistro>>({ ok: false, error: 'Escribe el correo y la contraseña.' }),
    )
    montar(registrarse)
    await enviar('', '')
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el correo y la contraseña.')
  })

  it('una cuenta nueva pide confirmar el correo antes de iniciar sesión', async () => {
    montar(() => Promise.resolve({ ok: true, datos: { requiereConfirmacion: true } }))
    await enviar('nueva@ejemplo.test', 'clave-larga-1')
    await waitFor(() => expect(screen.getByText(/Cuenta creada/)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'inicia sesión' })).toHaveAttribute('href', '/login')
  })
})
