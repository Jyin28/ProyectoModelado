# Contrato de movimiento

Contrato del recorrido PIR → Ingesta → lectura web del Sprint 3. Cubre RF-08, CA-08.1 y CA-08.3 en la parte de registro. **No cubre la alerta por Telegram (CA-08.2), que queda en una fase aparte.** Este incremento no registra ni declara ninguna alerta enviada. Reutiliza el endpoint, la credencial por módulo y las reglas de reintento de [ambiente](ambiente.md).

## Pico a Supabase

`POST /functions/v1/ingesta` por HTTPS, con `Authorization: Bearer <token-del-módulo>`. El token es el dedicado a `cuna-movimiento-NN` (64 hex, distinto del de ambiente). Ejemplo con valores ilustrativos:

```json
{
  "event_id": "7b0d6c1e-2f3a-4c5b-9d8e-0a1b2c3d4e5f",
  "device_id": "cuna-movimiento-01",
  "tipo": "movimiento",
  "ts": "2026-11-11T16:04:10Z",
  "datos": {}
}
```

| Campo | Regla |
| --- | --- |
| `event_id` | UUID v4. Un reintento conserva UUID y `ts`. |
| `device_id` | Debe cumplir `^cuna-movimiento-[0-9]{2}$`. La maqueta usa `cuna-movimiento-01`. |
| `tipo` | Valor fijo `movimiento`. |
| `ts` | ISO 8601 UTC con `Z` y hasta tres decimales, igual que ambiente. |
| `datos` | Objeto vacío `{}`. Cualquier clave se rechaza con `400`. |

El evento ocupa hasta 2048 bytes. Respuestas: `201` guardado, `409` el mismo evento ya estaba guardado, `400` formato o `event_id` reutilizado con otro `device_id` o `ts`, `401` credencial inválida o de otro módulo, `422` sin bebé asignado en `ts`, `413`, `405` y `503` como en ambiente.

## Cuándo genera un evento el firmware

- Un evento por **flanco ascendente** del HC-SR501 (GPIO del PIR sin cambios).
- Solo si el monitoreo está explícitamente habilitado. Hay un único interruptor, local: `MONITOREO_MOVIMIENTO_HABILITADO` en `src/firmware/common/utilities/config.py`, con valor `False` por defecto. Para la maqueta se pone `True` en ese archivo y se completan `MOVIMIENTO_DEVICE_ID` y `MOVIMIENTO_TOKEN` en `secrets.py`. No hay activación remota ni horario en este incremento.
- Sin hora NTP confiable, con el monitor deshabilitado o sin conexión, el evento se omite. Nunca se acumula: el firmware guarda como máximo un evento pendiente en RAM, descarta el pendiente al perder la conexión y también omite un flanco nuevo mientras haya uno pendiente. Un evento pendiente se descarta si pasan 10 s sin poder enviarlo.
- El envío lo hace el mismo hilo de red de ambiente, con su cliente HTTPS, certificado y reloj. Es secuencial, sin segundo hilo.

## Supabase a la web

`public.eventos_movimiento` (`event_id`, `device_id`, `bebe_id`, `ts`, `recibido_en`). La Ingesta llama a `public.ingestar_movimiento`, ejecutable solo por `service_role`. Valida el prefijo del módulo, la credencial activa y la asignación histórica del bebé en `ts`, igual que ambiente. RLS permite `select` solo a los dueños activos del módulo; la escritura directa está denegada.

Consulta prevista para la web (última fila): seleccionar `event_id,device_id,ts,recibido_en` filtrando por `device_id`, ordenando por `ts`, `recibido_en` y `event_id` descendente, límite 1. Mostrar «Sin datos» si no hay fila y la hora en `America/Costa_Rica`. No se muestra ningún estado de alerta.

## Separación de credenciales

La Ingesta rechaza con `401 no_autorizado`, antes de guardar, un evento `ambiente` cuyo `device_id` empiece por `cuna-movimiento-` o `cuna-lampara-`. Así una credencial de movimiento o lámpara no puede escribir en `lecturas_ambiente`. Los IDs de ambiente existentes (p. ej. `cuna-ambiente-01`) siguen válidos y la base de ambiente no cambia. El RPC de movimiento ya limita su prefijo y los RPC SQL son ejecutables solo por `service_role`. Alcance: es una defensa de la Ingesta por prefijo de `device_id`; no sustituye la validación de credencial activa que hace cada RPC.

## Deduplicación

El `event_id` es único **por tipo**: `lecturas_ambiente` y `eventos_movimiento` tienen cada una su clave primaria. La unicidad global entre tipos exigiría modificar el backend de ambiente y queda pendiente de decisión. El firmware genera UUID v4 aleatorios, así que una colisión entre tipos no es esperable.

## Verificación con la maqueta (pendiente)

Con el monitor habilitado: un movimiento real produce una fila; un reintento tras `503` conserva una sola fila; sin NTP, sin WiFi o con el monitor deshabilitado no se crea ninguna fila. Considera el tiempo de calentamiento del HC-SR501, que puede dar flancos espurios al arrancar. Nada de esto se ha probado en hardware.
