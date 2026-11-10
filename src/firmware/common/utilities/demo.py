"""demo.py - Simula que llegan comandos, para ver el avance sin backend.

Cada DEMO_CADA_S segundos ejecuta la siguiente orden de la lista y muestra
su confirmacion. Al terminar la lista no hace nada mas.
Para desactivarlo: MODO_DEMO = False en config.py. Este archivo se borra
cuando los comandos lleguen de verdad desde la web.
"""
import time

import comandos
import config

_ORDENES = [
    {"command_id": "demo-1", "command": "lamp_set", "params": {"level": 30}},
    {"command_id": "demo-2", "command": "lamp_set", "params": {"level": 100}},
    {"command_id": "demo-3", "command": "led_all", "params": {"on": True}},
    {"command_id": "demo-4", "command": "led_sequence",
     "params": {"name": "chase", "step_s": 2}},
    {"command_id": "demo-5", "command": "get_status", "params": {}},
    {"command_id": "demo-6", "command": "lamp_set", "params": {"level": 150}},  # error a proposito
    {"command_id": "demo-7", "command": "led_stop", "params": {}},
    {"command_id": "demo-8", "command": "lamp_set", "params": {"level": 0}},
]

_estado = {"indice": 0, "ultimo": None}


def actualizar():
    """Llamar en cada vuelta del ciclo principal."""
    if _estado["indice"] >= len(_ORDENES):
        return
    ahora = time.ticks_ms()
    if _estado["ultimo"] is not None:
        if time.ticks_diff(ahora, _estado["ultimo"]) < config.DEMO_CADA_S * 1000:
            return
    _estado["ultimo"] = ahora

    orden = _ORDENES[_estado["indice"]]
    _estado["indice"] += 1
    print("DEMO orden:", orden["command"], orden["params"])
    print("DEMO confirmacion:", comandos.ejecutar(orden))
