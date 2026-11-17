"""sensores.py (ZERO) - Lectura de los sensores de la cuna.

Funciones:
    leer_ambiente()    devuelve (temperatura_c, humedad_pct) o None si falla
    hay_movimiento()   True si el PIR detecta movimiento
    cerrar()           libera los pines al terminar

El AM2301 (DHT21) usa el mismo protocolo que el DHT22, asi que se maneja con
la clase DHT22 de adafruit_dht. VERIFICAR el modelo: la variante AM2301B es
I2C y necesita otro codigo. Falla seguido con errores de lectura (checksum);
es normal, simplemente se reintenta en el siguiente ciclo.
"""
import adafruit_dht
import board
from gpiozero import DigitalInputDevice

import config

_sensor_ambiente = adafruit_dht.DHT22(getattr(board, "D%d" % config.PIN_AM2301),
                                      use_pulseio=False)

# PIR: entrega 1 cuando ve movimiento y 0 cuando no. Tarda ~1 min en estabilizarse.
_pir = DigitalInputDevice(config.PIN_PIR, pull_up=False)


def leer_ambiente():
    """Lee temperatura y humedad. Devuelve None si el sensor no responde."""
    try:
        temperatura = _sensor_ambiente.temperature
        humedad = _sensor_ambiente.humidity
    except (RuntimeError, OSError) as error:
        print("Error leyendo AM2301:", error)
        return None
    if temperatura is None or humedad is None:
        return None
    return temperatura, humedad


def hay_movimiento():
    return bool(_pir.value)


def cerrar():
    _sensor_ambiente.exit()
    _pir.close()
