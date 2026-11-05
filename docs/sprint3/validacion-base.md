# Sprint 3 — Validación de la base web (resultados reales)

Fecha: 2026-11-04. Entorno: Windows, PowerShell/Git Bash.

## Versiones utilizadas

- `node -v` → `v24.22.2`
- `npm -v` → `11.19.1`

## Comandos ejecutados y resultados

| Comando | Resultado |
| --- | --- |
| `git status` (antes de editar) | Rama `main`, 10 archivos modificados y 8 sin seguimiento ya existentes de trabajo documental previo (no generados por esta fase). |
| `git checkout -b codex/sprint3-base` | Rama creada correctamente a partir de `main`; no existía previamente ni en local ni en `origin`. |
| `npm create vite@latest web -- --template react-ts` | Proyecto generado y luego movido a `apps/web/` (el comando no admite crear directamente en una subcarpeta anidada nueva). |
| `npm.cmd install` (en `apps/web`) | `added 28 packages`, `0 vulnerabilities`. |
| `npm.cmd run lint` (oxlint) | Sin errores ni advertencias. |
| `npm.cmd run build` (`tsc -b && vite build`) | Compiló correctamente. Salida: `dist/index.html` (0.47 kB), `dist/assets/index-*.css` (1.82 kB), `dist/assets/index-*.js` (221.44 kB). |
| `npm.cmd run dev` (en segundo plano) + `curl http://localhost:5173/` | `HTTP_STATUS:200`. El `<title>` devuelto es `Cuna Inteligente IoT`. |
| `git diff --check` | Sin errores de espacios en blanco en los archivos modificados. |

## Archivos creados o modificados

Creados:

- `apps/web/` (proyecto Vite + React + TypeScript completo: `src/App.tsx`,
  `src/App.css`, `src/index.css`, `src/main.tsx`, `index.html`,
  `package.json`, `package-lock.json`, `vite.config.ts`, archivos
  `tsconfig*.json`, `.oxlintrc.json`, `README.md`, `.env.example`,
  `public/favicon.svg`).
- `firmware/pico/README.md`
- `supabase/README.md`
- `docs/sprint3/alcance.md`
- `docs/sprint3/equipo.md`
- `docs/sprint3/entorno.md`
- `docs/sprint3/validacion-base.md` (este archivo)
- `CLAUDE.md`

Modificados:

- `.gitignore` (se amplió; se conservó la línea `/tmp/` existente y se
  agregaron reglas para `node_modules/`, `dist/`, `dist-ssr/`, archivos
  `.env*` con excepción explícita de `.env.example`).

No se modificó ningún archivo de documentación académica previa
(`README.md` de raíz, `EspecificacionRequerimientos.md`, `Jira/`,
`Sprint1/`, `Material/`, `Material del profe/`, `output/`).

## Comprobaciones realmente hechas

- Versiones de Node y npm de la terminal real utilizada.
- Instalación de dependencias en `apps/web` (`npm.cmd install`).
- `npm.cmd run lint` → sin errores.
- `npm.cmd run build` → compiló sin errores (TypeScript + Vite).
- `npm.cmd run dev` levantado en segundo plano y verificado con una
  petición HTTP real (`curl`), confirmando código `200` y el `<title>`
  esperado.
- `git diff --check` sobre los cambios de esta fase.
- Revisión manual del contenido de `apps/web/src/App.tsx` para confirmar
  que no incluye mediciones inventadas ni controles que aparenten operar
  hardware: solo texto descriptivo y seis indicadores neutros
  ("Sin datos") para las figuras LED.
- Revisión del proyecto Supabase `cuna-inteligente-dev` por lectura
  (realizada en una interacción previa mediante MCP): proyecto
  `ACTIVE_HEALTHY`, región `us-west-2`, esquema `public` sin tablas. No se
  repitieron operaciones de escritura en esta fase.

## Revisión visual (360 px / 1280 px)

No se dispuso de una herramienta de navegador automatizado en esta sesión
para capturar la página en 360 px y 1280 px. **Esta revisión visual queda
pendiente.** Para hacerla manualmente:

1. Ejecutar `npm.cmd run dev` en `apps/web`.
2. Abrir `http://localhost:5173/` en el navegador.
3. Usar las herramientas de desarrollador (modo responsivo) para probar en
   360 px de ancho (celular) y 1280 px (computadora).

El CSS de `apps/web/src/App.css` usa una cuadrícula de una columna por
defecto y tres columnas a partir de 720 px de ancho (`@media (min-width:
720px)`), por lo que se espera que ambos anchos sean legibles, pero esto no
se ha confirmado visualmente de forma automatizada.

## Pendientes y errores encontrados

- Revisión visual automatizada en 360 px / 1280 px (sin herramienta
  disponible en esta sesión).
- El comando `npm create vite@latest web -- --template react-ts` no acepta
  crear el proyecto directamente en `apps/web` cuando `apps/` ya existe
  vacía; se generó en `web/` y se movió con `mv web apps/web`. No es un
  error de la aplicación, solo una particularidad del scaffolding.
- El proceso de `npm.cmd run dev` lanzado en segundo plano para la prueba
  de HTTP pudo seguir en ejecución al finalizar esta sesión. No se forzó su
  cierre por no haberlo solicitado el usuario; puede detenerse con
  `Ctrl+C` en la terminal donde corre, o cerrando esa terminal.
- No se encontraron errores de lint ni de compilación.

## Corrección posterior — exclusión de archivos .env (2026-11-04)

Se ajustó `.gitignore` de la raíz para excluir todas las variantes de
archivos de entorno (`.env`, `.env.*`), manteniendo la excepción explícita
para `.env.example`. La regla anterior solo cubría `.env`, `.env.local` y
`.env.*.local`, y no excluía variantes como `.env.production`.

Regla final:

```
.env
.env.*
*.key
*.pem
!.env.example
```

Comprobación con `git check-ignore -v` (sin crear archivos con secretos,
solo contra rutas hipotéticas que no existen en el repositorio):

| Ruta | ¿Ignorado? | Regla que aplica |
| --- | --- | --- |
| `apps/web/.env` | Sí | `.gitignore:9:.env` |
| `apps/web/.env.local` | Sí | `apps/web/.gitignore:13:*.local` (gitignore anidado del scaffold de Vite; la regla raíz `.env.*` también la cubriría) |
| `apps/web/.env.production` | Sí | `.gitignore:10:.env.*` |
| `apps/web/.env.example` | No (puede versionarse) | ninguna (excluida explícitamente por `!.env.example`) |

`git diff --check` sobre `.gitignore` tras el cambio: sin errores de
espacios en blanco.

## Distinción explícita: base ejecutable vs. funcionalidades IoT

**Implementado y verificado en esta fase (aplicación base ejecutable):**

- La web arranca con `npm.cmd run dev` y compila con `npm.cmd run build`.
- Lint pasa sin errores.
- La página muestra "Cuna Inteligente IoT", las tres secciones (Cuna,
  Colchón, Figuras LED), el aviso de que no hay datos recibidos del
  dispositivo, y seis indicadores "Sin datos" para las figuras LED.
- La app no requiere variables de entorno de Supabase para funcionar.

**No implementado (funcionalidades IoT, explícitamente fuera de esta
fase):**

- Firmware de la Pico 2 W (sensores, LED, buzzer, audio).
- Conexión real a Supabase (Auth, PostgreSQL, RLS, Ingesta, Realtime,
  Storage, Notificador, Telegram, pg_cron).
- Cualquier lectura o control real de hardware.
- Revisión eléctrica, mapa de GPIO y modelos exactos de módulos (ver
  `docs/sprint3/alcance.md` y `firmware/pico/README.md`).
