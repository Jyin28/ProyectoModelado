"""modulo.py - Decide que periféricos atiende la Pico segun el modulo conectado.

Hay una sola Pico 2 W. Se conecta a un modulo por vez (cuna o figuras LED) o,
como en el codigo funcional, a todo a la vez ("completo": los pines de la cuna y
de las figuras no se pisan). config.MODULO indica cual esta conectado, y solo se inicializa lo que pertenece a ese modulo:
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
    "figuras": ("figuras",),
    "completo": ("ambiente", "movimiento", "lampara", "audio", "figuras"),
}

# Periferico que necesita cada comando. Los que no aparecen (get_status) valen
# para cualquier modulo.
_COMANDOS = {
    "lamp_set": "lampara",
    "led_set": "figuras", "led_all": "figuras",
    "led_sequence": "figuras", "led_stop": "figuras",
    "audio_play": "audio", "audio_stop": "audio", "audio_status": "audio",
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


def periferico_de(comando):
    """Periferico que necesita un comando, o None si sirve en cualquier modulo."""
    return _COMANDOS.get(comando)
