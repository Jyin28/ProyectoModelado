"""comandos.py - Ejecuta ordenes y devuelve una confirmacion.

Una orden es un diccionario:
    {"command_id": "abc1", "command": "lamp_set", "params": {"level": 40}}

ejecutar(orden) devuelve la confirmacion:
    {"command_id": "abc1", "command": "lamp_set", "ok": True,  "result": {...}}
    {"command_id": "abc1", "command": "lamp_set", "ok": False, "error": "..."}

Por ahora las ordenes las genera demo.py. Mas adelante llegaran desde la
web. (Nombres de comandos PROVISIONALES: validar con el equipo de backend.)

Comandos: lamp_set, led_set, led_all, led_sequence, led_stop, get_status
"""
import config
import figuras
import lampara


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
    return {"lampara": lampara.nivel(), "secuencia": figuras.secuencia_actual()}


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
    return confirmacion


def _ejecutar(nombre, params):
    if nombre == "lamp_set":
        lampara.poner_nivel(_numero(params, "level", 0, 100))
        return {"level": lampara.nivel()}

    if nombre == "led_set":
        indice = int(_numero(params, "index", 0, len(config.PINES_LEDS) - 1))
        figuras.encender_led(indice, bool(params.get("on")))
        return {}

    if nombre == "led_all":
        figuras.todos(bool(params.get("on")))
        return {}

    if nombre == "led_sequence":
        intervalo = _numero(params, "step_s", config.LED_INTERVALO_MINIMO_S, 3600)
        figuras.iniciar_secuencia(params.get("name"), intervalo)
        return {"sequence": figuras.secuencia_actual()}

    if nombre == "led_stop":
        figuras.todos(False)
        return {}

    if nombre == "get_status":
        return estado()

    raise ValueError("comando_desconocido")
