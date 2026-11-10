"""lampara.py - LED blanco regulable (PWM a traves del MOSFET IRLZ44N).

Funciones:
    poner_nivel(porcentaje)   0 = apagada, 100 = maximo brillo
    encender() / apagar()
    nivel()                   devuelve el porcentaje actual
"""
from machine import Pin, PWM

import config

# PWM: enciende y apaga el pin muy rapido; el "ancho" del pulso da el brillo
_pwm = PWM(Pin(config.PIN_LAMPARA))
_pwm.freq(config.LAMPARA_FRECUENCIA_HZ)
_pwm.duty_u16(0)             # arranque seguro: lampara apagada

_nivel_actual = 0


def poner_nivel(porcentaje):
    """Ajusta el brillo. Lanza ValueError si no esta entre 0 y 100."""
    global _nivel_actual
    if porcentaje < 0 or porcentaje > 100:
        raise ValueError("fuera_de_rango")
    _nivel_actual = int(porcentaje)
    _pwm.duty_u16(_nivel_actual * 65535 // 100)   # duty_u16 va de 0 a 65535


def encender():
    poner_nivel(100)


def apagar():
    poner_nivel(0)


def nivel():
    return _nivel_actual
