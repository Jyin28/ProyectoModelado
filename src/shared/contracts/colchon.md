# Contrato · Colchón (configuración, eventos y estado)

Estado: **implementado y probado solo con PGlite y dobles de firmware**. Migración: `supabase/migrations/20261118000500_colchon.sql`. Las órdenes `mattress_*` están en [ordenes.md](ordenes.md).

El colchón es un módulo separado (`cuna-colchon-NN`). El peso se mide y se procesa solo en la Pico: **ninguna lectura de peso se envía ni se guarda** (CA-14.4). Lo único que sale de la Pico son tres eventos de estado y, en la alarma, el último valor medido.

## Configuración (web → servidor)

Se guarda con `public.guardar_config_colchon(p_device_id, p_duracion_s, p_tolerancia_pct, p_alarma_s)` (solo dueños activos) y se lee con `public.mi_config_colchon(p_device_id)`, que devuelve `{duracion_s, tolerancia_pct, alarma_s}` o `null` si nunca se guardó.

| Campo | Regla |
|---|---|
| `duracion_s` | entero mayor que 0 y hasta 86400 |
| `tolerancia_pct` | número mayor que 0 y menor que 100 |
| `alarma_s` | entero mayor que 0 y hasta 60 |

Un valor inválido se rechaza con `22023` (`config_colchon_invalida`) y **conserva la configuración anterior**. No hay valores por defecto en la app: sin configuración guardada no se puede activar. La configuración guardada **no cambia el firmware**: viaja como parámetros de cada orden `mattress_arm` o `mattress_rearm` (`duration_s`, `tolerance_pct`, `alarm_s`).

## Eventos (Pico → Ingesta)

`POST /functions/v1/ingesta` con credencial del módulo `cuna-colchon-NN`. Cuerpo:

```json
{ "event_id": "uuid v4", "device_id": "cuna-colchon-01", "tipo": "alarma_colchon",
  "ts": "2026-11-18T14:15:00Z", "datos": { "referencia_g": 1000, "ultimo_peso_g": 890 } }
```

| `tipo` | `datos` | Aviso por Telegram |
|---|---|---|
| `colchon_armado` | `referencia_g` (> 0), `duracion_s` (> 0, ≤ 86400), `tolerancia_pct` (0 a 100, sin incluirlos), `alarma_s` (> 0, ≤ 60) | No |
| `alarma_colchon` | `referencia_g` (> 0), `ultimo_peso_g` (número finito) | Sí |
| `colchon_detenido` | `motivo`: `app`, `boton`, `temporizador`, `duracion` o `wifi` | Sí |

- Cualquier otra clave en `datos`, un tipo desconocido o un valor fuera de rango se rechaza con `400 evento_invalido`.
- El mismo `event_id` con los mismos datos responde `409 evento_duplicado`; con datos distintos, `400 id_reutilizado`. La Pico reintenta con el mismo `event_id` durante 5 minutos como máximo, y conserva a lo sumo 8 eventos en orden.
- `ts` es la hora UTC en que ocurrió el evento (no la del envío).
- Un evento sin bebé asignado a esa hora responde `422 sin_asignacion` y no se reintenta.
- Los motivos de la Pico se traducen así: comando → `app`, botón → `boton`, fin del tiempo de alarma → `temporizador`, fin de la duración → `duracion`, pérdida de WiFi → `wifi`. El apagado del programa no se informa.

## Estado visible (servidor → web)

`public.estado_de_modulo(p_device_id)` devuelve `{estado, actualizado_en}`. Para el colchón, `estado` trae los datos del **último evento recibido**:

```json
{ "colchon": "activo", "referencia_g": 1000, "duracion_s": 300, "tolerancia_pct": 10,
  "alarma_s": 60, "motivo": null, "colchon_ts": "2026-11-18T14:15:00Z" }
```

`colchon` vale `activo`, `alarma` o `detenido`. Sin ningún evento recibido, `estado` es `{}` y la web muestra «Sin confirmación de la Pico». Un evento con `ts` anterior al ya guardado no cambia el estado.

**Limitación conocida:** si la Pico se reinicia con un monitoreo activo, el servidor sigue mostrando el último estado informado hasta el siguiente evento. La web muestra siempre la hora de ese estado. Informar el estado al reconectar queda para la fase 11.
