"""lampara.py (ZERO) - LED blanco regulable (PWM a traves del MOSFET IRLZ44N).

Funciones:
    poner_nivel(porcentaje)   0 = apagada, 100 = maximo brillo
    encender() / apagar()
    nivel()                   devuelve el porcentaje actual
    cerrar()                  apaga y libera el pin al terminar

OJO (circuito): el LED necesita su propia resistencia en serie; las de 100 ohm y
100 kohm del esquema son de la compuerta del MOSFET. Comprobar que el IRLZ44N
conduzca bien con 3,3 V para esta carga pequena.
"""
from gpiozero import PWMLED

import config

# PWM por software: enciende y apaga el pin muy rapido; el "ancho" da el brillo
_led = PWMLED(config.PIN_LAMPARA, frequency=config.LAMPARA_FRECUENCIA_HZ,
              initial_value=0)             # arranque seguro: lampara apagada

_nivel_actual = 0


def poner_nivel(porcentaje):
    """Ajusta el brillo. Lanza ValueError si no esta entre 0 y 100."""
    global _nivel_actual
    if porcentaje < 0 or porcentaje > 100:
        raise ValueError("fuera_de_rango")
    _nivel_actual = int(porcentaje)
    _led.value = _nivel_actual / 100          # gpiozero usa de 0.0 a 1.0


def encender():
    poner_nivel(100)


def apagar():
    poner_nivel(0)


def nivel():
    return _nivel_actual


def cerrar():
    apagar()
    _led.close()
