"""comandos.py (ZERO) - Ejecuta ordenes y devuelve una confirmacion.

Una orden es un diccionario:
    {"command_id": "abc1", "command": "lamp_set", "params": {"level": 40}}

ejecutar(orden) devuelve la confirmacion:
    {"command_id": "abc1", "command": "lamp_set", "ok": True,  "result": {...}}
    {"command_id": "abc1", "command": "lamp_set", "ok": False, "error": "..."}

Las ordenes las genera demo.py y, mas adelante, llegaran desde la web.
(Nombres de comandos PROVISIONALES: validar con el equipo de backend.)

Comandos: lamp_set, audio_list, audio_play, audio_stop, motion_alerts, get_status
"""
import audio
import lampara
import movimiento


def _numero(params, clave, minimo, maximo):
    """Saca un numero de params y comprueba que este en rango."""
    valor = params.get(clave)
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ValueError("parametro_invalido:" + clave)
    if valor < minimo or valor > maximo:
        raise ValueError("fuera_de_rango:" + clave)
    return valor


def estado():
    """Resumen de lo que hay encendido ahora."""
    return {"lamp": lampara.nivel(),
            "audio": audio.reproduciendo(),
            "motion_alerts": movimiento.alertas_activas()}


def ejecutar(orden):
    """Ejecuta una orden y devuelve su confirmacion (nunca lanza error)."""
    confirmacion = {"command_id": orden.get("command_id"),
                    "command": orden.get("command")}
    try:
        confirmacion["result"] = _ejecutar(orden.get("command"),
                                           orden.get("params") or {})
        confirmacion["ok"] = True
    except ValueError as error:
        confirmacion["ok"] = False
        confirmacion["error"] = str(error)
    except OSError as error:                  # p. ej. no esta instalado aplay
        confirmacion["ok"] = False
        confirmacion["error"] = "hardware:" + str(error)
    return confirmacion


def _ejecutar(nombre, params):
    if nombre == "lamp_set":
        lampara.poner_nivel(_numero(params, "level", 0, 100))
        return {"level": lampara.nivel()}

    if nombre == "audio_list":
        return {"tracks": audio.catalogo()}

    if nombre == "audio_play":
        audio.reproducir(params.get("name"))
        return {"playing": audio.reproduciendo()}

    if nombre == "audio_stop":
        audio.detener()
        return {}

    if nombre == "motion_alerts":
        movimiento.poner_alertas(bool(params.get("on")))
        return {"motion_alerts": movimiento.alertas_activas()}

    if nombre == "get_status":
        return estado()

    raise ValueError("comando_desconocido")
