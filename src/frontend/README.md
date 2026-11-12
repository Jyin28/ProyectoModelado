# src/frontend — Cuna Inteligente IoT

Aplicación web mínima del Sprint 3. Tiene rutas y navegación entre las
pantallas previstas (Cuna, Colchón, Figuras LED, Historial) sin conectarse
todavía a ningún backend ni dispositivo real.

Esta fase **no** incluye:

- Consultas a Supabase (Auth, PostgreSQL, Realtime, Storage). El cliente
  está preparado, pero no se consulta ninguna tabla.
- Lecturas reales de sensores ni control de hardware.
- Autenticación de usuarios.

## Requisitos

- Node.js 24.x (probado con 24.22.2).
- npm 11.x (probado con 11.19.1).

## Instalación

Desde `src/frontend`:

```powershell
npm.cmd ci
```

## Comandos

```powershell
npm.cmd run dev     # Servidor de desarrollo (http://localhost:5173 por defecto)
npm.cmd run build   # Compilación de producción (tsc -b && vite build)
npm.cmd run lint    # Revisión estática con oxlint
npm.cmd run preview # Sirve el build de producción localmente
npm.cmd run test    # Pruebas automáticas (vitest run)
npm.cmd run test:watch # Pruebas en modo observación
```

## Rutas

Enrutado con `react-router` en modo declarativo (`BrowserRouter` en
`src/main.tsx`, rutas en `src/App.tsx`).

| Ruta         | Pantalla                          | Notas                                         |
| ------------ | --------------------------------- | --------------------------------------------- |
| `/`          | —                                 | Redirige a `/cuna`.                           |
| `/login`     | `pages/PaginaLogin.tsx`           | Sin formulario; integración pendiente.        |
| `/cuna`      | `pages/PaginaCuna.tsx`            |                                               |
| `/colchon`   | `pages/PaginaColchon.tsx`         |                                               |
| `/figuras`   | `pages/PaginaFiguras.tsx`         | Seis indicadores neutros "Sin datos".         |
| `/historial` | `pages/PaginaHistorial.tsx`       |                                               |
| `*`          | `pages/PaginaNoEncontrada.tsx`    | Muestra "No encontrada".                      |

Todas las rutas salvo `/login` se muestran dentro de `components/Layout.tsx`
(encabezado, navegación y pie). En pantallas de menos de 720 px la navegación
es una barra fija inferior.

**Hosting estático:** al desplegar el `dist/`, el servidor debe redirigir
todas las rutas a `index.html` (fallback de SPA). Sin esa regla, recargar o
abrir directamente `/cuna` o `/figuras` devuelve 404. `npm.cmd run dev` y
`npm.cmd run preview` ya lo hacen.

## Pruebas

Vitest con entorno jsdom y Testing Library. Los tests viven en `tests/` y el
archivo `tests/setup.ts` registra los matchers de jest-dom. Los datos de
ejemplo solo se usan dentro de los tests. Para correr lint, build y test
juntos, usar el comando `/verificar` de Claude Code.

En una terminal que no sea PowerShell (por ejemplo, Git Bash) puede usarse
`npm` en lugar de `npm.cmd`.

## Variables de entorno

La web lee solo dos variables, definidas en `.env.example`:
`VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

```powershell
Copy-Item .env.example .env.local
```

Completar los valores en `.env.local` (archivo ignorado por git; nunca se
sube al repositorio). Reiniciar `npm.cmd run dev` después de cambiarlo.

**La clave de servicio (`service_role`) nunca se usa en la web.** Solo va la
clave publicable. La clave de servicio no debe copiarse a ningún archivo de
`src/frontend/`.

Sin `.env.local` la aplicación arranca y compila igual, y el banner muestra
"Backend no configurado". Con las variables completas el cliente se crea
(`src/services/supabase.ts`), pero todavía no se consulta ninguna tabla: el
banner muestra "Integración pendiente" hasta que exista un servicio real.
Los servicios (`src/services/tipos.ts`) usan por ahora la implementación
`noConfigurado.ts`, que responde "Backend no configurado" sin datos.

## Estado

Aplicación base ejecutable. Pendiente: integración con Supabase, firmware y
datos reales del dispositivo ([validación de la base](../../docs/Sprint3/validacion-base.md)).
