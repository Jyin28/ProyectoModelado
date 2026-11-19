import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import BannerConexion from '../components/BannerConexion.tsx'
import FuncionesProducto, { type FuncionProducto } from '../components/FuncionesProducto.tsx'
import PanelAudio from '../components/PanelAudio.tsx'
import PanelLampara from '../components/PanelLampara.tsx'
import PanelLimites from '../components/PanelLimites.tsx'
import PanelMonitoreoMovimiento from '../components/PanelMonitoreoMovimiento.tsx'
import PanelMovimiento from '../components/PanelMovimiento.tsx'
import PanelVoz from '../components/PanelVoz.tsx'
import TarjetaLectura from '../components/TarjetaLectura.tsx'
import { useUltimaAmbiental } from '../hooks/useUltimaAmbiental.ts'
import {
  dispositivoAmbienteId,
  dispositivoAudioId,
  dispositivoLamparaId,
  dispositivoMovimientoId,
  lamparaHabilitada,
  movimientoHabilitado,
  ordenesHabilitadas,
  productoCunaId,
  vozHabilitada,
} from '../services/configuracion.ts'
import './paginas.css'

// El ambiente se mide cada 2 s, pero el envío TLS de la Pico tarda segundos y puede
// reintentarse: se mantiene el umbral de 30 s antes de marcar la lectura desactualizada.
const UMBRAL_AMBIENTE_S = 30

function PaginaCuna() {
  const { activo, cargando, fallo, lectura } =
    useUltimaAmbiental(dispositivoAmbienteId)

  // Solo se ofrece lo que está habilitado: ninguna función aparenta operar
  // hardware si no hay integración real.
  const funciones: FuncionProducto[] = []
  if (lamparaHabilitada()) {
    funciones.push({
      id: 'lampara',
      etiqueta: 'Lámpara',
      icono: 'lampara',
      contenido: <PanelLampara dispositivoId={dispositivoLamparaId()} />,
    })
  }
  if (ordenesHabilitadas() || vozHabilitada()) {
    funciones.push({
      id: 'parlante',
      etiqueta: 'Parlante',
      icono: 'audio',
      contenido: (
        <>
          {ordenesHabilitadas() && <PanelAudio dispositivoId={dispositivoAudioId()} />}
          {vozHabilitada() && (
            <PanelVoz dispositivoId={dispositivoAudioId()} productoId={productoCunaId()} />
          )}
        </>
      ),
    })
  }
  if (movimientoHabilitado || ordenesHabilitadas()) {
    funciones.push({
      id: 'movimiento',
      etiqueta: 'Sensor de movimiento',
      icono: 'movimiento',
      contenido: ordenesHabilitadas() ? (
        <PanelMonitoreoMovimiento
          dispositivoId={dispositivoMovimientoId}
          previo={
            <PanelMovimiento dispositivoId={dispositivoMovimientoId} habilitado={movimientoHabilitado} />
          }
        />
      ) : (
        <PanelMovimiento dispositivoId={dispositivoMovimientoId} habilitado={movimientoHabilitado} />
      ),
    })
  }
  funciones.push({
    id: 'ambiente',
    etiqueta: 'Temperatura y humedad',
    icono: 'ambiente',
    contenido: <PanelLimites dispositivoId={dispositivoAmbienteId} />,
  })

  return (
    <section className="pagina pagina-modulo" aria-labelledby="titulo-cuna">
      <header className="modulo-cabecera">
        <h1 id="titulo-cuna">Cuna</h1>
        <div className="modulo-estado">
          {activo && fallo && <BannerConexion estado="desconectado" />}
          {activo && cargando && <p role="status">Cargando la última lectura…</p>}
          {!cargando && lectura === null && <AvisoSinDatos />}
        </div>
        {!cargando && (
          <div className="rejilla-lecturas rejilla-lecturas-compacta">
            <TarjetaLectura
              compacta
              etiqueta="Temperatura"
              valor={lectura?.temperatura_c ?? null}
              unidad="°C"
              decimales={1}
              registradoEn={lectura?.registrado_en ?? null}
              umbralDesactualizadoS={UMBRAL_AMBIENTE_S}
            />
            <TarjetaLectura
              compacta
              etiqueta="Humedad"
              valor={lectura?.humedad_pct ?? null}
              unidad="% HR"
              decimales={0}
              registradoEn={lectura?.registrado_en ?? null}
              umbralDesactualizadoS={UMBRAL_AMBIENTE_S}
            />
          </div>
        )}
      </header>

      <FuncionesProducto funciones={funciones} />

      {!activo && (
        <p>
          Sección reservada para la información de la cuna. La conexión con el
          dispositivo y el backend está pendiente de implementación.
        </p>
      )}
    </section>
  )
}

export default PaginaCuna
