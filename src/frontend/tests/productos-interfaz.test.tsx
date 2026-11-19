import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import EscenaInteractiva from '../src/components/EscenaInteractiva.tsx'
import FuncionesProducto from '../src/components/FuncionesProducto.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import {
  ACCESOS_PRODUCTOS,
  IMAGEN_HABITACION,
} from '../src/models/productos.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Servicios } from '../src/services/tipos.ts'

function Ruta() {
  return <p data-testid="ruta">{useLocation().pathname}</p>
}

function abrirApp(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
      <Ruta />
    </MemoryRouter>,
  )
}

const ruta = () => screen.getByTestId('ruta').textContent

afterEach(() => vi.unstubAllEnvs())

// Centros que fija docs/prompts/claude-rediseno-interfaz.md (% desde arriba a la izquierda).
const ESPERADOS = [
  { nombre: 'Cuna', destino: '/cuna', x: '53%', y: '48%' },
  { nombre: 'Colchón', destino: '/colchon', x: '52%', y: '65%' },
  { nombre: 'Figuras LED', destino: '/figuras', x: '88%', y: '28%' },
  { nombre: 'Habitación', destino: '/habitacion', x: '36%', y: '32%' },
  { nombre: 'Alimentación', destino: '/alimentacion', x: '82%', y: '50%' },
]

describe('Productos: habitación interactiva', () => {
  it('usa la imagen incluida completa y en su proporción original', () => {
    abrirApp('/productos')
    const imagen = screen.getByRole('img', { name: /Habitación de bebé/ })
    expect(imagen).toHaveAttribute('src', '/productos/habitacion-interactiva.png')
    expect(imagen).toHaveAttribute('width', '1672')
    expect(imagen).toHaveAttribute('height', '941')
    expect(IMAGEN_HABITACION.ancho / IMAGEN_HABITACION.alto).toBeCloseTo(1672 / 941, 5)
    expect(imagen.parentElement).toHaveStyle({ aspectRatio: '1672 / 941' })
  })

  it.each(ESPERADOS)('el botón «$nombre» está en ($x, $y) y abre $destino', async ({ nombre, destino, x, y }) => {
    abrirApp('/productos')
    const escena = screen.getByRole('img', { name: /Habitación de bebé/ }).parentElement as HTMLElement
    const boton = within(escena).getByRole('link', { name: nombre })
    expect(boton.style.getPropertyValue('--x')).toBe(x)
    expect(boton.style.getPropertyValue('--y')).toBe(y)
    expect(boton).toHaveAttribute('href', destino)
    await userEvent.click(boton)
    expect(ruta()).toBe(destino)
  })

  it('en pantallas estrechas solo la cuna cambia de centro, hacia la izquierda y sin tocar al colchón', () => {
    const conCompacto = ACCESOS_PRODUCTOS.filter((a) => a.compacto)
    expect(conCompacto.map((a) => a.id)).toEqual(['cuna'])
    const cuna = ACCESOS_PRODUCTOS.find((a) => a.id === 'cuna')!
    expect(cuna.compacto!.x).toBeLessThan(cuna.x)

    // A 360 px de ancho (escena a pantalla completa) la imagen mide 202,6 px de alto.
    const W = 360
    const H = (W * 941) / 1672
    const px = (a: { x: number; y: number }) => ({ x: (a.x / 100) * W, y: (a.y / 100) * H })
    const centro = (a: (typeof ACCESOS_PRODUCTOS)[number]) => (a.compacto && W < 500 ? a.compacto : a)
    // Las áreas de 44 px solo se tocan si ambos desplazamientos son menores que 44.
    for (let i = 0; i < ACCESOS_PRODUCTOS.length; i++) {
      for (let j = i + 1; j < ACCESOS_PRODUCTOS.length; j++) {
        const a = px(centro(ACCESOS_PRODUCTOS[i]))
        const b = px(centro(ACCESOS_PRODUCTOS[j]))
        const separacion = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
        expect(separacion, `${ACCESOS_PRODUCTOS[i].id} y ${ACCESOS_PRODUCTOS[j].id}`).toBeGreaterThanOrEqual(44)
      }
    }
  })

  it('debajo ofrece los mismos cinco accesos con sus nombres', () => {
    abrirApp('/productos')
    const lista = screen.getByRole('navigation', { name: 'Accesos a los productos' })
    const enlaces = within(lista).getAllByRole('link')
    const principales = enlaces.filter((e) => ESPERADOS.some((x) => x.destino === e.getAttribute('href')))
    expect(principales.map((e) => [e.querySelector('strong')?.textContent, e.getAttribute('href')])).toEqual(
      ESPERADOS.map((e) => [e.nombre, e.destino]),
    )
    // Vistas especializadas: Colchón (Pico) sigue accesible.
    expect(within(lista).getByRole('link', { name: /Colchón \(Pico\)/ })).toHaveAttribute('href', '/colchon-pico')
  })

  it('la cámara del teléfono solo se ofrece si está habilitada', () => {
    abrirApp('/productos')
    expect(screen.queryByRole('link', { name: /Cámara del teléfono/ })).not.toBeInTheDocument()
    vi.stubEnv('VITE_CAMARA_HABILITADA', 'true')
    abrirApp('/productos')
    expect(screen.getByRole('link', { name: /Cámara del teléfono/ })).toHaveAttribute('href', '/habitacion/camara')
  })

  it('si la imagen no carga, los accesos de la lista siguen funcionando', async () => {
    abrirApp('/productos')
    fireEvent.error(screen.getByRole('img', { name: /Habitación de bebé/ }))
    expect(screen.queryByRole('img', { name: /Habitación de bebé/ })).not.toBeInTheDocument()
    const lista = screen.getByRole('navigation', { name: 'Accesos a los productos' })
    await userEvent.click(within(lista).getByRole('link', { name: /Cuna/ }))
    expect(ruta()).toBe('/cuna')
  })
})

describe('Navegación: Productos sigue seleccionado dentro de un módulo', () => {
  it('Atrás vuelve a la pantalla anterior', async () => {
    abrirApp('/productos')
    await userEvent.click(screen.getAllByRole('link', { name: 'Cuna' })[0])
    expect(ruta()).toBe('/cuna')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Productos' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(ruta()).toBe('/productos')
  })

  it('sin historial previo, Atrás lleva a Productos', async () => {
    abrirApp('/figuras')
    await userEvent.click(screen.getByRole('button', { name: /Atrás/ }))
    expect(ruta()).toBe('/productos')
  })
})

describe('Usuario', () => {
  it('muestra la sesión, el cierre de sesión y el acceso a Bebés y dispositivos', async () => {
    const servicios: Servicios = {
      ...serviciosNoConfigurados,
      auth: {
        ...serviciosNoConfigurados.auth,
        obtenerSesion: () =>
          Promise.resolve({ ok: true, datos: { usuario_id: 'u-1', correo: 'ana@ejemplo.test' } }),
      },
    }
    render(
      <ProveedorServicios configurado servicios={servicios}>
        <MemoryRouter initialEntries={['/usuario']}>
          <App />
          <Ruta />
        </MemoryRouter>
      </ProveedorServicios>,
    )
    expect(await screen.findByText('ana@ejemplo.test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Abrir «Bebés y dispositivos»/ }))
    expect(ruta()).toBe('/bebes')
    // Bebés y dispositivos cuelga de Usuario.
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Usuario' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('Funciones de un producto', () => {
  const imagen = { src: '/productos/prueba.png', ancho: 400, alto: 300, alt: 'Producto de prueba' }
  const funciones = [
    {
      id: 'luz',
      etiqueta: 'Lámpara',
      icono: 'lampara' as const,
      punto: { x: 20, y: 30 },
      contenido: <button type="button">Aplicar</button>,
    },
    {
      id: 'sonido',
      etiqueta: 'Parlante',
      icono: 'audio' as const,
      contenido: <p>Ajustes del parlante</p>,
    },
  ]

  it('tocar el botón de la imagen solo abre el panel, con foco; Escape lo cierra y devuelve el foco', async () => {
    const alAplicar = vi.fn()
    render(
      <FuncionesProducto
        imagen={imagen}
        funciones={[
          { ...funciones[0], contenido: <button type="button" onClick={alAplicar}>Aplicar</button> },
          funciones[1],
        ]}
      />,
    )
    const punto = screen.getByRole('button', { name: 'Lámpara', pressed: false })
    expect(punto).toHaveStyle({ '--x': '20%', '--y': '30%' })
    await userEvent.click(punto)
    const panel = screen.getByRole('dialog', { name: 'Lámpara' })
    expect(panel).toHaveFocus()
    expect(alAplicar).not.toHaveBeenCalled()
    expect(within(panel).getByRole('button', { name: 'Aplicar' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(punto).toHaveFocus()
  })

  it('la lista «Funciones» abre los mismos paneles y tiene cierre visible', async () => {
    render(<FuncionesProducto imagen={imagen} funciones={funciones} />)
    const lista = screen.getByRole('navigation', { name: 'Funciones' })
    // Solo la función con punto aparece sobre la imagen; las dos están en la lista.
    expect(within(lista).getAllByRole('button').map((b) => b.textContent)).toEqual(['Lámpara', 'Parlante'])
    await userEvent.click(within(lista).getByRole('button', { name: 'Parlante' }))
    const panel = screen.getByRole('dialog', { name: 'Parlante' })
    expect(within(panel).getByText('Ajustes del parlante')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('funciona aunque falte la imagen: sigue la lista', async () => {
    render(<FuncionesProducto imagen={imagen} funciones={funciones} />)
    fireEvent.error(screen.getByRole('img', { name: 'Producto de prueba' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Lámpara' }))
    expect(screen.getByRole('dialog', { name: 'Lámpara' })).toBeInTheDocument()
  })

  it('un panel vacío (sin sesión o backend) lo explica en vez de quedar en blanco', async () => {
    render(<FuncionesProducto funciones={[{ ...funciones[1], contenido: null }]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Parlante' }))
    const panel = screen.getByRole('dialog', { name: 'Parlante' })
    expect(panel.querySelector('.hoja-cuerpo')).toBeEmptyDOMElement()
    expect(within(panel).getByText(/necesita el backend configurado/)).toBeInTheDocument()
  })
})

describe('Escena interactiva', () => {
  it('cada punto tiene nombre accesible (el tamaño de 44 px se comprobó en el navegador)', () => {
    render(
      <EscenaInteractiva
        imagen={{ src: '/x.png', ancho: 100, alto: 50, alt: 'x' }}
        puntos={[{ id: 'a', etiqueta: 'Aparato', icono: 'peso', x: 10, y: 20, alSeleccionar: () => {} }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Aparato' })).toBeInTheDocument()
  })
})
