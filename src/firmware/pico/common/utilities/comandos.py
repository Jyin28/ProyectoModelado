"""comandos.py (PICO) - Ejecuta ordenes y devuelve una confirmacion.

Una orden es un diccionario:
    {"command_id": "abc1", "command": "led_all", "params": {"on": true}}

ejecutar(orden) devuelve la confirmacion:
    {"command_id": "abc1", "command": "led_all", "ok": True,  "result": {...}}
    {"command_id": "abc1", "command": "led_all", "ok": False, "error": "..."}

Las ordenes las genera demo.py y, mas adelante, llegaran desde la web.
(Nombres de comandos PROVISIONALES: validar con el equipo de backend.)

Figuras:  led_set, led_all, led_sequence, led_stop
Colchon:  scale_tare, scale_calibrate, mattress_reference, mattress_start,
          mattress_stop, alarm_stop
General:  get_status
"""
import config
import figuras
import monitoreo
import peso
import setup_colchon


def _numero(params, clave, minimo, maximo, defecto=None):
    """Saca un numero de params y comprueba que este en rango.

    Si falta y hay 'defecto', devuelve el defecto.
    """
    valor = params.get(clave)
    if valor is None and defecto is not None:
        return defecto
    if isinstance(valor, bool) or not isinstance(valor, (int, float)):
        raise ValueError("parametro_invalido:" + clave)
    if valor < minimo or valor > maximo:
        raise ValueError("fuera_de_rango:" + clave)
    return valor


def estado():
    """Resumen de lo que esta pasando ahora."""
    return {"sequence": figuras.secuencia_actual(),
            "mattress": monitoreo.resumen(),
            "scale_ready": peso.tiene_tara(),
            "scale_factor": peso.factor()}


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
    except OSError as error:                  # p. ej. el HX711 no responde
        confirmacion["ok"] = False
        confirmacion["error"] = "hardware:" + str(error)
    return confirmacion


def _ejecutar(nombre, params):
    # ---------- Figuras LED ----------
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

    # ---------- Colchon ----------
    if nombre == "scale_tare":
        if monitoreo.activo():
            raise ValueError("monitoreo_activo")
        if not peso.tomar_tara():
            raise ValueError("hx711_sin_respuesta")
        return {}

    if nombre == "scale_calibrate":
        if monitoreo.activo():
            raise ValueError("monitoreo_activo")
        conocido = _numero(params, "known_g", 1, 5000)
        return {"factor": peso.calibrar(conocido)}

    if nombre == "mattress_reference":
        return {"reference_g": monitoreo.capturar_referencia()}

    if nombre == "mattress_start":
        duracion = _numero(params, "duration_s", 1, 86400, setup_colchon.MONITORING_TIME)
        tolerancia = _numero(params, "tolerance_pct", 1, 50, setup_colchon.TOLERANCE)
        alarma = _numero(params, "alarm_s", 1, 600, config.ALARMA_S)
        monitoreo.iniciar(duracion, tolerancia, alarma)
        return {"duration_s": duracion, "tolerance_pct": tolerancia, "alarm_s": alarma}

    if nombre == "mattress_stop":
        if not monitoreo.detener("web"):
            raise ValueError("monitoreo_inactivo")
        return {}

    if nombre == "alarm_stop":
        if monitoreo.estado() != monitoreo.ALARMA:
            raise ValueError("sin_alarma")
        monitoreo.detener("web")
        return {}

    # ---------- General ----------
    if nombre == "get_status":
        return estado()

    raise ValueError("comando_desconocido")
