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
destellos bruscos.
"patrones" es el ciclo del codigo funcional (secuencial, parpadeo, alternado,
rebote y progresivo) con sus propios tiempos: ignora el intervalo pedido.
"""
import time
from machine import Pin

import config
import efectos

_leds = [Pin(pin, Pin.OUT, value=0) for pin in config.PINES_LEDS]

# Datos de la secuencia en curso (guardados juntos para no usar muchas globales)
_estado = {
    "nombre": None,        # secuencia activa, o None
    "paso": 0,             # cuantos cambios lleva
    "intervalo_ms": 0,
    "ultimo_cambio": 0,
    "pasos": None,         # pasos de "patrones": [(indices, duracion_ms), ...]
}


def encender_led(indice, encendido):
    if indice < 0 or indice >= len(_leds):
        raise ValueError("indice_invalido")
    detener_secuencia()
    _leds[indice].value(1 if encendido else 0)


def todos(encendido):
    detener_secuencia()
    _poner_todos(encendido)


def _poner_todos(encendido):
    for led in _leds:
        led.value(1 if encendido else 0)


def iniciar_secuencia(nombre, intervalo_s):
    if nombre not in config.SECUENCIAS_LED:
        raise ValueError("secuencia_desconocida")
    intervalo_s = max(intervalo_s, config.LED_INTERVALO_MINIMO_S)

    _estado["nombre"] = nombre
    _estado["paso"] = 0
    _estado["pasos"] = efectos.pasos_patrones(len(_leds)) if nombre == "patrones" else None
    _estado["intervalo_ms"] = int(intervalo_s * 1000)
    # Se resta el intervalo para que el primer paso ocurra enseguida
    _estado["ultimo_cambio"] = time.ticks_add(time.ticks_ms(),
                                              -_estado["intervalo_ms"])


def detener_secuencia():
    _estado["nombre"] = None
    _poner_todos(False)


def secuencia_actual():
    return _estado["nombre"]


def actualizar():
    """Avanza la secuencia si ya toca. No bloquea: vuelve enseguida."""
    if _estado["nombre"] is None:
        return
    transcurrido = time.ticks_diff(time.ticks_ms(), _estado["ultimo_cambio"])
    if transcurrido < _estado["intervalo_ms"]:
        return
    _estado["ultimo_cambio"] = time.ticks_ms()
    if _estado["pasos"] is not None:
        indices, duracion_ms = _estado["pasos"][_estado["paso"] % len(_estado["pasos"])]
        for posicion, led in enumerate(_leds):
            led.value(1 if posicion in indices else 0)
        _estado["intervalo_ms"] = duracion_ms      # hasta el paso siguiente
        _estado["paso"] += 1
        return
    _aplicar_paso(_estado["nombre"], _estado["paso"])
    _estado["paso"] += 1


def _aplicar_paso(nombre, paso):
    cantidad = len(_leds)
    for posicion, led in enumerate(_leds):
        if nombre == "chase":
            encendido = (posicion == paso % cantidad)
        elif nombre == "alternate":
            encendido = ((posicion + paso) % 2 == 0)
        else:                                   # "blink_all"
            encendido = (paso % 2 == 0)
        led.value(1 if encendido else 0)
