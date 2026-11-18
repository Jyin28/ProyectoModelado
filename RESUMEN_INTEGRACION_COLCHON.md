# Resumen Técnico: Integración del Colchón Inteligente (Sprint 3)

**Proyecto:** Cuna Inteligente IoT — Módulo Colchón y Figuras LED (Raspberry Pi Pico 2 W + Supabase + React)  
**Fecha:** 18 de noviembre de 2026  
**Responsable:** Equipo de Desarrollo / Antigravity Agent  

---

## 1. Identificadores y Credenciales Clave del Sistema

Estos valores vinculan la aplicación web, la base de datos de Supabase y el microcontrolador físico:

| Parámetro | Valor | Ubicación / Uso |
|---|---|---|
| **Device ID Colchón** | `pico-figuras-colchon-01` | `.env.local` (`VITE_COLCHON_DEVICE_ID`), `config.py` en la Pico y base de datos. |
| **Usuario Cuidador (Auth)** | `abf7efd4-4dc6-4975-820b-c6b633eebf93` | Email `kev.hernandezr@gmail.com` en `auth.users`. |
| **Bebé ID** | `a2d531d5-2349-439c-a087-4e538be5579c` | `cuna_private.bebes`, asignado en eventos del colchón. |
| **Pico `DEVICE_TOKEN` (secreto)** | `7a471f9e008f9942f60d2b5f1a6e5d84043e7d0654c18ddc2e1d97b58d020cfd` | En `src/firmware/pico/common/utilities/secrets.py`. |
| **Token SHA-256** | `37bb59b5518bb850335e132453757b80de630cedbd9394eef650778147ddc557` | Almacenado en `cuna_private.dispositivos(token_sha256)`. |
| **Supabase URL** | `https://tlbwsdnqhwvuvgjcxgsg.supabase.co` | Endpoint del backend. |
| **Ingesta Edge Function** | `https://tlbwsdnqhwvuvgjcxgsg.supabase.co/functions/v1/ingesta` | Endpoint de envío de eventos desde la Pico. |

---

## 2. Diagnóstico de los Problemas Encontrados

Durante la sesión se resolvieron dos bloqueos principales y se identificó la causa de la aparente "inactividad" de los botones:

### Problema A: "Todavía no hay datos recibidos del dispositivo" (Eventos no visibles)
* **Causa:** Las políticas de Row Level Security (RLS) en `public.eventos_colchon` exigen que el usuario autenticado sea dueño activo del dispositivo mediante `cuna_private.es_dueno_activo(device_id)`. Como el usuario ni el dispositivo estaban registrados en `cuna_private`, PostgREST devolvía un array vacío `[]`.
* **Solución:** Se insertaron el dispositivo y la relación de dueño en `cuna_private.dispositivos` y `cuna_private.duenos_dispositivo`. Tras esto, los eventos comenzaron a responder con HTTP 200 y se mostraron en la UI.

### Problema B: "No se pudo registrar la orden para el colchón" (Error en botones)
* **Causa 1:** La RPC `solicitar_comando_colchon` validaba permisos con `duenos_dispositivo` y fallaba con `42501 (no_autorizado)`.
* **Causa 2:** El servicio frontend intentaba un fallback directo haciendo un `INSERT` en `ordenes_colchon`, pero la tabla exige columnas obligatorias no nulas (`solicitante_id`, `vence_en`) que no eran provistas.
* **Solución:** Se corrigió [colchon.ts](file:///c:/Users/kevin/Documents/Develoment/ProyectoModelado/src/frontend/src/services/colchon.ts) para depender estrictamente de la RPC autorizada y se ejecutó la migración SQL para habilitar al usuario.

### Problema C: Los botones no cambian el estado en la pantalla ("No funcionan")
* **Causa real identificada:**
  1. En el Network tab de DevTools se comprobó que `solicitar_comando_colchon` retorna **200 OK**. La orden **sí se registra con éxito** en la tabla `public.ordenes_colchon` en estado `pendiente`.
  2. **La Web UI es reactiva al hardware:** No cambia el badge a *"🟢 Monitoreando Presencia"* por el simple clic en el botón. El estado de la UI se deduce estrictamente a partir de los eventos recibidos desde el colchón (`eventos_colchon`).
  3. **El eslabón faltante en la Pico:** En el firmware de la Raspberry Pi Pico (`src/firmware/pico/common/communication/nube.py`, línea 84):
     ```python
     def leer_comandos():
         # La recepción de órdenes por Realtime se implementará en otra fase.
         return []
     ```
     La Pico **actualmente retorna una lista vacía y nunca consulta órdenes en Supabase**.
  4. Dado que la Pico nunca toma la orden `mattress_start`, no activa el sensor ni emite el evento `monitoring_started`. Por ende, la web sigue mostrando el último evento histórico (`monitoring_stopped` con `reason: timer`).

---

## 3. Estado de las Tablas y Funciones en Supabase

### Tabla: `public.eventos_colchon`
Almacena el historial y estado del colchón emitido por el microcontrolador:
* `event_id` (UUID PK)
* `device_id` (text, FK `cuna_private.dispositivos`)
* `bebe_id` (UUID, FK `cuna_private.bebes`)
* `ts` (timestamptz de ocurrencia en la Pico)
* `recibido_en` (timestamptz de inserción en backend)
* `tipo` (`monitoring_started` | `alarm_started` | `alarm_stopped` | `monitoring_stopped`)
* `datos` (jsonb con `weight_g`, `reference_g`, `threshold_g`, `duration_s`, `tolerance_pct`, `reason`)

### Tabla: `public.ordenes_colchon`
Cola de órdenes enviadas desde la web hacia el colchón:
* `command_id` (UUID PK)
* `device_id` (text)
* `command` (`mattress_start`, `mattress_stop`, `alarm_stop`, `mattress_reference`, `scale_tare`, `scale_calibrate`, `get_status`)
* `solicitante_id` (UUID del cuidador)
* `params` (jsonb: `{ "duration_s": 120, "tolerance_pct": 10, "alarm_s": 60 }`)
* `creado_en` y `vence_en` (vigencia de 30 segundos)
* `estado` (`pendiente` -> `enviado` -> `confirmado` | `error`)

### Funciones RPC Implementadas
1. `public.solicitar_comando_colchon`: Invocada por la Web (cuidador autenticado) para registrar una orden.
2. `public.tomar_ordenes_colchon`: Invocada por la Pico mediante su `p_device_id` y `p_token_sha256` para reclamar órdenes pendientes (marca como `enviado`).
3. `public.confirmar_orden_colchon`: Invocada por la Pico tras ejecutar la orden para marcarla `confirmado` o `error`.

---

## 4. Cambios Aplicados en el Código

1. **Frontend — Retroalimentación Visual Inmediata:**
   * Archivo: [PaginaColchon.tsx](file:///c:/Users/kevin/Documents/Develoment/ProyectoModelado/src/frontend/src/pages/PaginaColchon.tsx) y [useColchon.ts](file:///c:/Users/kevin/Documents/Develoment/ProyectoModelado/src/frontend/src/hooks/useColchon.ts).
   * Se agregó `mensajeExito`: Al hacer clic en *"Iniciar Monitoreo"*, *"Capturar Referencia"* o *"Tarar Balanza"*, la interfaz muestra de inmediato un aviso en verde:
     > `✓ Orden "Iniciar Monitoreo" registrada en Supabase (pendiente de ejecución por el colchón).`
   * Si ocurre un error de red o permisos, se muestra en rojo con detalle.

2. **Frontend — Limpieza del Servicio Colchón:**
   * Archivo: [colchon.ts](file:///c:/Users/kevin/Documents/Develoment/ProyectoModelado/src/frontend/src/services/colchon.ts).
   * Se eliminó el intento de `insert` manual en `ordenes_colchon` que fallaba por RLS y constraints, dejando la llamada limpia a `rpc(RPC_SOLICITAR_COMANDO_COLCHON)`.

3. **Migraciones SQL en el Repositorio:**
   * `supabase/migrations/20261118000100_eventos_y_ordenes_colchon.sql`: Esquema completo de eventos, órdenes y las 3 funciones RPC.
   * `supabase/migrations/20261118000200_registrar_usuario_colchon.sql`: Registro de credenciales del dispositivo y cuidador.
   * `supabase/diagnostico_colchon.sql`: Script de verificación rápida.

---

## 5. Cómo Probar el Ciclo Completo

### Opción A: Prueba con Hardware (Pico 2 W)
Para que la Pico atienda los botones de la web, en `src/firmware/pico/common/communication/nube.py` debe implementarse la consulta a `tomar_ordenes_colchon`.
En el ciclo principal (`main.py`):
1. `atender_ordenes()` llamará a `nube.leer_comandos()`.
2. La función consulta `POST /rest/v1/rpc/tomar_ordenes_colchon` con `device_id` y `token_sha256`.
3. La Pico ejecuta `comandos.ejecutar(orden)`.
4. El comando `mattress_start` inicia el pesaje e inserta el evento `monitoring_started` en Supabase.
5. La pantalla web detecta el evento y cambia a **🟢 Monitoreando Presencia** automáticamente.

### Opción B: Simulación Inmediata en Supabase (Sin cablear la Pico)
Para verificar cómo reacciona la pantalla web a una orden iniciada, se puede insertar manualmente un evento de monitoreo activo en Supabase SQL Editor:

```sql
insert into public.eventos_colchon (
    event_id,
    device_id,
    bebe_id,
    ts,
    recibido_en,
    tipo,
    datos
) values (
    gen_random_uuid(),
    'pico-figuras-colchon-01',
    'a2d531d5-2349-439c-a087-4e538be5579c',
    clock_timestamp(),
    clock_timestamp(),
    'monitoring_started',
    '{"reference_g": 200, "tolerance_pct": 10, "duration_s": 120, "alarm_s": 60}'::jsonb
);
```
Al correr este query y recargar la página:
* El badge cambiará inmediatamente a **🟢 Monitoreando Presencia**.
* El **Peso de Referencia** mostrará **200.0 g**.
* El **Umbral de Disparo** calculará automáticamente **180.0 g** (200g - 10%).
* Aparecerá el botón rojo de peligro **"Detener Monitoreo"**.

---

## 6. Regla de Inactividad y Latido (Timeout de 40 Segundos)

Para evitar que la interfaz web quede bloqueada en *"🟢 Monitoreando Presencia"* cuando el hardware real está apagado o desincronizado:

1. **Timeout en Frontend (`useColchon.ts`):**
   * Si el último evento fue `monitoring_started` pero han pasado **más de 40 segundos** (o superó `duration_s`) sin nuevos eventos de la Pico, la aplicación lo considera automáticamente **inactivo / detenido**.
   * El badge pasa a `⏹️ Monitoreo Inactivo (motivo: inactividad (> 40 s))` y los botones de control se habilitan nuevamente.

2. **Latido en la Pico 2 W (`main.py`):**
   * Mientras el colchón está monitoreando activamente, emite un pulso cada **20 segundos** para renovar su vigencia en la nube.
   * Si la Pico se apaga o pierde conexión por más de 40 segundos, la web se actualiza por sí sola a inactivo.
   * Al encender (`boot`), la Pico notifica a Supabase que arranca en estado detenido para sincronizar el historial.
   * Si la web envía `mattress_stop` y la Pico ya estaba detenida, no falla con error; notifica `monitoring_stopped` con `reason: web_sync` para desbloquear la web.
