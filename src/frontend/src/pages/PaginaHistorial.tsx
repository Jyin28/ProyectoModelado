import { useMemo, useState } from 'react'
import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import BotonExportar from '../components/BotonExportar.tsx'
import FormularioIntervaloHistorial, { type ConsultaElegida } from '../components/FormularioIntervaloHistorial.tsx'
import GraficoEventosPorHora from '../components/GraficoEventosPorHora.tsx'
import GraficoMediciones from '../components/GraficoMediciones.tsx'
import ListaRegistros from '../components/ListaRegistros.tsx'
import ResumenNoche from '../components/ResumenNoche.tsx'
import { useCuentas } from '../hooks/useCuentas.ts'
import { useHistorial } from '../hooks/useHistorial.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { conteoPorHora, resumirNoche, seriesMedicion } from '../utils/historial.ts'
import './paginas.css'
import './historial.css'

function PaginaHistorial() {
  const { backendConfigurado } = useServicios()
  const { cargando: cargandoBebes, error: errorBebes, bebes } = useCuentas()
  const [consulta, setConsulta] = useState<ConsultaElegida | null>(null)
  const { cargando, error, datos } = useHistorial(consulta)

  const analisis = useMemo(() => {
    if (!datos || !consulta) return null
    return {
      resumen: resumirNoche(datos.registros, consulta.intervalo),
      cubos: conteoPorHora(datos.registros, consulta.intervalo),
      series: seriesMedicion(datos.registros),
    }
  }, [datos, consulta])

  const nombreBebe = bebes.find((b) => b.id === consulta?.bebeId)?.nombre ?? 'bebe'

  return (
    <section className="pagina" aria-labelledby="titulo-historial">
      <h1 id="titulo-historial">Historial</h1>
      {!backendConfigurado && (
        <>
          <AvisoSinDatos />
          <p>El historial se consulta en la nube; sin el backend configurado no hay datos que mostrar.</p>
        </>
      )}
      {backendConfigurado && cargandoBebes && <p role="status">Cargando…</p>}
      {backendConfigurado && !cargandoBebes && errorBebes && <p role="alert">{errorBebes}</p>}
      {backendConfigurado && !cargandoBebes && !errorBebes && bebes.length === 0 && (
        <p role="status">Todavía no hay bebés registrados. Agrega uno en «Bebés y dispositivos».</p>
      )}
      {backendConfigurado && !cargandoBebes && !errorBebes && bebes.length > 0 && (
        <>
          <p>
            Cada bebé tiene su propio historial. Elige un intervalo para ver el resumen, los gráficos y exportarlo.
          </p>
          <FormularioIntervaloHistorial bebes={bebes} ocupado={cargando} alConsultar={setConsulta} />
          {consulta && cargando && <p role="status">Consultando el historial…</p>}
          {consulta && !cargando && error && <p role="alert">{error}</p>}
          {consulta && datos && analisis && (
            <>
              {datos.truncado && (
                <p role="alert">
                  Hay más registros de los que se pueden cargar de una vez: este resultado es parcial. Acorta el
                  intervalo.
                </p>
              )}
              <ResumenNoche resumen={analisis.resumen} intervalo={consulta.intervalo} />
              <GraficoEventosPorHora cubos={analisis.cubos} />
              <GraficoMediciones series={analisis.series} />
              <ListaRegistros registros={datos.registros} />
              <BotonExportar
                registros={datos.registros}
                nombreBebe={nombreBebe}
                desde={consulta.intervalo.desde}
                truncado={datos.truncado}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}

export default PaginaHistorial
