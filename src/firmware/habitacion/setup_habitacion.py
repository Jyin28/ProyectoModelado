"""setup_habitacion.py - Crea el hardware de la habitacion a partir de config.py.

Los pines salen SOLO de config.py (propuesta pendiente de cableado). No toca
ningun pin al importarse: crear_hardware() se llama solo si HABITACION_HABILITADO
es True.
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
    """Devuelve (pin_puerta, pin_pir)."""
    validar_pines((cfg.PIN_PUERTA, cfg.PIN_PIR_HABITACION), cfg.PINES_RESERVADOS_WIFI)

    from machine import Pin

    puerta = Pin(cfg.PIN_PUERTA, Pin.IN, Pin.PULL_UP)   # reed a GND: cerrado = 0
    pir = Pin(cfg.PIN_PIR_HABITACION, Pin.IN)
    return puerta, pir
