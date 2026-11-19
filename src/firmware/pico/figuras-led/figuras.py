"""figuras.py - Seis LED comunes con secuencias.

Funciones:
    encender_led(indice, encendido)      un LED (0 a 5)
    todos(encendido)                     los seis a la vez
    iniciar_secuencia(nombre, intervalo_s)
    detener_secuencia()
    actualizar()                         llamar en cada vuelta del ciclo principal
    secuencia_actual()                   nombre o None

Secuencias: "chase" (un LED recorre la fila), "alternate" (alternados),
"blink_all" (todos parpadean). El intervalo minimo es de 2 s para evitar
destellos bruscos. Cada LED pasa de un brillo al otro con una rampa de
LED_RAMPA_MS (PWM), asi que nunca hay un salto brusco. SIN PROBAR EN HARDWARE.
"""
import time
from machine import Pin, PWM

import config
import rampa

_leds = [PWM(Pin(pin), freq=config.LED_PWM_HZ, duty_u16=0) for pin in config.PINES_LEDS]
_rampa = rampa.Rampa(len(_leds), config.LED_RAMPA_MS)

# Datos de la secuencia en curso (guardados juntos para no usar muchas globales)
_estado = {
    "nombre": None,        # secuencia activa, o None
    "paso": 0,             # cuantos cambios lleva
    "intervalo_ms": 0,
    "ultimo_cambio": 0,
}


def encender_led(indice, encendido):
    """Enciende o apaga UN LED sin tocar los demas (varias figuras a la vez).

    Si hay una secuencia en curso, el control manual la reemplaza: se detiene y
    todo se apaga antes de aplicar el cambio, para no mezclar ambos modos.
    """
    if indice < 0 or indice >= len(_leds):
        raise ValueError("indice_invalido")
    if _estado["nombre"] is not None:
        detener_secuencia()
    _rampa.objetivo(indice, encendido)


def todos(encendido):
    detener_secuencia()
    _poner_todos(encendido)


def _poner_todos(encendido):
    _rampa.todos(encendido)


def iniciar_secuencia(nombre, intervalo_s):
    if nombre not in config.SECUENCIAS_LED:
        raise ValueError("secuencia_desconocida")
    intervalo_s = max(intervalo_s, config.LED_INTERVALO_MINIMO_S)

    _estado["nombre"] = nombre
    _estado["paso"] = 0
    _estado["intervalo_ms"] = int(intervalo_s * 1000)
    # Se resta el intervalo para que el primer paso ocurra enseguida
    _estado["ultimo_cambio"] = time.ticks_add(time.ticks_ms(),
                                              -_estado["intervalo_ms"])


def detener_secuencia():
    _estado["nombre"] = None
    _poner_todos(False)


def apagar():
    """Apagado inmediato, sin rampa: para cerrar el programa.

    Con el programa detenido ya nadie avanza las rampas, y el PWM sigue con el
    ultimo brillo; por eso se escribe cero en cada LED directamente.
    """
    _estado["nombre"] = None
    _rampa.apagar()
    for led in _leds:
        led.duty_u16(0)


def secuencia_actual():
    return _estado["nombre"]


def actualizar():
    """Avanza la secuencia y las rampas. No bloquea: vuelve enseguida."""
    for indice, nivel in _rampa.paso(time.ticks_ms()):
        _leds[indice].duty_u16(nivel)
    if _estado["nombre"] is None:
        return
    transcurrido = time.ticks_diff(time.ticks_ms(), _estado["ultimo_cambio"])
    if transcurrido < _estado["intervalo_ms"]:
        return
    _estado["ultimo_cambio"] = time.ticks_ms()
    _aplicar_paso(_estado["nombre"], _estado["paso"])
    _estado["paso"] += 1


def _aplicar_paso(nombre, paso):
    cantidad = len(_leds)
    for posicion in range(cantidad):
        if nombre == "chase":
            encendido = (posicion == paso % cantidad)
        elif nombre == "alternate":
            encendido = ((posicion + paso) % 2 == 0)
        else:                                   # "blink_all"
            encendido = (paso % 2 == 0)
        _rampa.objetivo(posicion, encendido)
