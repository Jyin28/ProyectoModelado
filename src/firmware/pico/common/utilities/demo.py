"""demo.py (PICO) - Simula que llegan comandos, para ver el avance sin backend.

siguiente() devuelve una orden de la lista cada DEMO_CADA_S segundos
(o None si todavia no toca o ya se acabo la lista). main.py la ejecuta
con comandos.ejecutar() y muestra la confirmacion.

Para desactivarlo: MODO_DEMO = False en config.py. Este archivo se borra
cuando los comandos lleguen de verdad desde la web.

Las ordenes del colchon necesitan el HX711 conectado y peso encima.
Sin el, veras confirmaciones con ok False: es normal.
"""
import time

import config

_ORDENES = [
    {"command_id": "demo-1", "command": "led_all", "params": {"on": True}},
    {"command_id": "demo-2", "command": "led_sequence",
     "params": {"name": "chase", "step_s": 2}},
    {"command_id": "demo-3", "command": "get_status", "params": {}},
    {"command_id": "demo-4", "command": "led_set", "params": {"index": 9}},   # error a proposito
    {"command_id": "demo-5", "command": "mattress_reference", "params": {}},
    {"command_id": "demo-6", "command": "mattress_start",
     "params": {"duration_s": 60, "tolerance_pct": 10, "alarm_s": 5}},
    {"command_id": "demo-7", "command": "get_status", "params": {}},
    {"command_id": "demo-8", "command": "mattress_stop", "params": {}},
    {"command_id": "demo-9", "command": "led_stop", "params": {}},
]

_estado = {"indice": 0, "ultimo": None}


def siguiente():
    """Llamar en cada vuelta del ciclo principal. Devuelve una orden o None."""
    if _estado["indice"] >= len(_ORDENES):
        return None
    ahora = time.ticks_ms()
    if _estado["ultimo"] is not None:
        if time.ticks_diff(ahora, _estado["ultimo"]) < config.DEMO_CADA_S * 1000:
            return None
    _estado["ultimo"] = ahora
    orden = _ORDENES[_estado["indice"]]
    _estado["indice"] += 1
    print("DEMO orden:", orden["command"], orden["params"])
    return orden
