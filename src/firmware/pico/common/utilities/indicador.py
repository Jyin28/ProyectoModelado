"""indicador.py - El LED integrado de la Pico W, para ver que el programa vive.

No necesita ningun componente externo.
"""
import time
from machine import Pin

_led = Pin("LED", Pin.OUT)   # en la Pico W el LED interno se llama "LED"


def encender():
    _led.value(1)


def apagar():
    _led.value(0)


def parpadear(veces=1, ms=100):
    """Enciende y apaga el LED 'veces' veces."""
    for _ in range(veces):
        _led.value(1)
        time.sleep_ms(ms)
        _led.value(0)
        time.sleep_ms(ms)
