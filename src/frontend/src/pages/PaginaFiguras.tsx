import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import FuncionesProducto from '../components/FuncionesProducto.tsx'
import PanelFiguras from '../components/PanelFiguras.tsx'
import PanelHorarios from '../components/PanelHorarios.tsx'
import { dispositivoFigurasId, ordenesHabilitadas } from '../services/configuracion.ts'
import './paginas.css'

function PaginaFiguras() {
  const habilitadas = ordenesHabilitadas()
  return (
    <section className="pagina pagina-modulo" aria-labelledby="titulo-figuras">
      <header className="modulo-cabecera">
        <h1 id="titulo-figuras">Figuras LED</h1>
        <div className="modulo-estado">
          <AvisoSinDatos />
        </div>
      </header>
      {habilitadas && (
        <FuncionesProducto
          funciones={[
            {
              id: 'secuencias',
              etiqueta: 'Secuencias e intervalo',
              icono: 'figuras',
              contenido: <PanelFiguras dispositivoId={dispositivoFigurasId()} />,
            },
            {
              id: 'horarios',
              etiqueta: 'Horarios',
              icono: 'horario',
              contenido: (
                <>
                  <PanelHorarios
                    dispositivoId={dispositivoFigurasId()}
                    tipo="figuras_encender"
                    titulo="Encender figuras"
                    descripcion="A cada hora se pide encender las figuras con la última secuencia que la Pico confirmó (con su intervalo en segundos); si no hay ninguna, se encienden todas fijas."
                  />
                  <PanelHorarios
                    dispositivoId={dispositivoFigurasId()}
                    tipo="figuras_apagar"
                    titulo="Apagar figuras"
                    descripcion="A cada hora se pide apagar todas las figuras."
                  />
                </>
              ),
            },
          ]}
        />
      )}
      <p className="modulo-nota">
        {habilitadas
          ? 'Las figuras no informan el estado de cada LED: aquí solo se ve la última orden y la confirmación de la Pico.'
          : 'El control de las figuras necesita las órdenes remotas habilitadas y una sesión iniciada; mientras tanto no se muestra ningún estado.'}
      </p>
    </section>
  )
}

export default PaginaFiguras
