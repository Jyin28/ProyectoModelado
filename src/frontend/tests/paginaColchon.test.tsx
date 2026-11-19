import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { EventoColchonPico } from '../src/models/colchonPico.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Servicios, Sesion } from '../src/services/tipos.ts'

const SESION: Sesion = { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' }

function montar(
  evento: EventoColchonPico | null,
  historial: EventoColchonPico[] = [],
  solicitarComando?: Servicios['colchonPico']['solicitarComando'],
) {
  const servicios: Servicios = {
    ...serviciosNoConfigurados,
    auth: {
      ...serviciosNoConfigurados.auth,
      obtenerSesion: () => Promise.resolve({ ok: true, datos: SESION }),
    },
    colchonPico: {
      ...serviciosNoConfigurados.colchonPico,
      obtenerUltimoEvento: () => Promise.resolve({ ok: true, datos: evento }),
      obtenerHistorialEventos: () => Promise.resolve({ ok: true, datos: historial }),
      suscribirEventos: () => () => {},
      ...(solicitarComando ? { solicitarComando } : {}),
    },
  }

  return render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/colchon']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

describe('PaginaColchon', () => {
  it('muestra estado detenido y formulario de inicio cuando no hay eventos', async () => {
    montar(null, [])
    expect(await screen.findByRole('heading', { level: 1, name: 'Colchón' })).toBeInTheDocument()
    expect(await screen.findByText('⏹️ Monitoreo Inactivo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar Monitoreo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capturar Referencia de Peso' })).toBeInTheDocument()
  })

  it('muestra estado monitoreando cuando el último evento es monitoring_started', async () => {
    const ahora = new Date().toISOString()
    const evento: EventoColchonPico = {
      event_id: 'ev-1',
      device_id: 'pico-figuras-colchon-01',
      bebe_id: 'b-1',
      ts: ahora,
      recibido_en: ahora,
      tipo: 'monitoring_started',
      datos: { duration_s: 120, reference_g: 200, tolerance_pct: 10 },
    }

    montar(evento, [evento])
    expect(await screen.findByText('🟢 Monitoreando Presencia')).toBeInTheDocument()
    expect(screen.getByText('200.0 g')).toBeInTheDocument()
    expect(screen.getByText('180.0 g')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Detener Monitoreo' })).toBeInTheDocument()
  })

  it('muestra alerta y banner cuando el último evento es alarm_started', async () => {
    const ahora = new Date().toISOString()
    const eventoAlarma: EventoColchonPico = {
      event_id: 'ev-alarm',
      device_id: 'pico-figuras-colchon-01',
      bebe_id: 'b-1',
      ts: ahora,
      recibido_en: ahora,
      tipo: 'alarm_started',
      datos: { weight_g: -0.04, reference_g: 200, threshold_g: 180 },
    }

    montar(eventoAlarma, [eventoAlarma])
    expect(await screen.findByText('🚨 ¡Alarma Activa (Pérdida de Peso)!')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Pérdida de peso detectada/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Detener Alarma/i })).toBeInTheDocument()
  })

  it('pasa a estado detenido si el evento monitoring_started supera los 40 s de inactividad', async () => {
    // Evento ocurrido hace 60 segundos (supera los 40s de timeout)
    const hace60s = new Date(Date.now() - 60_000).toISOString()
    const eventoViejo: EventoColchonPico = {
      event_id: 'ev-viejo',
      device_id: 'pico-figuras-colchon-01',
      bebe_id: 'b-1',
      ts: hace60s,
      recibido_en: hace60s,
      tipo: 'monitoring_started',
      datos: { duration_s: 120, reference_g: 200, tolerance_pct: 10 },
    }

    montar(eventoViejo, [eventoViejo])
    expect(await screen.findByText('⏹️ Monitoreo Inactivo')).toBeInTheDocument()
    expect(screen.getByText(/inactividad/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar Monitoreo' })).toBeInTheDocument()
  })

  it('calibrar exige un peso conocido válido y pide scale_calibrate con known_g', async () => {
    const solicitar = vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        datos: {
          command_id: 'c-1',
          device_id: 'pico-figuras-colchon-01',
          command: 'scale_calibrate',
          params: { known_g: 1000 },
          estado: 'pendiente' as const,
        },
      }),
    )
    montar(null, [], solicitar as unknown as Servicios['colchonPico']['solicitarComando'])
    const boton = await screen.findByRole('button', { name: 'Calibrar con Peso Conocido' })
    expect(boton).toBeDisabled()

    const campo = screen.getByLabelText('Peso conocido para calibrar (g)')
    fireEvent.change(campo, { target: { value: '9000' } })
    expect(boton).toBeDisabled()

    fireEvent.change(campo, { target: { value: '1000' } })
    expect(boton).toBeEnabled()
    fireEvent.click(boton)
    await waitFor(() =>
      expect(solicitar).toHaveBeenCalledWith('pico-figuras-colchon-01', 'scale_calibrate', { known_g: 1000 }),
    )
    expect(await screen.findByText(/Calibrar Balanza.*registrada/)).toBeInTheDocument()
  })

  it('calibrar no se ofrece con el monitoreo en marcha', async () => {
    const ahora = new Date().toISOString()
    const evento: EventoColchonPico = {
      event_id: 'ev-1',
      device_id: 'pico-figuras-colchon-01',
      bebe_id: 'b-1',
      ts: ahora,
      recibido_en: ahora,
      tipo: 'monitoring_started',
      datos: { duration_s: 120, reference_g: 200, tolerance_pct: 10 },
    }
    montar(evento, [evento])
    expect(await screen.findByText('🟢 Monitoreando Presencia')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Calibrar con Peso Conocido' })).not.toBeInTheDocument()
  })
})
