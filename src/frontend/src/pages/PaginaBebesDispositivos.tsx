import AvisoSinDatos from '../components/AvisoSinDatos.tsx'
import BannerConexion from '../components/BannerConexion.tsx'
import FormularioBebe from '../components/FormularioBebe.tsx'
import InvitacionesPendientes from '../components/InvitacionesPendientes.tsx'
import ReclamarModulo from '../components/ReclamarModulo.tsx'
import TarjetaModulo from '../components/TarjetaModulo.tsx'
import { useCuentas } from '../hooks/useCuentas.ts'
import { useServicios } from '../hooks/useServicios.ts'
import { formatearFechaCivil } from '../utils/tiempo.ts'
import './paginas.css'
import './cuentas.css'

function PaginaBebesDispositivos() {
  const { backendConfigurado } = useServicios()
  const { cargando, error, bebes, modulos, invitaciones, recargar } =
    useCuentas()

  return (
    <section className="pagina" aria-labelledby="titulo-bebes">
      <h1 id="titulo-bebes">Bebés y dispositivos</h1>
      {!backendConfigurado && <AvisoSinDatos />}
      {backendConfigurado && cargando && <p role="status">Cargando…</p>}
      {backendConfigurado && !cargando && error && (
        <>
          <BannerConexion estado="desconectado" />
          <p role="alert">{error}</p>
        </>
      )}
      {backendConfigurado && !cargando && !error && (
        <>
          <InvitacionesPendientes
            invitaciones={invitaciones}
            alAceptar={recargar}
          />

          <section aria-labelledby="titulo-bebes-lista">
            <h2 id="titulo-bebes-lista">Bebés</h2>
            {bebes.length === 0 ? (
              <p role="status">Todavía no hay bebés registrados.</p>
            ) : (
              <ul>
                {bebes.map((b) => (
                  <li key={b.id}>
                    {b.nombre}
                    {b.fecha_nacimiento
                      ? ` · nació el ${formatearFechaCivil(b.fecha_nacimiento)}`
                      : ''}
                  </li>
                ))}
              </ul>
            )}
            <FormularioBebe alCrear={recargar} />
          </section>

          <section aria-labelledby="titulo-modulos">
            <h2 id="titulo-modulos">Módulos asociados</h2>
            {modulos.length === 0 ? (
              <p role="status">
                Todavía no hay módulos asociados a esta cuenta.
              </p>
            ) : (
              <div className="rejilla-modulos">
                {modulos.map((m) => (
                  <TarjetaModulo
                    key={m.id}
                    modulo={m}
                    bebes={bebes}
                    alCambiar={recargar}
                  />
                ))}
              </div>
            )}
            <ReclamarModulo alReclamar={recargar} />
          </section>
        </>
      )}
    </section>
  )
}

export default PaginaBebesDispositivos
