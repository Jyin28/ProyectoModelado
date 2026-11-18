"""comandos.py - Ejecuta ordenes y devuelve una confirmacion.

Una orden es un diccionario:
    {"command_id": "abc1", "command": "lamp_set", "params": {"level": 40}}

ejecutar(orden) devuelve la confirmacion:
    {"command_id": "abc1", "command": "lamp_set", "ok": True,  "result": {...}}
    {"command_id": "abc1", "command": "lamp_set", "ok": False, "error": "..."}

Por ahora las ordenes las genera demo.py. Mas adelante llegaran desde la
web. (Nombres de comandos PROVISIONALES: validar con el equipo de backend.)

Comandos: lamp_set, led_set, led_all, led_sequence, led_stop, motion_set, room_monitor_set,
feeding_weigh, get_status

Solo se aceptan los del modulo conectado (config.MODULO, ver modulo.py): lamp_set,
motion_set y audio_* en "cuna", led_* en "figuras", mattress_* en "colchon",
room_monitor_set {sensor: puerta|movimiento, enabled} en "habitacion",
feeding_weigh {toma_id, momento: inicial|control|final} en "alimentacion". Uno de otro modulo
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
_voz = None
_habitacion = None
_alimentacion = None
_monitoreo_movimiento = False   # arranca apagado; solo lo cambia motion_set


def conectar_habitacion(control):
    """Registra el control de la habitacion (o None para desconectarlo)."""
    global _habitacion
    _habitacion = control


def conectar_alimentacion(control):
    """Registra el control de la alimentacion (o None para desconectarlo)."""
    global _alimentacion
    _alimentacion = control


def conectar_colchon(control):
    """Registra el control del colchon (o None para desconectarlo)."""
    global _colchon
    _colchon = control


def conectar_audio(reproductor):
    """Registra el reproductor de audio (o None para desconectarlo)."""
    global _audio
    _audio = reproductor


def conectar_voz(voz):
    """Registra la sesion de voz (o None). Mientras hay voz no se reproduce audio local."""
    global _voz
    _voz = voz


def monitoreo_movimiento():
    """True si una orden confirmada activo el monitoreo de movimiento."""
    return _monitoreo_movimiento


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


def _habitacion_activa():
    if _habitacion is None:
        raise ValueError("habitacion_no_habilitada")
    return _habitacion


def _alimentacion_activa():
    if _alimentacion is None:
        raise ValueError("alimentacion_no_habilitada")
    return _alimentacion


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
    resumen = {"modulo": config.MODULO,
               "lampara": _lampara().nivel() if modulo.usa("lampara") else None,
               "secuencia": _figuras().secuencia_actual() if modulo.usa("figuras") else None,
               "colchon": _colchon.monitor.estado if _colchon is not None else None,
               "audio": _audio.estado()["estado"] if _audio is not None else None}
    if modulo.usa("habitacion") and _habitacion is not None:
        resumen["habitacion"] = _habitacion.estado()   # solo aparece en ese modulo
    if modulo.usa("alimentacion") and _alimentacion is not None:
        resumen["alimentacion"] = _alimentacion.estado(time.ticks_ms())   # solo en ese modulo
    return resumen


def estado_para_nube():
    """Estado que la Pico informa al servidor al conectarse o reconectarse.

    Solo claves del contrato reportar_estado_modulo (src/shared/contracts/ordenes.md):
    monitoreo, monitoreo_puerta, monitoreo_movimiento, secuencia y colchon. Lo
    que este apagado se informa apagado: asi el servidor no sigue mostrando un
    monitoreo que se perdio al reiniciar. El colchon inactivo o detenido se
    informa "detenido" (reanudar exige armar de nuevo). No lleva lecturas ni fotos.
    """
    informe = {}
    if modulo.usa("movimiento"):
        informe["monitoreo"] = bool(_monitoreo_movimiento)
    if modulo.usa("habitacion") and _habitacion is not None:
        actual = _habitacion.estado()
        informe["monitoreo_puerta"] = bool(actual.get("monitoreo_puerta"))
        informe["monitoreo_movimiento"] = bool(actual.get("monitoreo_movimiento"))
    if modulo.usa("figuras"):
        nombre = _figuras().secuencia_actual()
        informe["secuencia"] = nombre if _nombre_valido(nombre) else None
    if modulo.usa("colchon") and _colchon is not None:
        actual = _colchon.monitor.estado
        informe["colchon"] = actual if actual in ("activo", "alarma") else "detenido"
    return informe


def _nombre_valido(nombre):
    """Nombre de secuencia aceptado por el servidor: 1 a 40 letras minusculas o _."""
    if not isinstance(nombre, str) or not 1 <= len(nombre) <= 40:
        return False
    for caracter in nombre:
        if not ("a" <= caracter <= "z" or caracter == "_"):
            return False
    return True


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
    global _monitoreo_movimiento
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
        tolerancia = None               # sin parametro: la de config.py (CA-15.1)
        if "tolerance_pct" in params:
            tolerancia = _numero(params, "tolerance_pct", 0, 100)
        alarma = None                   # sin parametro: el tope de config.py (60 s)
        if "alarm_s" in params:
            alarma = _numero(params, "alarm_s", 0, config.COLCHON_ALARMA_MAX_S)
        colchon = _colchon_activo()
        if nombre == "mattress_arm":
            return colchon.armar(duracion, time.ticks_ms(), tolerancia, alarma)
        return colchon.rearmar(duracion, time.ticks_ms(), tolerancia, alarma)

    if nombre == "mattress_stop":
        return _colchon_activo().detener(time.ticks_ms())

    if nombre == "motion_set":
        activo = params.get("enabled")
        if not isinstance(activo, bool):
            raise ValueError("parametro_invalido:enabled")
        # config.py dice si el PIR esta cableado y habilitado; la orden solo lo enciende o apaga.
        if not config.MONITOREO_MOVIMIENTO_HABILITADO:
            raise ValueError("movimiento_no_habilitado")
        _monitoreo_movimiento = activo
        return {"enabled": activo}

    if nombre == "room_monitor_set":
        sensor = params.get("sensor")
        if sensor not in ("puerta", "movimiento"):
            raise ValueError("parametro_invalido:sensor")
        activo = params.get("enabled")
        if not isinstance(activo, bool):
            raise ValueError("parametro_invalido:enabled")
        return _habitacion_activa().fijar_monitoreo(sensor, activo)

    if nombre == "feeding_weigh":
        toma_id = params.get("toma_id")
        momento = params.get("momento")
        if not isinstance(toma_id, str):
            raise ValueError("parametro_invalido:toma_id")
        if not isinstance(momento, str):
            raise ValueError("parametro_invalido:momento")
        # El control valida el formato; el peso llega despues como evento.
        return _alimentacion_activa().pesar(toma_id, momento, time.ticks_ms())

    if nombre == "audio_play":
        sonido = params.get("sound")
        if not isinstance(sonido, str):
            raise ValueError("parametro_invalido:sound")
        if _voz is not None and _voz.activa():
            raise ValueError("voz_en_curso")
        return _audio_activo().iniciar(sonido)

    if nombre == "audio_stop":
        return _audio_activo().detener()

    if nombre == "audio_status":
        return _audio_activo().estado()

    raise ValueError("comando_desconocido")
