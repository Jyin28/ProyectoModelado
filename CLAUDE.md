# CLAUDE.md — Cuna Inteligente IoT

Contexto permanente para trabajar en este repositorio.

## Qué es este repositorio

Repositorio académico del proyecto Cuna Inteligente IoT. Contiene
documentación de requerimientos (`docs/Requerimientos/`, `docs/Jira/`,
`docs/Sprint1/`, etc.) y, a partir del Sprint 3, código del incremento web,
backend y firmware.

## Estructura

- `src/frontend/` — aplicación web (React + TypeScript + Vite).
- `src/firmware/` — firmware único de la Raspberry Pi Pico 2 W (pendiente).
- `src/backend/` — carpetas reservadas para código de integración. El backend del Sprint 3 se implementará en Supabase.
- `supabase/` — backend Supabase (pendiente de implementación real).
- `docs/Sprint3/` — alcance, equipo, entorno y validación del Sprint 3.
- Resto de carpetas (`docs/Jira/`, `docs/Sprint1/`, `docs/Material/`,
  `docs/output/`, etc.) — documentación académica previa; no modificar su
  contenido sin pedido explícito.

## Arquitectura completa del proyecto (visión, no todo implementado)

Seis módulos sobre Supabase: Auth, PostgreSQL con RLS, Ingesta (HTTPS),
Notificador, Realtime (WSS, comandos al firmware), Storage y Telegram, más
pg_cron para tareas programadas.

## Alcance vigente del Sprint 3

Cuna, colchón y figuras LED, controlados por una sola Raspberry Pi Pico 2 W,
alimentados por USB de computadora. Demostración mediante hotspot del
teléfono. Ver `docs/Sprint3/alcance.md` para el detalle y las restricciones
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
  (`README.md` de raíz, `docs/Requerimientos/`, `docs/Sprint1/`,
  `docs/Jira/`, `docs/Material/`, `docs/Material del profe/`,
  `docs/output/`) salvo pedido explícito.
- En PowerShell, usar `npm.cmd` cuando `npm` no se reconozca como comando.
- No hacer push ni operaciones remotas sin aprobación explícita.

## Flujo por fases

Parte de `development` para cada tarea y prepara un pull request hacia esa
rama. `main` reúne las entregas estables. En cada avance, define qué se debe
demostrar, implementa solo lo necesario y registra la prueba de cierre.
El primer recorrido funcional es AM2301 → Supabase → web. Consulta el
[alcance](docs/Sprint3/alcance.md) y el [reparto](docs/Sprint3/equipo.md)
para coordinar las partes.

## Comandos habituales

```powershell
cd src\frontend
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```
