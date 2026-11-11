# Contrato de temperatura y humedad

Primer recorrido del Sprint 3, basado en la sección 3.2 de la arquitectura del Sprint 2 y en RF-09, RNF-02 y DEC-07. La Pico mide con el AM2301 cada 10 segundos y envía las dos magnitudes en un evento.

## Pico a Supabase

La Pico envía `POST /functions/v1/ingesta` por HTTPS. Usa `Content-Type: application/json` y `Authorization: Bearer <token-del-dispositivo>`. El token es una cadena hexadecimal de 64 caracteres generada con 32 bytes aleatorios y registrada para un único módulo. La clave de servidor de Supabase se usa dentro de la función Edge.

Ejemplo ilustrativo:

```json
{
  "event_id": "9f1c2e3a-4b5d-4a6e-8f7a-1b2c3d4e5f60",
  "device_id": "cuna-ambiente-01",
  "tipo": "ambiente",
  "ts": "2026-11-11T16:04:10Z",
  "datos": {
    "temperatura_c": 24.3,
    "humedad_pct": 52.1
  }
}
```

- Genera un UUID v4 por medición. Reutiliza el mismo UUID y los mismos datos si reintentas ese evento.
- `device_id` identifica al módulo lógico. Para esta prueba se propone registrar `cuna-ambiente-01`. El `DEVICE_ID` actual del firmware identifica la Pico física.
- `ts` corresponde a la medición en UTC, con sufijo `Z` y hasta tres decimales de segundo. Espera a sincronizar el reloj antes de enviar. Supabase registra `recibido_en` por separado.
- `temperatura_c` es un número finito en °C y `humedad_pct` está entre 0 y 100 % HR. Cuando el sensor falla, la Pico omite ese envío. Los eventos de este recorrido tienen un máximo de 2048 bytes.

| Estado HTTP | Interpretación para el firmware |
| --- | --- |
| `201` | Evento guardado. |
| `409` | El mismo evento ya estaba guardado. Da el envío por confirmado. |
| `400`, `401`, `413` o `422` | Corrige el evento, la credencial o la asignación antes de volver a enviar. |
| `503` | Fallo temporal. Si reintentas mientras hay conexión, conserva el mismo evento. |

Los errores tienen `codigo`, `mensaje` y `reintentable`. Si se corta la conexión, el firmware descarta la lectura pendiente y retoma las mediciones al reconectar, según el alcance de la maqueta.

## Supabase a la web

La Ingesta asocia cada evento al bebé asignado al módulo en `ts`. Conserva esa asociación aunque posteriormente cambie la asignación. La web consulta `public.lecturas_ambiente` con una sesión de Supabase Auth y la clave publicable. RLS limita la lectura a los dueños activos del módulo.

Filtra por `device_id`, ordena por `ts`, `recibido_en` y `event_id` en orden descendente, y pide una fila. Muestra `temperatura_c`, `humedad_pct` y la fecha de medición. Para la primera prueba, usa «Sin datos recientes» si la consulta no devuelve una fila o la medición supera los 30 segundos de antigüedad. Una consulta inicial y una actualización periódica bastan para este recorrido.

El identificador de módulo, el UUID v4, el formato de `datos`, la omisión de fallos del sensor y los 30 segundos concretan decisiones de trabajo del primer recorrido. La sincronización del reloj y TLS 1.3 requieren comprobación con la Pico y el hotspot reales.
