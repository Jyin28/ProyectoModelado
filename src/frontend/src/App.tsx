import './App.css'

const FIGURAS_LED = [1, 2, 3, 4, 5, 6]

function App() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Cuna Inteligente IoT</h1>
        <p className="subtitle">Sprint 3 — base web verificable</p>
      </header>

      <p className="aviso" role="status">
        Todavía no hay datos recibidos del dispositivo.
      </p>

      <main className="modulos">
        <section className="modulo" aria-labelledby="modulo-cuna">
          <h2 id="modulo-cuna">Cuna</h2>
          <p>
            Sección reservada para la información de la cuna. La conexión con
            el dispositivo y el backend está pendiente de implementación.
          </p>
        </section>

        <section className="modulo" aria-labelledby="modulo-colchon">
          <h2 id="modulo-colchon">Colchón</h2>
          <p>
            Sección reservada para la información del colchón (presencia y
            peso). La lectura real del sensor está pendiente de
            implementación.
          </p>
        </section>

        <section className="modulo" aria-labelledby="modulo-figuras">
          <h2 id="modulo-figuras">Figuras LED</h2>
          <p>
            Seis indicadores visuales, uno por figura. No representan un
            estado físico confirmado: el control real del hardware aún no
            está implementado.
          </p>
          <ul className="figuras" aria-label="Indicadores de figuras LED">
            {FIGURAS_LED.map((numero) => (
              <li key={numero} className="figura">
                <span className="figura-punto" aria-hidden="true" />
                <span className="figura-etiqueta">Figura {numero}</span>
                <span className="figura-estado">Sin datos</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="page-footer">
        <p>
          Aplicación base del Sprint 3. La integración con Supabase y el
          firmware de la Raspberry Pi Pico 2 W todavía está pendiente de
          prueba.
        </p>
      </footer>
    </div>
  )
}

export default App
