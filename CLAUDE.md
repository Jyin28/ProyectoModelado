# CLAUDE.md — Cuna Inteligente IoT

Contexto permanente para trabajar en este repositorio.

## Qué es este repositorio

Repositorio académico del proyecto Cuna Inteligente IoT. Contiene
documentación de requerimientos (`EspecificacionRequerimientos.md`, `Jira/`,
`Sprint1/`, etc.) y, a partir del Sprint 3, código del incremento web,
backend y firmware.

## Estructura

- `apps/web/` — aplicación web (React + TypeScript + Vite).
- `firmware/pico/` — firmware único de la Raspberry Pi Pico 2 W (pendiente).
- `supabase/` — backend Supabase (pendiente de implementación real).
- `docs/sprint3/` — alcance, equipo, entorno y validación del Sprint 3.
- Resto de carpetas (`Jira/`, `Sprint1/`, `Material/`, `output/`, etc.) —
  documentación académica previa; no modificar su contenido sin pedido
  explícito.

## Arquitectura completa del proyecto (visión, no todo implementado)

Seis módulos sobre Supabase: Auth, PostgreSQL con RLS, Ingesta (HTTPS),
Notificador, Realtime (WSS, comandos al firmware), Storage y Telegram, más
pg_cron para tareas programadas.

## Alcance vigente del Sprint 3

Cuna, colchón y figuras LED, controlados por una sola Raspberry Pi Pico 2 W,
alimentados por USB de computadora. Demostración mediante hotspot del
teléfono. Ver `docs/sprint3/alcance.md` para el detalle y las restricciones
de hardware vigentes (sensores, LED, resistencias, HX711, buzzer, audio).

## Reglas permanentes

- No declarar como aprobadas verificaciones que no se hayan comprobado
  realmente (revisión eléctrica, TLS/I²S en la Pico, mapa de GPIO, modelos
  exactos de módulos, fijación de la celda de carga).
- No mostrar mediciones inventadas en la web ni controles que aparenten
  operar hardware real mientras no exista integración real.
- No crear tablas, migraciones, políticas, funciones, usuarios ni datos en
  el proyecto Supabase `cuna-inteligente-dev` sin pedido explícito.
- No leer ni mostrar credenciales o secretos.
- No modificar el contenido de la documentación académica previa
  (`README.md` de raíz, `EspecificacionRequerimientos.md`, `Sprint1/`,
  `Jira/`, `Material/`, `Material del profe/`, `output/`) salvo pedido
  explícito.
- En PowerShell, usar `npm.cmd` cuando `npm` no se reconozca como comando.
- No hacer push ni operaciones remotas sin aprobación explícita.

## Comandos habituales

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```
