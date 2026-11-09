"""sensores.py - Lectura de los sensores de la cuna.

Funciones:
    leer_ambiente()    devuelve (temperatura_c, humedad_pct) o None si falla
    hay_movimiento()   True si el PIR detecta movimiento
"""
import dht
from machine import Pin
import config

# AM2301 se maneja con la clase DHT22 de MicroPython.
# VERIFICAR el modelo: la variante AM2301B es I2C y necesita otro codigo.
_sensor_ambiente = dht.DHT22(Pin(config.PIN_AM2301))

# PIR: entrega 1 cuando ve movimiento y 0 cuando no
_pir = Pin(config.PIN_PIR, Pin.IN)


def leer_ambiente():
    """Lee temperatura y humedad. Devuelve None si el sensor no responde."""
    try:
        _sensor_ambiente.measure()
        ### devuelve temperatura en C y humedad relativa en % (float)
        return _sensor_ambiente.temperature(), _sensor_ambiente.humidity()
    except OSError as error:
        print("Error leyendo AM2301:", error)
        return None


def hay_movimiento():
    return _pir.value() == 1
