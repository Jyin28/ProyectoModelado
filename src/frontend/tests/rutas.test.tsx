import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from '../src/App.tsx'

function renderizarEn(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  )
}

function tituloPrincipal() {
  return screen.getByRole('heading', { level: 1 })
}

describe('rutas', () => {
  it.each([
    ['/login', 'Inicio de sesión'],
    ['/cuna', 'Cuna'],
    ['/colchon', 'Colchón'],
    ['/figuras', 'Figuras LED'],
    ['/historial', 'Historial'],
  ])('%s muestra el título "%s"', (ruta, titulo) => {
    renderizarEn(ruta)
    expect(tituloPrincipal()).toHaveTextContent(titulo)
  })

  it('/ redirige a /cuna', () => {
    renderizarEn('/')
    expect(tituloPrincipal()).toHaveTextContent('Cuna')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Cuna' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('una ruta inexistente muestra "No encontrada"', () => {
    renderizarEn('/no-existe')
    expect(tituloPrincipal()).toHaveTextContent('No encontrada')
  })

  it('el login no tiene formulario funcional', () => {
    renderizarEn('/login')
    expect(
      screen.getByText('Inicio de sesión pendiente de integración.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Layout', () => {
  it('muestra la marca y los cuatro enlaces de navegación', () => {
    renderizarEn('/cuna')
    expect(screen.getByText('Cuna Inteligente IoT')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    const enlaces = within(nav).getAllByRole('link')
    expect(enlaces.map((enlace) => enlace.textContent)).toEqual([
      'Cuna',
      'Colchón',
      'Figuras LED',
      'Historial',
    ])
  })

  it('resalta solo el enlace de la página activa', () => {
    renderizarEn('/figuras')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    const activos = within(nav)
      .getAllByRole('link')
      .filter((enlace) => enlace.getAttribute('aria-current') === 'page')
    expect(activos.map((enlace) => enlace.textContent)).toEqual(['Figuras LED'])
  })
})

describe('páginas sin datos', () => {
  it.each(['/cuna', '/colchon', '/figuras', '/historial'])(
    '%s avisa que no hay datos del dispositivo',
    (ruta) => {
      renderizarEn(ruta)
      expect(
        screen.getByText('Todavía no hay datos recibidos del dispositivo.'),
      ).toHaveAttribute('role', 'status')
    },
  )

  it('/cuna muestra Temperatura y Humedad "Sin datos" y el banner sin configurar', () => {
    renderizarEn('/cuna')
    for (const nombre of ['Temperatura', 'Humedad']) {
      const tarjeta = screen.getByRole('article', { name: nombre })
      expect(tarjeta).toHaveAttribute('data-estado', 'sin-datos')
      expect(tarjeta).toHaveTextContent('Sin datos')
    }
    expect(
      screen.getByText('Conexión con el servidor sin configurar.'),
    ).toBeInTheDocument()
  })

  it('Figuras muestra seis indicadores neutros "Sin datos"', () => {
    renderizarEn('/figuras')
    const lista = screen.getByRole('list', {
      name: 'Indicadores de figuras LED',
    })
    const figuras = within(lista).getAllByRole('listitem')
    expect(figuras).toHaveLength(6)
    for (const figura of figuras) {
      expect(figura).toHaveTextContent('Sin datos')
    }
  })
})
