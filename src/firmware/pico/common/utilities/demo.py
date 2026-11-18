
"""demo.py - Prueba controlada de los umbrales del colchon."""
import time
import config

_ORDENES = [
    {
        "command_id": "prueba-001",
        "command": "mattress_reference",
        "params": {}
    },
    {
        "command_id": "prueba-002",
        "command": "mattress_start",
        "params": {
            "duration_s": 120,
            "tolerance_pct": 10,
            "alarm_s": 60
        }
    },
    {
        "command_id": "prueba-003",
        "command": "get_status",
        "params": {}
    }
]

_estado = {"indice": 0, "ultimo": None}


def siguiente():
    if _estado["indice"] >= len(_ORDENES):
        return None

    ahora = time.ticks_ms()

    if _estado["ultimo"] is not None:
        if time.ticks_diff(
            ahora, _estado["ultimo"]
        ) < config.DEMO_CADA_S * 1000:
            return None

    _estado["ultimo"] = ahora
    orden = _ORDENES[_estado["indice"]]
    _estado["indice"] += 1

    print("DEMO orden:", orden["command"])
    return orden
