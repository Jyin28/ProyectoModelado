"""comandos.py - Ejecuta ordenes y devuelve una confirmacion.

Una orden es un diccionario:
    {"command_id": "abc1", "command": "lamp_set", "params": {"level": 40}}

ejecutar(orden) devuelve la confirmacion:
    {"command_id": "abc1", "command": "lamp_set", "ok": True,  "result": {...}}
    {"command_id": "abc1", "command": "lamp_set", "ok": False, "error": "..."}

Por ahora las ordenes las genera demo.py. Mas adelante llegaran desde la
web. (Nombres de comandos PROVISIONALES: validar con el equipo de backend.)

Comandos: lamp_set, led_set, led_all, led_sequence, led_stop, get_status

Solo se aceptan los del modulo conectado (config.MODULO, ver modulo.py): lamp_set y
audio_* en "cuna", led_* en "figuras", mattress_* en "colchon". Uno de otro modulo
se rechaza con el error "comando_de_otro_modulo:<modulo>" sin tocar ningun pin.
get_status sirve siempre e incluye el campo "modulo".

Comandos locales del colchon y del audio (se pueden invocar sin red; solo
funcionan si main.py los registro con conectar_colchon / conectar_audio, es
decir, si COLCHON_HABILITADO / AUDIO_HABILITADO estan en True):
    mattress_tare, mattress_calibrate {known_weight_g}, mattress_arm {duration_s?},
    mattress_rearm {duration_s?}, mattress_status, mattress_stop,
    audio_play {sound}, audio_stop, audio_status
Las acciones del colchon que miden (tara, calibrar, armar, rearmar) devuelven
{"pendiente": True}; el resultado aparece en mattress_status > ultimo_resultado.
"""
import time

import config
import modulo

_colchon = None
_audio = None


def conectar_colchon(control):
    """Registra el control del colchon (o None para desconectarlo)."""
    global _colchon
    _colchon = control


def conectar_audio(reproductor):
    """Registra el reproductor de audio (o None para desconectarlo)."""
    global _audio
    _audio = reproductor


def _lampara():
    """Importa lampara.py solo cuando hace falta: al importarse configura el PWM."""
    import lampara
    return lampara


def _figuras():
    """Importa figuras.py solo cuando hace falta: al importarse configura los LED."""
    import figuras
    return figuras


def _colchon_activo():
    if _colchon is None:
        raise ValueError("colchon_no_habilitado")
    return _colchon


def _audio_activo():
    if _audio is None:
        raise ValueError("audio_no_habilitado")
    return _audio


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
    return {"modulo": config.MODULO,
            "lampara": _lampara().nivel() if modulo.usa("lampara") else None,
            "secuencia": _figuras().secuencia_actual() if modulo.usa("figuras") else None,
            "colchon": _colchon.monitor.estado if _colchon is not None else None,
            "audio": _audio.estado()["estado"] if _audio is not None else None}


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
    necesario = modulo.periferico_de(nombre)
    if necesario is not None and not modulo.usa(necesario):
        raise ValueError("comando_de_otro_modulo:%s" % (config.MODULO,))

    if nombre == "lamp_set":
        lampara = _lampara()
        lampara.poner_nivel(_numero(params, "level", 0, 100))
        return {"level": lampara.nivel()}

    if nombre == "led_set":
        indice = int(_numero(params, "index", 0, len(config.PINES_LEDS) - 1))
        _figuras().encender_led(indice, bool(params.get("on")))
        return {}

    if nombre == "led_all":
        _figuras().todos(bool(params.get("on")))
        return {}

    if nombre == "led_sequence":
        intervalo = _numero(params, "step_s", config.LED_INTERVALO_MINIMO_S, 3600)
        figuras = _figuras()
        figuras.iniciar_secuencia(params.get("name"), intervalo)
        return {"sequence": figuras.secuencia_actual()}

    if nombre == "led_stop":
        _figuras().todos(False)
        return {}

    if nombre == "get_status":
        return estado()

    if nombre == "mattress_status":
        return _colchon_activo().estado(time.ticks_ms())

    if nombre == "mattress_tare":
        return _colchon_activo().tara(time.ticks_ms())

    if nombre == "mattress_calibrate":
        peso = _numero(params, "known_weight_g", 0, 5000)   # celda de 5 kg
        return _colchon_activo().calibrar(peso, time.ticks_ms())

    if nombre in ("mattress_arm", "mattress_rearm"):
        duracion = None                 # sin parametro: se usa la duracion previa/por defecto
        if "duration_s" in params:      # presente pero nulo/negativo se rechaza (DEC-13)
            duracion = _numero(params, "duration_s", 0, config.COLCHON_MONITOREO_MAX_S)
        colchon = _colchon_activo()
        if nombre == "mattress_arm":
            return colchon.armar(duracion, time.ticks_ms())
        return colchon.rearmar(duracion, time.ticks_ms())

    if nombre == "mattress_stop":
        return _colchon_activo().detener(time.ticks_ms())

    if nombre == "audio_play":
        sonido = params.get("sound")
        if not isinstance(sonido, str):
            raise ValueError("parametro_invalido:sound")
        return _audio_activo().iniciar(sonido)

    if nombre == "audio_stop":
        return _audio_activo().detener()

    if nombre == "audio_status":
        return _audio_activo().estado()

    raise ValueError("comando_desconocido")
