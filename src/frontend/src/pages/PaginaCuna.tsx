import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import TarjetaLectura from '../components/TarjetaLectura.tsx'
import './paginas.css'

// El ambiente se mide cada 10 s: se tolera hasta 3 periodos sin lectura nueva.
const UMBRAL_AMBIENTE_S = 30

function PaginaCuna() {
  return (
    <section className="pagina" aria-labelledby="titulo-cuna">
      <h1 id="titulo-cuna">Cuna</h1>
      <AvisoSinDatos />
      <div className="rejilla-lecturas">
        <TarjetaLectura
          etiqueta="Temperatura"
          valor={null}
          unidad="°C"
          decimales={1}
          registradoEn={null}
          umbralDesactualizadoS={UMBRAL_AMBIENTE_S}
        />
        <TarjetaLectura
          etiqueta="Humedad"
          valor={null}
          unidad="% HR"
          decimales={0}
          registradoEn={null}
          umbralDesactualizadoS={UMBRAL_AMBIENTE_S}
        />
      </div>
      <p>
        Sección reservada para la información de la cuna. La conexión con el
        dispositivo y el backend está pendiente de implementación.
      </p>
    </section>
  )
}

export default PaginaCuna
