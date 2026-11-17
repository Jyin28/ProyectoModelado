# Cuna Inteligente IoT - firmware por dispositivo

| Carpeta | Placa | Lenguaje | Módulos |
|---|---|---|---|
| `pico/` | Raspberry Pi Pico 2 W | MicroPython | colchón + figuras LED |
| `zero/` | Raspberry Pi Zero 2 W | Python 3 (Raspberry Pi OS) | cuna: ambiente, movimiento, lámpara, audio |
| `pico-integrado/` | Raspberry Pi Pico 2 W (única) | MicroPython | maqueta del Sprint 3 en una sola placa: AM2301, PIR, lámpara, colchón, figuras LED y audio, conectada a la ingesta y a Realtime de Supabase |

Cada carpeta es un programa independiente con su `main.py`, su `config.py` y su README.
Ambos comparten el mismo contrato (provisional) de eventos y órdenes:

* Evento: `{"event_id", "type", "at" (UTC), "data"}`; envío: `POST {"device_id", "events": [...]}`.
* Orden: `{"command_id", "command", "params"}`; confirmación: `{..., "ok", "result" | "error"}`,
  que se manda como evento `command_ack`.

## Dos arquitecturas conviven (pendiente de decisión del equipo)

`pico/` + `zero/` es el reparto en dos placas con contrato provisional. `pico-integrado/` es el
firmware de una sola Pico 2 W (alcance vigente en `docs/Sprint3/alcance.md`): conserva sin cambios la
rama `codex/sprint3-firmware-integracion` y es la que ya habla con la ingesta HTTPS y con Realtime de
Supabase (contratos `src/shared/contracts/`). Se integraron lado a lado porque son incompatibles
archivo por archivo; hay que decidir cuál sigue o portar lo que falte. Ver el README de cada carpeta.
