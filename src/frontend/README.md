# src/frontend — Cuna Inteligente IoT

Aplicación web del Sprint 3. Tiene rutas y navegación entre las pantallas
previstas (Cuna, Colchón, Figuras LED, Historial), inicio de sesión con
formulario y rutas protegidas cuando el backend está configurado. Sin
backend (sin `.env.local`) la navegación es libre, en modo maqueta, y no
muestra datos.

Esta fase **no** incluye:

- Realtime, Storage ni consultas distintas de la última lectura de ambiente
  y de la última orden de la lámpara (Auth y esas consultas sí están
  implementadas; ver más abajo).
- Control de hardware verificado: el panel de la lámpara es opt-in y solo
  registra solicitudes y muestra lo que reporta la base.

Plan de trabajo de la web: [`PLAN.md`](PLAN.md).

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
| `/login`     | `pages/PaginaLogin.tsx`           | Formulario de correo y contraseña.            |
| `/cuna`      | `pages/PaginaCuna.tsx`            |                                               |
| `/colchon`   | `pages/PaginaColchon.tsx`         |                                               |
| `/figuras`   | `pages/PaginaFiguras.tsx`         | Seis indicadores neutros "Sin datos".         |
| `/historial` | `pages/PaginaHistorial.tsx`       |                                               |
| `*`          | `pages/PaginaNoEncontrada.tsx`    | Muestra "No encontrada".                      |

Todas las rutas salvo `/login` se muestran dentro de `components/Layout.tsx`
(encabezado, navegación, «Cerrar sesión» y pie). En pantallas de menos de
720 px la navegación es una barra fija inferior.

Todas las rutas salvo `/login` pasan por `components/RutaProtegida.tsx`:

- **Backend configurado:** sin sesión redirige a `/login` y, tras iniciar
  sesión, vuelve a la ruta pedida (solo rutas internas).
- **Sin backend:** no hay sesión posible; la navegación es libre (maqueta) y
  `/login` avisa que el inicio de sesión no está disponible.

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

La web lee estas variables, definidas en `.env.example`:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y, opcional,
`VITE_AMBIENTE_DEVICE_ID`, `VITE_LAMPARA_HABILITADA` y `VITE_LAMPARA_DEVICE_ID`
(las dos últimas, opcionales; ver «Lámpara en Cuna»).

```powershell
Copy-Item .env.example .env.local
```

Completar los valores en `.env.local` (archivo ignorado por git; nunca se
sube al repositorio). Reiniciar `npm.cmd run dev` después de cambiarlo.

**La clave de servicio (`service_role`) nunca se usa en la web.** Solo va la
clave publicable. La clave de servicio no debe copiarse a ningún archivo de
`src/frontend/`.

Sin `.env.local` la aplicación arranca y compila igual (modo maqueta), y el
banner muestra "Backend no configurado". Con las dos variables de Supabase
completas el cliente se crea (`src/services/supabase.ts`) y se exige
inicio de sesión.

`VITE_AMBIENTE_DEVICE_ID` es opcional (por defecto `cuna-ambiente-01`) e
indica el módulo cuya última lectura se consulta.

## Última lectura en Cuna

Con sesión iniciada, `/cuna` consulta `public.lecturas_ambiente` con la sesión
del usuario y la clave publicable (RLS limita las filas): última fila del
`device_id` configurado, ordenada por `ts`, `recibido_en` y `event_id`
descendente. Consulta al abrir y cada 10 s mientras la pantalla está abierta
(`services/lecturas.ts`, `hooks/useUltimaAmbiental.ts`). El resto de
servicios (`noConfigurado.ts`) sigue sin datos.

Estados: carga (primera consulta), "Sin datos" (consulta sin fila), "Actual" o
"Desactualizado" (más de 30 s desde `ts`, hora en Costa Rica) y, si falla la
consulta, aviso de conexión conservando la última lectura de la sesión.

### Probar con una cuenta existente, sin Pico

1. Copiar `.env.example` a `.env.local` y completar URL y clave publicable.
2. `npm.cmd run dev`, abrir la web e iniciar sesión con una cuenta existente.
3. En Cuna: si no hay filas visibles para esa cuenta y ese `device_id`,
   aparece "Sin datos". Si la cuenta ya tiene lecturas, aparece la última; pasa
   a "Desactualizado" a los 30 s de su `ts`.
4. Para ver el aviso de conexión, cortar la red del navegador (DevTools →
   Network → Offline): la última lectura se conserva con el aviso.

Esta fase no crea tablas, usuarios ni datos: la prueba usa lo que ya exista
en Supabase.

## Lámpara en Cuna (opt-in)

Los controles de la lámpara están **apagados por defecto**: sin
`VITE_LAMPARA_HABILITADA=true` (valor exacto) la pantalla Cuna queda como está,
sin panel ni consultas. `VITE_LAMPARA_DEVICE_ID` es opcional (por defecto
`cuna-lampara-01`). El flag no está habilitado en ningún `.env` del
repositorio; activarlo en `.env.local` solo cuando el backend de la lámpara
exista y la Pico esté probada.

Con el flag, backend configurado y sesión iniciada, `PanelLampara` ofrece un
campo entero de 0 a 100 y el botón «Solicitar nivel». Sin sesión no aparece.

- **Solicitud:** `services/lampara.ts` llama al RPC `public.solicitar_lampara`
  con `p_command_id` (`crypto.randomUUID()`), `p_device_id` y `p_level`.
- **Estado:** consulta `public.ordenes_lampara` bajo RLS (última fila del
  `device_id`, orden `creado_en` y `command_id` descendente) al abrir y cada
  2 s mientras el panel está montado, sin superponer consultas
  (`hooks/useLampara.ts`). Se descartan respuestas de otra cuenta, del panel
  desmontado o anteriores a una solicitud más reciente; ante un fallo se
  conserva la última orden de la misma cuenta.
- **Estados:** solicitud registrada (`pendiente`), orden enviada, confirmada por
  la Pico, error y sin respuesta (`pendiente` o `enviado` con `vence_en`
  superado según el reloj local). El nivel pedido se muestra aparte del nivel
  confirmado por la Pico, que solo dice lo que el firmware aplicó a su salida:
  **no prueba que la luz esté encendida**.
- Los errores se muestran con mensajes genéricos; nunca el texto del servidor.

Contrato: [`src/shared/contracts/lampara.md`](../shared/contracts/lampara.md).
Esta fase web no crea tablas, usuarios ni datos, y no se ha verificado contra
el Supabase real ni contra la Pico.

## Estado

**Implementado** (código y pruebas automáticas):

- Rutas, navegación, banner de conexión y estados «Sin datos» / «Desactualizado».
- Inicio y cierre de sesión con Supabase Auth, y rutas protegidas.
- Última lectura de ambiente en Cuna.
- Panel de la lámpara, opt-in.

**Verificado con el sistema real:** nada todavía. Auth, última lectura y
lámpara no se han probado contra el Supabase desplegado ni contra la Pico;
las pruebas automáticas usan dobles y no sustituyen esa verificación. Lo
pendiente de verificar, y lo que falta construir, está en [`PLAN.md`](PLAN.md)
y en la [validación de la base](../../docs/Sprint3/validacion-base.md).
