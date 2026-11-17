"""Envío por lotes de eventos de ambiente y colchón a Supabase."""
import json
import time

try:
    import requests
except ImportError:
    import urequests as requests

import config
import secrets

_URL = getattr(secrets, "INGESTA_URL", "")
_TOKEN = getattr(secrets, "DEVICE_TOKEN", "")
_cola = []
_estado = {"fallos": 0, "proximo_intento": 0}


def habilitada():
    return bool(_URL and _TOKEN)


def encolar(evento):
    if not isinstance(evento, dict):
        raise ValueError("El evento debe ser un diccionario.")
    _cola.append(evento)
    while len(_cola) > config.COLA_MAX:
        descartado = _cola.pop(0)
        print("Advertencia: cola llena; se descartó", descartado.get("event_id"))


def hay_conexion():
    return _estado["fallos"] < config.ENVIOS_FALLIDOS_MAX


def _post(cuerpo):
    cabeceras = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + _TOKEN,
    }
    try:
        respuesta = requests.post(
            _URL, data=cuerpo, headers=cabeceras,
            timeout=config.HTTP_TIMEOUT_S
        )
    except TypeError:
        respuesta = requests.post(_URL, data=cuerpo, headers=cabeceras)
    try:
        return 200 <= respuesta.status_code < 300
    finally:
        respuesta.close()


def enviar_pendientes():
    if not habilitada() or not _cola:
        return True

    if time.ticks_diff(time.ticks_ms(), _estado["proximo_intento"]) < 0:
        return False

    lote = _cola[:5]
    cuerpo = json.dumps({
        "device_id": config.DEVICE_ID,
        "events": lote,
    })

    try:
        correcto = _post(cuerpo)
    except Exception as error:
        print("Error enviando a Supabase:", error)
        correcto = False

    if correcto:
        del _cola[:len(lote)]
        _estado["fallos"] = 0
    else:
        _estado["fallos"] += 1
        _estado["proximo_intento"] = time.ticks_add(
            time.ticks_ms(), config.REINTENTO_ENVIO_S * 1000
        )
    return correcto


def leer_comandos():
    # La recepción de órdenes por Realtime se implementará en otra fase.
    return []


def pendientes():
    return len(_cola)
