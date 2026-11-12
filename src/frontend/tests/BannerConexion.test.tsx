import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BannerConexion from '../src/components/BannerConexion.tsx'
import type { EstadoConexion } from '../src/models/conexion.ts'

describe('BannerConexion', () => {
  it.each<[EstadoConexion, string]>([
    ['sin-configurar', 'Backend no configurado.'],
    ['conectando', 'Conectando con el servidor…'],
    ['conectado', 'Conectado con el servidor.'],
    [
      'desconectado',
      'Sin conexión con el servidor. Los datos mostrados pueden estar desactualizados.',
    ],
  ])('estado %s muestra su texto con role="status"', (estado, texto) => {
    render(<BannerConexion estado={estado} />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(texto)
    expect(banner).toHaveAttribute('data-estado', estado)
  })

  it('el texto propio reemplaza al texto por defecto', () => {
    render(<BannerConexion estado="desconectado" texto="Integración pendiente." />)
    expect(screen.getByRole('status')).toHaveTextContent('Integración pendiente.')
  })
})
