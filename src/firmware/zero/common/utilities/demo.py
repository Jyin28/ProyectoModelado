"""demo.py (ZERO) - Simula que llegan comandos, para ver el avance sin backend.

siguiente() devuelve una orden de la lista cada DEMO_CADA_S segundos
(o None si todavia no toca o ya se acabo la lista). main.py la ejecuta
con comandos.ejecutar() y muestra la confirmacion.

Para desactivarlo: MODO_DEMO = False en config.py. Este archivo se borra
cuando los comandos lleguen de verdad desde la web.
Las ordenes de audio necesitan al menos un .wav en la carpeta audio/.
"""
import time

import config

_ORDENES = [
    {"command_id": "demo-1", "command": "lamp_set", "params": {"level": 30}},
    {"command_id": "demo-2", "command": "lamp_set", "params": {"level": 100}},
    {"command_id": "demo-3", "command": "audio_list", "params": {}},
    {"command_id": "demo-4", "command": "audio_play", "params": {"name": "demo"}},
    {"command_id": "demo-5", "command": "motion_alerts", "params": {"on": True}},
    {"command_id": "demo-6", "command": "get_status", "params": {}},
    {"command_id": "demo-7", "command": "lamp_set", "params": {"level": 150}},  # error a proposito
    {"command_id": "demo-8", "command": "audio_stop", "params": {}},
    {"command_id": "demo-9", "command": "lamp_set", "params": {"level": 0}},
]

_estado = {"indice": 0, "ultimo": None}


def siguiente():
    """Llamar en cada vuelta del ciclo principal. Devuelve una orden o None."""
    if _estado["indice"] >= len(_ORDENES):
        return None
    ahora = time.monotonic()
    if _estado["ultimo"] is not None:
        if ahora - _estado["ultimo"] < config.DEMO_CADA_S:
            return None
    _estado["ultimo"] = ahora
    orden = _ORDENES[_estado["indice"]]
    _estado["indice"] += 1
    print("DEMO orden:", orden["command"], orden["params"])
    return orden
