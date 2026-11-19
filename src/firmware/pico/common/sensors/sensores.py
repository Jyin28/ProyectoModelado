"""sensores.py - Lectura de los sensores de la cuna.

Funciones:
    leer_ambiente()    devuelve (temperatura_c, humedad_pct) o None si falla
    hay_movimiento()   True si el PIR detecta movimiento (False mientras se estabiliza)
    pir_listo()        True cuando el PIR ya termino de estabilizarse
"""
import dht
import time
from machine import Pin

import config
import pir

# AM2301 se maneja con la clase DHT22 de MicroPython.
# VERIFICAR el modelo: la variante AM2301B es I2C y necesita otro codigo.
_sensor_ambiente = dht.DHT22(Pin(config.PIN_AM2301))

# PIR HC-SR501: entrega 1 cuando ve movimiento y 0 cuando no. Pull-down como en
# el codigo funcional. Tras encender tarda ~60 s en estabilizarse (ver pir.py).
_pir = Pin(config.PIN_PIR, Pin.IN, Pin.PULL_DOWN)
_estabilizador = pir.EstabilizadorPIR(
    _pir.value, time.ticks_ms, time.ticks_diff,
    config.PIR_ESTABILIZACION_S, config.PIR_REPOSO_S)


def leer_ambiente():
    """Lee temperatura y humedad. Devuelve None si el sensor no responde."""
    try:
        _sensor_ambiente.measure()
        return _sensor_ambiente.temperature(), _sensor_ambiente.humidity()
    except OSError as error:
        print("Error leyendo AM2301:", error)
        return None


def hay_movimiento():
    return _estabilizador.actualizar()


def pir_listo():
    return _estabilizador.listo
