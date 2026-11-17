# Contrato de la web — propuesta provisional

**PROVISIONAL: pendiente de acuerdo con Persona B y C.** Código en
`src/frontend/src/models/contrato.ts` y `validarComando.ts`. Las fechas son
ISO 8601 en UTC. Los nombres `command_id`, `command`, `params`, `ok`,
`result` y `error` son los que ya usa el firmware (`comandos.py`).

## Lecturas

| Tipo | Campo | Tipo | Unidad / rango |
| --- | --- | --- | --- |
| `LecturaAmbiental` | `id` | texto | — |
| | `dispositivo_id` | texto | — |
| | `temperatura_c` | número | °C |
| | `humedad_pct` | número | % HR, 0–100 |
| | `registrado_en` | texto | ISO UTC |
| `EventoMovimiento` | `id`, `dispositivo_id` | texto | — |
| | `registrado_en` | texto | ISO UTC |
| `LecturaPeso` | `id`, `dispositivo_id` | texto | — |
| | `peso_g` | número | gramos |
| | `registrado_en` | texto | ISO UTC |

## Comandos

`Modulo`: `cuna` \| `colchon` \| `figuras`.

| `command` | `params` | Rango |
| --- | --- | --- |
| `lamp_set` | `level` | número 0–100 |
| `led_set` | `index`, `on` | `index` entero 0–5; `on` booleano |
| `led_all` | `on` | booleano |
| `led_sequence` | `name`, `step_s` | `name` texto; `step_s` ≥ 2 s |
| `led_stop` | — | — |
| `get_status` | — | — |

Comandos del colchón y del audio: pendiente de definir con B y C.

| Tipo | Campo | Tipo | Notas |
| --- | --- | --- | --- |
| `Comando` | `command_id` | texto | uuid |
| | `modulo` | `Modulo` | — |
| | `command`, `params` | ver tabla anterior | unión discriminada |
| | `creado_en` | texto | ISO UTC |
| `Confirmacion` | `command_id` | texto | uuid del comando |
| | `command` | texto | nombre del comando |
| | `ok` | booleano | — |
| | `result` | objeto, opcional | si `ok` es verdadero |
| | `error` | texto, opcional | si `ok` es falso |
| | `confirmado_en` | texto | ISO UTC |
| `EstadoComando` | — | — | `pendiente` \| `confirmado` \| `error` \| `sin-respuesta` |

La web valida los parámetros con `validarComando` antes de enviar.

## Preguntas abiertas para B

1. ¿Cómo se llaman las tablas (ambiente, movimiento, peso, comandos, confirmaciones)?
2. ¿Cómo se identifica el dispositivo? El contrato de ambiente usa `device_id`
   del módulo lógico (`cuna-ambiente-01`) y el firmware tiene
   `DEVICE_ID = "pico-sprint3-01"` (Pico física). ¿A cuál corresponde `dispositivo_id`?
3. ¿Se adoptan `id` y `registrado_en` o los nombres de
   `src/shared/contracts/ambiente.md` (`event_id`, `ts`, `recibido_en`)?
4. ¿Cómo llegan las confirmaciones a la web (Realtime, tabla o ambos) y quién
   fija `confirmado_en`?
5. ¿Qué tiempo de espera marca un comando como `sin-respuesta`?
6. ¿`name` de `led_sequence` se limita a `chase`, `alternate` y `blink_all`?
7. ¿Qué comandos tendrán el colchón y el audio?

Ver también [alcance](alcance.md).
