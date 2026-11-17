# Contrato de temperatura y humedad

Contrato vigente para implementar el recorrido de ambiente del Sprint 3. Se basa en la sección 3.2 del documento de arquitectura del Sprint 2 y en RF-09, RNF-02 y DEC-07 de la [especificación](../../../docs/Requerimientos/EspecificacionRequerimientos.md). Los nombres de red y base de datos corresponden a la Ingesta y la migración del repositorio.

## Pico a Supabase

La Pico envía `POST /functions/v1/ingesta` por HTTPS. Usa `Content-Type: application/json` y `Authorization: Bearer <token-del-dispositivo>`. El token es una cadena hexadecimal de 64 caracteres generada con 32 bytes aleatorios y registrada para un único módulo. La clave de servidor de Supabase se usa dentro de la función Edge.

Este ejemplo usa valores ilustrativos.

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

| Campo | Tipo | Regla |
| --- | --- | --- |
| `event_id` | UUID v4 en texto | La Pico genera uno por medición válida. Un reintento conserva el UUID, la hora y ambas magnitudes. |
| `device_id` | Texto de 1 a 64 caracteres | Identifica el módulo lógico. Empieza con minúscula o dígito y admite minúsculas, dígitos, guion y guion bajo. Para la maqueta se usa `cuna-ambiente-01` en la Pico, Supabase y la web. El identificador físico `pico-sprint3-01` queda reservado para la placa. |
| `tipo` | Texto | Valor fijo `ambiente`. Peso y movimiento usan eventos separados cuando se incorporen, con sus propios tipos y contratos. |
| `ts` | Texto ISO 8601 UTC | Hora de medición en la Pico, con sufijo `Z` y hasta tres decimales de segundo. |
| `datos.temperatura_c` | Número finito | Temperatura en °C. |
| `datos.humedad_pct` | Número finito de 0 a 100 | Humedad relativa en % HR. |

El AM2301 toma una medición cada 10 segundos. Cada evento incluye las dos magnitudes en `datos` y ocupa hasta 2048 bytes. Si falla el sensor o falta alguna magnitud válida, el firmware omite ese evento y espera la siguiente medición.

El firmware sincroniza el reloj por NTP antes del primer envío y vuelve a sincronizarlo al recuperar la conexión. Si aún no tiene una hora confiable, omite el envío. La Ingesta valida el formato UTC y guarda por separado `recibido_en`, la hora de recepción del servidor. La asignación al bebé y la fecha mostrada en la web se basan en `ts`.

| Estado HTTP | Interpretación para el firmware |
| --- | --- |
| `201` | Evento guardado. |
| `409` | El mismo evento ya estaba guardado. Da el envío por confirmado. |
| `400`, `401`, `405`, `413` o `422` | Corrige la solicitud, la credencial o la asignación. |
| `503` | Fallo temporal. Se permite un reintento antes de la siguiente medición, con el mismo evento y mientras haya conexión. |

Los errores tienen `codigo`, `mensaje` y `reintentable`. Si se corta la conexión, el firmware descarta la lectura pendiente y retoma las mediciones al reconectar, según el alcance de la maqueta.

## Supabase a la web

La Ingesta usa la asignación más reciente cuyo inicio sea anterior o igual a `ts`. Cada cambio rige hasta el siguiente. Una entrada con bebé nulo cierra la asignación. Si en `ts` no hay bebé asignado, la Ingesta responde `422` para un evento nuevo. Una fila guardada conserva el `bebe_id` original.

La web consulta `public.lecturas_ambiente` con una sesión de Supabase Auth y la clave publicable. RLS limita la consulta a los dueños activos del módulo. Al abrir Cuna, consulta la última lectura y repite la consulta cada 10 segundos mientras la pantalla esté abierta y haya sesión. En este recorrido se usa consulta periódica. El diseño general conserva Realtime para los flujos previstos en la arquitectura.

La consulta selecciona `event_id`, `device_id`, `ts`, `recibido_en`, `temperatura_c` y `humedad_pct`. Filtra por el `device_id` del módulo configurado, ordena por `ts`, `recibido_en` y `event_id` en orden descendente y pide una fila como máximo.

Si la web conserva su modelo interno `LecturaAmbiental`, el adaptador usa `event_id → id`, `device_id → dispositivo_id` y `ts → registrado_en`. Pasa los valores de temperatura y humedad directamente desde las columnas de la tabla. Presenta la hora de medición en `America/Costa_Rica`.

| Resultado | Estado en Cuna |
| --- | --- |
| Consulta exitosa sin fila visible | «Sin datos», con ambas magnitudes vacías. |
| Última medición con hasta 30 segundos de antigüedad | «Actual», con ambas magnitudes y hora de medición. |
| Última medición con más de 30 segundos de antigüedad | «Desactualizado», conservando el último valor y su hora. |
| Fallo de la consulta | Mostrar el aviso de conexión y conservar la última lectura disponible de la sesión. Su estado sigue dependiendo de `ts`. |

## Verificación con la maqueta

Comprueba el comportamiento del AM2301 ante fallos y la cadencia de 10 segundos. Comprueba también la sincronización NTP y el envío HTTPS con TLS 1.3 sobre el hotspot. La prueba conjunta pasa al ver una lectura real en la web, confirmar que un reintento conserva una sola fila y observar el estado «Desactualizado» al interrumpir el envío durante más de 30 segundos.
