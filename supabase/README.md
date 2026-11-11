# supabase — Backend del proyecto

## Propósito

Backend del proyecto completo Cuna Inteligente IoT, basado en Supabase:

- **Auth**: autenticación de usuarios (familia/cuidadores).
- **PostgreSQL + RLS**: almacenamiento de lecturas y configuración, con
  seguridad a nivel de fila.
- **Ingesta**: recepción de datos del firmware por HTTPS.
- **Realtime (WSS)**: canal definitivo para el envío de comandos al
  firmware.
- **Notificador + Telegram**: alertas hacia los cuidadores.
- **Storage**: archivos asociados (p. ej. audio).
- **pg_cron**: tareas programadas (mantenimiento, resúmenes periódicos).

## Proyecto Supabase

- Nombre: `cuna-inteligente-dev`.
- Referencia: `tlbwsdnqhwvuvgjcxgsg`.
- Región: `us-west-2`.
- Estado comprobado por última vez: `ACTIVE_HEALTHY`.
- Esquema `public`: sin tablas (comprobado por lectura, sin cambios).
- Data API habilitada; exposición automática de tablas deshabilitada;
  RLS automático seleccionado al crear el proyecto.

Estos ajustes de Data API y RLS automático deben volver a comprobarse
cuando se implemente el backend, antes de exponer cualquier tabla.

## Estado: pendiente

No se han creado tablas, migraciones, políticas, funciones, usuarios ni
datos en este proyecto Supabase. Esta fase (Sprint 3 — base web) no
implementa ninguna conexión real al backend.

Responsable de esta área: Persona B (Supabase, seguridad, contratos de
comunicación, Telegram y coordinación de integración).
