import './paginas.css'
import './PaginaLogin.css'

function PaginaLogin() {
  return (
    <div className="login">
      <p className="login-marca">Cuna Inteligente IoT</p>
      <section className="pagina" aria-labelledby="titulo-login">
        <h1 id="titulo-login">Inicio de sesión</h1>
        <p role="status">Inicio de sesión pendiente de integración.</p>
      </section>
    </div>
  )
}

export default PaginaLogin
