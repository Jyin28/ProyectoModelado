# Validación de la fase 7 · Kit de habitación

**Resultados reales de la ejecución del 2026-11-18.** Fase 7 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-17 y HU-18.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase6-colchon` |
| Rama de trabajo | `feat/fase7-habitacion` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |

Commits: `git log feat/fase6-colchon..feat/fase7-habitacion`.

## 1. Qué se construyó

**Deuda 1 del traspaso (pines).** `src/firmware/tests/test_config_y_comandos.py` ahora exige pines únicos **dentro de cada módulo** (`cuna`, `figuras`, `colchon`, `habitacion`) en lugar de entre todos. La Pico atiende un módulo por vez, así que dos módulos pueden compartir GPIO. Se conservó la prueba de los GPIO del WiFi.

**Base de datos** (`supabase/migrations/20261118000600_habitacion.sql`; solo archivo local):

- Reglas de órdenes por módulo concentradas en `cuna_private.comando_conocido`, `comando_solicitable` y `comando_de_modulo`. La tabla `ordenes_modulo` y `solicitar_orden` las usan, así que un módulo nuevo solo las amplía. El patrón de `device_id` ya admite `habitacion` y `alimentacion`.
- `room_monitor_set {sensor, enabled}` con parámetros exactos; al confirmarse, el estado guarda `monitoreo_puerta` o `monitoreo_movimiento`.
- Cuatro horarios (`habitacion_{puerta,movimiento}_{activar,desactivar}`) en `crear_orden_horario` y `procesar_horarios`.
- `public.ingestar_habitacion` (solo `service_role`): `puerta` y `movimiento_habitacion`, sin datos. Con el monitoreo de ese sensor confirmado como apagado responde `monitoreo_inactivo`. Cada evento nuevo crea su aviso por destinatario y una fila en `public.fotos`.
- `public.fotos` (estado `pendiente`, `guardada` o `fallida`, con ruta o motivo) y el almacén privado `fotos-habitacion` (JPEG y PNG, hasta 5 MiB) con políticas solo para dueños activos. No hay políticas de actualización ni de borrado.
- `registrar_foto` y `marcar_foto_fallida`. El aviso `foto_tomada` lleva un texto fijo y el vínculo al evento; nunca la imagen ni la ruta.

**Ingesta** (`supabase/functions/ingesta/`): acepta los dos tipos de la habitación, valida la forma antes de la base y rechaza una lectura de ambiente enviada con la credencial de la habitación.

**Contratos**: `src/shared/contracts/habitacion.md` y `room_monitor_set` en `ordenes.md`.

**Firmware** (`src/firmware/`): `habitacion/control_habitacion.py` (antirrebote, un evento por apertura o flanco del PIR, monitoreo independiente por sensor, sin alarma local ni dirección), `setup_habitacion.py` (reed GP4 con pull-up, PIR GP5), `room_monitor_set` en `comandos.py`, cola de eventos con `event_id` fijo y credencial `HABITACION_DEVICE_ID` y `HABITACION_TOKEN` (solo ejemplo, sin valores) en `ambiente.py`. Apagado por defecto (`HABITACION_HABILITADO = False`).

**Web** (`src/frontend/`): `/habitacion` con monitoreo por sensor y sus horarios (solo con `VITE_ORDENES_HABILITADAS=true`), eventos recientes con el estado de su foto y «Ver foto» con enlace de 60 s. `/habitacion/camara` (solo con `VITE_CAMARA_HABILITADA=true`): el teléfono sube las fotos pendientes o deja constancia de que la cámara no estuvo disponible.

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm.cmd test` (`supabase`) | **120 pruebas, 120 pasan** (97 previas + 23 de `habitacion.test.mjs`) |
| `npm.cmd test` (`src/frontend`) | **26 archivos, 330 pruebas, todas pasan** (289 previas + 41) |
| `npm.cmd run lint` / `npm.cmd run build` (`src/frontend`) | Sin hallazgos / correcto |
| `python -m unittest discover -s src/firmware/tests` | **284 pruebas, OK** (257 previas + 27) |
| `git grep` de patrones de secretos | Sin coincidencias |

Una corrida completa de `supabase` mostró una falla en `notificador.test.mjs` («recorrido completo»): el orden de envío de dos avisos con la misma marca de tiempo cambió. Ese archivo no carga la migración de esta fase y pasó en las tres repeticiones siguientes y en la corrida completa posterior. Es una prueba sensible al orden que ya existía; no se corrigió en esta fase.

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `habitacion.test.mjs` (PGlite, con un esquema `storage` mínimo) | Permisos por rol, parámetros, horarios en el minuto exacto, monitoreo por sensor, idempotencia, una foto por evento, políticas del almacén, texto fijo del aviso | Supabase real, el almacén real de Storage, concurrencia real, entrega a Telegram |
| `test_habitacion.py` | Antirrebote, un evento por acción, monitoreo por sensor, tope de la lista, comando y rechazos por módulo | Reed, PIR, cableado, TLS ni red reales |
| Pruebas web | Pantallas, validaciones, estados mostrados solo con datos informados, subida con doble de servicio | Supabase real, cámara real del teléfono |

Todo es evidencia simulada (S). Nada es físico (F).

## 4. Estado de los criterios

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-17.1 | parcial (S) | `room_monitor_set` y cuatro horarios | Reed y PIR reales; `pg_cron` real |
| CA-17.2 | parcial (S) | Un evento por apertura o flanco con el monitoreo activo | Sensores reales |
| CA-17.3 | parcial (S) | Aviso por destinatario; el módulo no tiene salida sonora | Entrega real a Telegram |
| CA-17.4 | parcial (S) | `datos = {}`; el firmware no distingue dirección | |
| CA-17.5 | parcial (S) | Dos eventos y dos solicitudes de foto con la misma hora | Dos sensores reales a la vez |
| CA-18.1 | parcial (S) | Solicitud de foto por evento | Prueba P3 con teléfono y almacén real |
| CA-18.2 | parcial (S) | Imagen en almacén privado y enlace de 60 s | Almacén real; tiempos medidos |
| CA-18.3 | parcial (S) | Una foto por evento, sin agrupar ni duplicar | |
| CA-18.4 | parcial (S) | Sin video ni imagen en la base; aviso sin imagen ni ruta | Telegram real |

Ninguno se declara verificado.

## 5. Decisiones y límites

- **Cámara de la maqueta: el teléfono** (opción (a) de la prueba P3). Es una decisión del plan de esta fase; la prueba P3 no se ejecutó. Una cámara conectada al módulo queda fuera.
- **Una foto sin subir queda `pendiente`.** La web lo muestra así. No hay vencimiento automático ni cierre inventado.
- **Una foto fallida se puede reintentar.** Al guardarla, el motivo se borra. Una foto guardada no se modifica.
- **Sin estado confirmado el evento se acepta**, igual que el PIR de la cuna. Con el monitoreo de ese sensor confirmado como apagado se rechaza con `409` sin reintento.
- **Reinicio de la Pico.** Como en el colchón, un reinicio devuelve el monitoreo a apagado sin avisar al servidor (fase 11).
- **Memoria y pila del hilo de red** (ahora también envía eventos de la habitación): sin medir en hardware.
- **Reglas de órdenes por módulo** quedaron en funciones; la fase 9 solo agrega su comando a `comando_conocido` y `comando_de_modulo` y sus parámetros a `params_orden_validos`.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Supabase real | Autorización para aplicar la migración 000600 y crear el almacén `fotos-habitacion` en `cuna-inteligente-dev` |
| Hardware | Reed (MC-38), PIR, cableado revisado, `secrets.py` con `HABITACION_DEVICE_ID` y `HABITACION_TOKEN` |
| Cámara | Teléfono con acceso a la web y prueba P3 con tiempos y denegación a otra cuenta |
| Telegram | Bot de prueba y vinculación |

## 7. Archivos

Creados: `supabase/migrations/20261118000600_habitacion.sql`, `supabase/tests/habitacion.test.mjs`, `src/shared/contracts/habitacion.md`, `src/firmware/habitacion/{control_habitacion.py, setup_habitacion.py}`, `src/firmware/tests/test_habitacion.py`, `src/frontend/src/{models/habitacion.ts, utils/habitacion.ts, services/habitacion.ts, hooks/useHabitacion.ts, components/{PanelMonitoreoHabitacion,PanelEventosHabitacion,PanelCamara}.tsx, pages/{PaginaHabitacion,PaginaCamara}.tsx}` y dos archivos de prueba web.

Modificados: `supabase/functions/ingesta/{handler.ts, index.ts}`, `supabase/package.json`, `src/firmware/{main.py, secrets.example.py, common/communication/ambiente.py, common/utilities/{config,comandos,modulo}.py}`, `src/firmware/tests/{_ruta, test_config_y_comandos, test_modulo}.py`, `src/frontend/src/{App.tsx, components/{Layout,ProveedorServicios}.tsx, models/ordenes.ts, services/{tipos,noConfigurado,configuracion,ordenes}.ts, utils/ordenes.ts, vite-env.d.ts}`, `src/frontend/.env.example` (`VITE_HABITACION_DEVICE_ID`, `VITE_CAMARA_HABILITADA`, sin secretos), `src/frontend/tests/rutas.test.tsx`, `src/shared/contracts/ordenes.md` y `docs/Sprint4/matriz-hu-ca.md` (HU-17 y HU-18: 3 verificados, 100 parciales, 42 pendientes).

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
