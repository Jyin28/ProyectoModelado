# src/frontend — Cuna Inteligente IoT

Aplicación web mínima del Sprint 3. Tiene rutas y navegación entre las
pantallas previstas (Cuna, Colchón, Figuras LED, Historial) sin conectarse
todavía a ningún backend ni dispositivo real.

Esta fase **no** incluye:

- Realtime, Storage ni consultas distintas de la última lectura de ambiente
  (Auth y esa consulta sí están implementadas; ver más abajo).
- Control de hardware.

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

La web lee estas variables, definidas en `.env.example`:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y, opcional,
`VITE_AMBIENTE_DEVICE_ID`.

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

## Última lectura en Cuna (fase 2)

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

## Último movimiento en Cuna (opt-in)

Con `VITE_MOVIMIENTO_HABILITADO=true` (por defecto apagado) y sesión iniciada,
`/cuna` muestra un panel «Último movimiento». Consulta
`public.eventos_movimiento` (`event_id,device_id,ts,recibido_en`) filtrando por
`VITE_MOVIMIENTO_DEVICE_ID` (por defecto `cuna-movimiento-01`), ordenada por
`ts`, `recibido_en` y `event_id` descendente, límite 1 (`services/lecturas.ts`,
`hooks/useUltimoMovimiento.ts`, `components/PanelMovimiento.tsx`). Consulta al
abrir y cada 10 s, sin superposición; si falla conserva el último dato de la
misma cuenta con un aviso, y con la tabla vacía muestra «Sin datos». La hora se
muestra en `America/Costa_Rica`.

Solo registra el último evento: no hay alerta por Telegram ni controles. No se
ha probado con hardware real.

## Estado

Aplicación base ejecutable. Pendiente: integración con Supabase, firmware y
datos reales del dispositivo ([validación de la base](../../docs/Sprint3/validacion-base.md)).
