"""movimiento.py (ZERO) - Detecta el INICIO de cada movimiento y lo marca como evento.

Funciones:
    actualizar()           llamar en cada vuelta; devuelve True solo cuando
                           el PIR pasa de "quieto" a "movimiento"
    poner_alertas(bool)    activa/desactiva el aviso (monitoreo habilitado)
    alertas_activas()      estado actual del aviso

El movimiento se registra siempre; el campo "alert" del evento indica si el
monitoreo estaba habilitado, y el backend decide si avisa por Telegram.
"""
import sensores

_estado = {"habia_movimiento": False, "alertas": False}


def poner_alertas(activas):
    _estado["alertas"] = bool(activas)


def alertas_activas():
    return _estado["alertas"]


def actualizar():
    """True solo en el instante en que empieza un movimiento."""
    hay = sensores.hay_movimiento()
    empezo = hay and not _estado["habia_movimiento"]
    _estado["habia_movimiento"] = hay
    return empezo
