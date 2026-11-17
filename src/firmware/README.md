# Cuna Inteligente IoT - firmware por dispositivo

| Carpeta | Placa | Lenguaje | Módulos |
|---|---|---|---|
| `pico/` | Raspberry Pi Pico 2 W | MicroPython | colchón + figuras LED |
| `zero/` | Raspberry Pi Zero 2 W | Python 3 (Raspberry Pi OS) | cuna: ambiente, movimiento, lámpara, audio |

Cada carpeta es un programa independiente con su `main.py`, su `config.py` y su README.
Ambos comparten el mismo contrato (provisional) de eventos y órdenes:

* Evento: `{"event_id", "type", "at" (UTC), "data"}`; envío: `POST {"device_id", "events": [...]}`.
* Orden: `{"command_id", "command", "params"}`; confirmación: `{..., "ok", "result" | "error"}`,
  que se manda como evento `command_ack`.
