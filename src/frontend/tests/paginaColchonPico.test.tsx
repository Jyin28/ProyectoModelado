import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from '../src/App.tsx'
import ProveedorServicios from '../src/components/ProveedorServicios.tsx'
import type { EventoColchonPico } from '../src/models/colchonPico.ts'
import { serviciosNoConfigurados } from '../src/services/noConfigurado.ts'
import type { Servicios, Sesion } from '../src/services/tipos.ts'

const SESION: Sesion = { usuario_id: 'u-1', correo: 'usuario@ejemplo.test' }

function montar(evento: EventoColchonPico | null, historial: EventoColchonPico[] = []) {
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
    },
  }

  return render(
    <ProveedorServicios configurado servicios={servicios}>
      <MemoryRouter initialEntries={['/colchon-pico']}>
        <App />
      </MemoryRouter>
    </ProveedorServicios>,
  )
}

describe('PaginaColchonPico', () => {
  it('muestra estado detenido y formulario de inicio cuando no hay eventos', async () => {
    montar(null, [])
    expect(await screen.findByRole('heading', { level: 1, name: 'Colchón (Pico)' })).toBeInTheDocument()
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
})
