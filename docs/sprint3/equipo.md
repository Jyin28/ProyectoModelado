# Sprint 3 — Equipo y responsabilidades

## Persona A — Web

- Desarrollo de `apps/web`.
- Preparación de archivos de audio.
- Apoyo en pruebas.

## Persona B — Backend / Supabase

- Supabase (Auth, PostgreSQL, RLS, Storage, pg_cron).
- Seguridad y contratos de comunicación (formato de ingesta HTTPS y de
  comandos Realtime/WSS).
- Integración con Telegram.
- Coordinación general de la integración entre web, backend y firmware.

## Persona C — Firmware

- Firmware único de la Raspberry Pi Pico 2 W (`firmware/pico`).
- Coordinación con quienes montan los circuitos en las tres protoboards.

## Notas de coordinación

- El contrato de datos (ingesta y comandos) debe acordarse entre Persona B
  y Persona C antes de implementar la conexión real.
- La web (Persona A) debe poder evolucionar de datos simulados a datos
  reales sin rediseñar la interfaz base de esta fase.
