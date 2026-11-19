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
_SUPABASE_URL = getattr(secrets, "SUPABASE_URL", "")
_ANON_KEY = getattr(secrets, "SUPABASE_ANON_KEY", "")
_TOKEN_SHA256 = getattr(secrets, "TOKEN_SHA256", "")
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
    """Consulta órdenes pendientes en Supabase vía RPC tomar_ordenes_colchon."""
    if not habilitada() or not _SUPABASE_URL or not _ANON_KEY or not _TOKEN_SHA256:
        return []

    url = _SUPABASE_URL + "/rest/v1/rpc/tomar_ordenes_colchon"
    cuerpo = json.dumps({
        "p_device_id": config.DEVICE_ID,
        "p_token_sha256": _TOKEN_SHA256,
    })
    cabeceras = {
        "Content-Type": "application/json",
        "apikey": _ANON_KEY,
    }
    resp = None
    try:
        try:
            resp = requests.post(url, data=cuerpo, headers=cabeceras, timeout=config.HTTP_TIMEOUT_S)
        except TypeError:
            resp = requests.post(url, data=cuerpo, headers=cabeceras)

        if 200 <= resp.status_code < 300:
            datos = resp.json()
            if isinstance(datos, list):
                return datos
        return []
    except Exception as err:
        print("Error al consultar ordenes en Supabase:", err)
        return []
    finally:
        if resp is not None:
            try:
                resp.close()
            except Exception:
                pass


def confirmar_orden(confirmacion):
    """Notifica a Supabase que una orden fue ejecutada."""
    if not habilitada() or not _SUPABASE_URL or not _ANON_KEY or not _TOKEN_SHA256:
        return False

    command_id = confirmacion.get("command_id")
    if not command_id:
        return False

    url = _SUPABASE_URL + "/rest/v1/rpc/confirmar_orden_colchon"
    cuerpo = json.dumps({
        "p_command_id": command_id,
        "p_device_id": config.DEVICE_ID,
        "p_token_sha256": _TOKEN_SHA256,
        "p_ok": bool(confirmacion.get("ok")),
        "p_error": confirmacion.get("error"),
    })
    cabeceras = {
        "Content-Type": "application/json",
        "apikey": _ANON_KEY,
    }
    resp = None
    try:
        try:
            resp = requests.post(url, data=cuerpo, headers=cabeceras, timeout=config.HTTP_TIMEOUT_S)
        except TypeError:
            resp = requests.post(url, data=cuerpo, headers=cabeceras)
        return 200 <= resp.status_code < 300
    except Exception as err:
        print("Error al confirmar orden en Supabase:", err)
        return False
    finally:
        if resp is not None:
            try:
                resp.close()
            except Exception:
                pass


def pendientes():
    return len(_cola)
