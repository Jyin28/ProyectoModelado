"""setup_juego.py - Crea el hardware del juego a partir de config.py.

Los pines salen SOLO de config.py (propuesta pendiente de cableado). No toca
ningun pin al importarse: crear_hardware() se llama solo si JUEGO_HABILITADO es
True. El buzzer y los LED arrancan apagados.
"""


def validar_pines(pines, reservados):
    """Rechaza pines repetidos o reservados por el chip WiFi (GP23/24/25/29)."""
    vistos = []
    for pin in pines:
        if pin in reservados:
            raise ValueError("pin_reservado_wifi:%d" % pin)
        if pin in vistos:
            raise ValueError("pin_repetido:%d" % pin)
        vistos.append(pin)


def crear_hardware(cfg):
    """Devuelve (botones, leds, buzzer)."""
    validar_pines(tuple(cfg.PINES_JUEGO_BOTONES) + tuple(cfg.PINES_JUEGO_LEDS)
                  + (cfg.PIN_JUEGO_BUZZER,), cfg.PINES_RESERVADOS_WIFI)

    from machine import Pin, PWM
    from setup_colchon import BuzzerPasivo

    botones = [Pin(p, Pin.IN, Pin.PULL_UP if cfg.JUEGO_BOTON_ACTIVO_BAJO else Pin.PULL_DOWN)
               for p in cfg.PINES_JUEGO_BOTONES]
    leds = [Pin(p, Pin.OUT, value=0) for p in cfg.PINES_JUEGO_LEDS]
    buzzer = BuzzerPasivo(Pin(cfg.PIN_JUEGO_BUZZER), Pin.OUT, PWM, cfg.JUEGO_TONO_HZ)
    return botones, leds, buzzer
