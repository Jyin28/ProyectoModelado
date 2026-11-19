import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import FuncionesProducto from '../components/FuncionesProducto.tsx'
import PanelFiguras from '../components/PanelFiguras.tsx'
import { dispositivoFigurasId, ordenesHabilitadas } from '../services/configuracion.ts'
import './paginas.css'

function PaginaFiguras() {
  const habilitadas = ordenesHabilitadas()
  return (
    <section className="pagina" aria-labelledby="titulo-figuras">
      <h1 id="titulo-figuras">Figuras LED</h1>
      {habilitadas && (
        <FuncionesProducto
          funciones={[
            {
              id: 'secuencias',
              etiqueta: 'Secuencias e intervalo',
              icono: 'figuras',
              contenido: <PanelFiguras dispositivoId={dispositivoFigurasId()} />,
            },
          ]}
        />
      )}
      <AvisoSinDatos />
      <p>
        {habilitadas
          ? 'Las figuras no informan el estado de cada LED: aquí solo se ve la última orden y la confirmación de la Pico.'
          : 'El control de las figuras necesita las órdenes remotas habilitadas y una sesión iniciada; mientras tanto no se muestra ningún estado.'}
      </p>
    </section>
  )
}

export default PaginaFiguras
