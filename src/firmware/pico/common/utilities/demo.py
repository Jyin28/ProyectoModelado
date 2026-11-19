"""demo.py - Simula que llegan comandos, para ver el avance sin backend.

Cada DEMO_CADA_S segundos ejecuta la siguiente orden de la lista y muestra
su confirmacion. Al terminar la lista no hace nada mas. Solo corre las ordenes
del modulo conectado (config.MODULO): el colchon no tiene demo porque necesita
tara y una pesa conocida reales.
Para desactivarlo: MODO_DEMO = False en config.py. Este archivo se borra
cuando los comandos lleguen de verdad desde la web.
"""
import time

import comandos
import config

_ORDENES_POR_MODULO = {
    "cuna": [
        {"command_id": "demo-1", "command": "lamp_set", "params": {"level": 30}},
        {"command_id": "demo-2", "command": "lamp_set", "params": {"level": 100}},
        {"command_id": "demo-3", "command": "get_status", "params": {}},
        {"command_id": "demo-4", "command": "lamp_set", "params": {"level": 150}},  # error a proposito
        {"command_id": "demo-5", "command": "lamp_set", "params": {"level": 0}},
    ],
    "figuras": [
        {"command_id": "demo-1", "command": "led_all", "params": {"on": True}},
        {"command_id": "demo-2", "command": "led_sequence",
         "params": {"name": "chase", "step_s": 2}},
        {"command_id": "demo-3", "command": "get_status", "params": {}},
        {"command_id": "demo-4", "command": "led_set", "params": {"index": 9, "on": True}},  # error a proposito
        {"command_id": "demo-5", "command": "led_stop", "params": {}},
    ],
    "colchon": [],
}

_estado = {"indice": 0, "ultimo": None}


def ordenes():
    """Lista de ordenes de demo del modulo conectado."""
    return _ORDENES_POR_MODULO.get(config.MODULO, [])


def actualizar():
    """Llamar en cada vuelta del ciclo principal."""
    lista = ordenes()
    if _estado["indice"] >= len(lista):
        return
    ahora = time.ticks_ms()
    if _estado["ultimo"] is not None:
        if time.ticks_diff(ahora, _estado["ultimo"]) < config.DEMO_CADA_S * 1000:
            return
    _estado["ultimo"] = ahora

    orden = lista[_estado["indice"]]
    _estado["indice"] += 1
    print("DEMO orden:", orden["command"], orden["params"])
    print("DEMO confirmacion:", comandos.ejecutar(orden))
