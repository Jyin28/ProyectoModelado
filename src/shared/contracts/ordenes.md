# Contrato · Órdenes remotas por módulo

Complementa `lampara.md`, que sigue vigente para la lámpara. Estas órdenes cubren las figuras LED, el audio, el monitoreo de movimiento y el colchón. Los nombres y rangos son idénticos a `src/firmware/common/utilities/comandos.py`. Migración: `supabase/migrations/20261118000400_ordenes_modulo.sql`.

Estado: **implementado y probado solo con pruebas simuladas** (PGlite y dobles de firmware). No se verificó con Supabase real ni con la Pico.

## Ciclo

1. La web llama `public.solicitar_orden(p_command_id, p_device_id, p_command, p_params)` como dueño activo del módulo. La orden queda `pendiente` y vence a los 15 s.
2. La base emite una señal `orden_disponible` con solo el `command_id`, por el canal privado `modulo:<producto_id>`.
3. La Pico (cuenta Auth exclusiva, vinculada a un módulo del producto) llama `public.tomar_orden_modulo()`. La orden pasa a `enviado` y se entrega una sola vez. Devuelve `{command_id, device_id, command, params, vence_en}` o `null`.
4. La Pico ejecuta con `comandos.ejecutar` y llama `public.confirmar_orden_modulo(p_command_id, p_ok, p_resultado, p_error)`.
5. Solo una confirmación `ok: true` cambia el estado que muestra la web (`public.estado_de_modulo`). La solicitud nunca lo cambia.

Estados de la orden: `pendiente`, `enviado`, `confirmado`, `error`. La web los muestra con texto: solicitud registrada, enviada a la Pico, confirmada por la Pico, error, sin respuesta (vencida a los 15 s sin confirmación).

## Comandos

| Módulo (`device_id`) | `command` | `params` | Resultado de la Pico |
|---|---|---|---|
| `cuna-figuras-NN` | `led_set` | `index` entero 0 a 5, `on` booleano | `{}` |
| | `led_all` | `on` booleano | `{}` |
| | `led_sequence` | `name` en `chase`, `alternate`, `blink_all`; `step_s` de 2 a 3600 | `{sequence}` |
| | `led_stop` | ninguno | `{}` |
| `cuna-audio-NN` | `audio_play` | `sound`: identificador del catálogo de la Pico (`^[a-z0-9_]{1,40}$`) | `{sound, duration_s, volume_pct}` |
| | `audio_stop` | ninguno | estado del reproductor |
| `cuna-movimiento-NN` | `motion_set` | `enabled` booleano | `{enabled}` |
| `cuna-colchon-NN` | `mattress_arm`, `mattress_rearm` | opcionales: `duration_s` mayor que 0 y hasta 86400; `tolerance_pct` mayor que 0 y menor que 100; `alarm_s` mayor que 0 y hasta 60 | `{pendiente: true}` |
| | `mattress_stop` | ninguno | estado del colchón |

Claves de más, tipos distintos o valores fuera de rango se rechazan con `22023` (`parametros_invalidos`). Un comando de otro módulo se rechaza con `comando_de_otro_modulo`.

Catálogo de audio: la Pico solo tiene el sonido `tono_suave` (tono sintetizado). No hay canciones ni ruido blanco pregrabados; añadirlos requiere decisión del equipo y archivos reales. La Pico responde `audio_desconocido` si el identificador no existe.

## Errores del RPC

| Código | Causa |
|---|---|
| `42501` `no_autorizado` | Sesión ausente, módulo inexistente o inactivo, o quien llama no es dueño activo. Un mismo error para todos los casos. |
| `22023` | `command_id_requerido`, `comando_invalido`, `comando_de_otro_modulo`, `parametros_invalidos`, `confirmacion_invalida`. |
| `23505` | `command_id_en_uso` (mismo id con otro contenido) o `confirmacion_distinta`. Un reenvío idéntico devuelve la orden original. |
| `55000` | `orden_no_enviada` u `orden_vencida`. |

## Estado confirmado

`public.estado_de_modulo(p_device_id)` devuelve `{estado, actualizado_en}`. Sin confirmación previa: `{estado: {}, actualizado_en: null}`; la web muestra «Sin confirmación». Claves hoy:

- Figuras: `secuencia` (nombre o `null`).
- Movimiento: `monitoreo` (booleano). Si es `false`, la ingesta ignora los eventos del PIR y responde `409 monitoreo_inactivo` (sin reintento).

## Horarios que generan órdenes

`public.reemplazar_horarios(p_device_id, p_tipo, p_horas)` acepta, además de `recordatorio_*`, los tipos `figuras_encender` (`led_all` encendido), `figuras_apagar` (`led_stop`), `movimiento_activar` y `movimiento_desactivar` (`motion_set`). `procesar_horarios` crea una orden en el minuto exacto, hora de `America/Costa_Rica`, una vez por día. No recupera horas vencidas (DEC-04, DEC-10): si la Pico no está conectada en esos 15 s, la orden vence.

## Actividad de audio

Al confirmarse `audio_play` se registra un evento `audio` con `{sound}`. No se registra ni almacena sonido.
