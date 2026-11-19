"""modulo.py - Decide que periféricos atiende la Pico segun el modulo conectado.

Hay una sola Pico 2 W y se conecta a UN modulo por vez (cuna, colchon o
figuras LED, habitacion...); despues se desconecta y se pasa a otro. config.MODULO indica
cual esta conectado, y solo se inicializa lo que pertenece a ese modulo:
asi un sensor sin cablear no genera lecturas falsas ni toca pines ajenos.

Funciones:
    validar(nombre=None)      lanza ValueError si el modulo no existe
    usa(periferico)           True si el periferico pertenece al modulo activo
    periferico_de(comando)    periferico que necesita un comando (None si es de todos)
"""
import config

# Periféricos que atiende cada modulo.
PERIFERICOS = {
    "cuna": ("ambiente", "movimiento", "lampara", "audio"),
    "colchon": ("colchon",),
    "figuras": ("figuras",),
    "habitacion": ("habitacion",),
    "juego": ("juego",),
    "alimentacion": ("alimentacion",),
}

# Periferico que necesita cada comando. Los que no aparecen (get_status) valen
# para cualquier modulo.
_COMANDOS = {
    "lamp_set": "lampara",
    "led_set": "figuras", "led_all": "figuras",
    "led_sequence": "figuras", "led_stop": "figuras",
    "scale_tare": "colchon", "scale_calibrate": "colchon",
    "mattress_reference": "colchon", "mattress_start": "colchon",
    "mattress_stop": "colchon", "alarm_stop": "colchon",
    "audio_play": "audio", "audio_stop": "audio", "audio_status": "audio",
    "motion_set": "movimiento",
    "room_monitor_set": "habitacion",
    "feeding_weigh": "alimentacion",
}


def validar(nombre=None):
    """Devuelve el nombre del modulo; lanza ValueError si no es uno conocido."""
    if nombre is None:
        nombre = config.MODULO
    if nombre not in PERIFERICOS:
        raise ValueError("modulo_invalido:%s" % (nombre,))
    return nombre


def usa(periferico):
    """True si 'periferico' pertenece al modulo conectado. Un modulo invalido no usa ninguno."""
    return periferico in PERIFERICOS.get(config.MODULO, ())


def requiere_red():
    """False en el juego: funciona solo en la Pico, sin WiFi (HU-19)."""
    return config.MODULO != "juego"


def periferico_de(comando):
    """Periferico que necesita un comando, o None si sirve en cualquier modulo."""
    return _COMANDOS.get(comando)
