"""peso.py - Tara, calibracion y lectura de peso con el HX711.

Usa las funciones de colchon/setup_colchon.py (que no se modifica).

Funciones:
    tomar_tara()            toma el valor "en vacio"; True si lo logra
    tiene_tara()            True si ya hay una tara guardada
    calibrar(gramos)        con un peso conocido encima, calcula y guarda el factor
    leer_peso()             peso en gramos, o None si no se pudo leer
    leer_muestras(n)        lista de n pesos (lanza OSError si el HX711 falla)

El factor de calibracion se guarda en calibracion.json (memoria de la Pico)
y se carga al arrancar. Sin calibrar vale 420 (provisional de setup_colchon.py),
y los gramos son solo aproximados.
"""
import json

import config
import setup_colchon

# Cada cuantos milisegundos conviene leer el peso (viene de setup_colchon.py)
INTERVALO_MS = setup_colchon.READING_INTERVAL

# Valor crudo del HX711 con la balanza vacia. None = todavia no se ha tomado.
_referencia = None


def _cargar_calibracion():
    """Si hay un factor guardado, lo pone en setup_colchon."""
    try:
        with open(config.ARCHIVO_CALIBRACION) as archivo:
            factor = float(json.load(archivo)["factor"])
        if factor != 0:
            setup_colchon.CALIBRATION_FACTOR = factor
            print("Calibracion cargada. Factor:", factor)
    except (OSError, ValueError, KeyError, TypeError):
        print("Sin calibracion guardada. Factor provisional:",
              setup_colchon.CALIBRATION_FACTOR)


def _guardar_calibracion(factor):
    try:
        with open(config.ARCHIVO_CALIBRACION, "w") as archivo:
            json.dump({"factor": factor}, archivo)
    except OSError as error:
        print("No se pudo guardar la calibracion:", error)


_cargar_calibracion()


def factor():
    return setup_colchon.CALIBRATION_FACTOR


def tomar_tara():
    """Toma la tara con la balanza vacia. Devuelve True si lo logra."""
    global _referencia
    try:
        _referencia = setup_colchon.tare(10)
        print("HX711 listo. Tara:", _referencia)
        return True
    except OSError as error:
        print("HX711 sin respuesta:", error)
        return False


def tiene_tara():
    return _referencia is not None


def calibrar(gramos_conocidos):
    """Calibra con un peso conocido sobre la balanza. Devuelve el factor nuevo.

    Lanza ValueError si falta la tara o no se nota el peso, y OSError si el
    HX711 no responde.
    """
    if _referencia is None:
        raise ValueError("sin_tara")
    if gramos_conocidos <= 0:
        raise ValueError("fuera_de_rango")
    crudo = setup_colchon.read_average(10)
    diferencia = crudo - _referencia
    if abs(diferencia) < 1:
        raise ValueError("sin_diferencia")      # no se puso el peso
    nuevo = diferencia / gramos_conocidos
    setup_colchon.CALIBRATION_FACTOR = nuevo
    _guardar_calibracion(nuevo)
    print("Calibrado. Factor:", nuevo)
    return nuevo


def leer_peso():
    """Devuelve el peso en gramos, o None si no hay tara o falla la lectura."""
    if _referencia is None:
        return None
    try:
        crudo = setup_colchon.read_average(1)
        return setup_colchon.get_weight(crudo, _referencia)
    except OSError as error:
        print("Error leyendo HX711:", error)
        return None


def leer_muestras(cantidad):
    """Lee 'cantidad' pesos seguidos. Lanza ValueError sin tara u OSError si falla."""
    if _referencia is None:
        raise ValueError("sin_tara")
    return [setup_colchon.get_weight(setup_colchon.read_average(1), _referencia)
            for _ in range(cantidad)]
