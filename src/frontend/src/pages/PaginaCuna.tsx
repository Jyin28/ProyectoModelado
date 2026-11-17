import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import BannerConexion from '../components/BannerConexion.tsx'
import PanelLampara from '../components/PanelLampara.tsx'
import TarjetaLectura from '../components/TarjetaLectura.tsx'
import { useUltimaAmbiental } from '../hooks/useUltimaAmbiental.ts'
import {
  dispositivoAmbienteId,
  dispositivoLamparaId,
  lamparaHabilitada,
} from '../services/configuracion.ts'
import './paginas.css'

// El ambiente se mide cada 10 s: se tolera hasta 3 periodos sin lectura nueva.
const UMBRAL_AMBIENTE_S = 30

function PaginaCuna() {
  const { activo, cargando, fallo, lectura } =
    useUltimaAmbiental(dispositivoAmbienteId)

  return (
    <section className="pagina" aria-labelledby="titulo-cuna">
      <h1 id="titulo-cuna">Cuna</h1>
      {activo && fallo && <BannerConexion estado="desconectado" />}
      {activo && cargando && (
        <p role="status">Cargando la última lectura…</p>
      )}
      {!cargando && lectura === null && <AvisoSinDatos />}
      {!cargando && (
        <div className="rejilla-lecturas">
          <TarjetaLectura
            etiqueta="Temperatura"
            valor={lectura?.temperatura_c ?? null}
            unidad="°C"
            decimales={1}
            registradoEn={lectura?.registrado_en ?? null}
            umbralDesactualizadoS={UMBRAL_AMBIENTE_S}
          />
          <TarjetaLectura
            etiqueta="Humedad"
            valor={lectura?.humedad_pct ?? null}
            unidad="% HR"
            decimales={0}
            registradoEn={lectura?.registrado_en ?? null}
            umbralDesactualizadoS={UMBRAL_AMBIENTE_S}
          />
        </div>
      )}
      {lamparaHabilitada() && (
        <PanelLampara dispositivoId={dispositivoLamparaId()} />
      )}
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
