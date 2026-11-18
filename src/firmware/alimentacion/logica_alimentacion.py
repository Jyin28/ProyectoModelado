"""logica_alimentacion.py - Reglas puras del pesaje y de la temperatura del biberon.

Sin hardware ni red: se prueba en CPython. Los limites de frio y calor y la
toma completa viven en el servidor; aqui solo se decide si una medicion sirve
para informarla.

Pesaje (la web conduce la toma, la Pico pesa por orden):
  - 'inicial' y 'final' son pesos del mismo recipiente, asi que deben superar
    ALIMENTACION_PESO_MIN_G (hay un recipiente en la balanza) y no pasar el
    rango de la celda.
  - 'control' (biberon devuelto a mitad de la toma) puede ser 0 g.
  - Sin tara y factor de calibracion no hay gramos: se informa 'sin_calibracion'.
  - Una lectura que no sirve se informa como 'sin_lectura'. Nunca se inventa un
    peso.
"""
import math

MOMENTOS = ("inicial", "control", "final")
MOTIVO_SIN_CALIBRACION = "sin_calibracion"
MOTIVO_SIN_LECTURA = "sin_lectura"

# El DS18B20 entrega 85.0 C al encender o si la conversion no termino: no es una medicion.
TEMPERATURA_DE_ARRANQUE_C = 85.0
TEMPERATURA_MIN_C = -55.0
TEMPERATURA_MAX_C = 125.0

_HEX = "0123456789abcdef"


def toma_id_valido(valor):
    """UUID en minusculas con guiones (8-4-4-4-12), como lo guarda el servidor."""
    if not isinstance(valor, str) or len(valor) != 36:
        return False
    for i, c in enumerate(valor):
        if i in (8, 13, 18, 23):
            if c != "-":
                return False
        elif c not in _HEX:
            return False
    return True


def momento_valido(valor):
    return isinstance(valor, str) and valor in MOMENTOS


def numero_valido(valor):
    return (isinstance(valor, (int, float)) and not isinstance(valor, bool)
            and math.isfinite(valor))


def evaluar_peso(gramos, momento, peso_min_g, peso_max_g):
    """Devuelve (gramos_a_informar, None) o (None, motivo_de_fallo).

    gramos es None si no hay calibracion. Redondea a 0,1 g.
    """
    if gramos is None:
        return None, MOTIVO_SIN_CALIBRACION
    if not numero_valido(gramos) or gramos > peso_max_g:
        return None, MOTIVO_SIN_LECTURA
    if momento == "control":
        return round(max(gramos, 0.0), 1), None
    if gramos < peso_min_g:
        return None, MOTIVO_SIN_LECTURA
    return round(gramos, 1), None


def temperatura_informable(valor):
    """Redondea a 0,01 C si la lectura es una medicion; None si no lo es."""
    if not numero_valido(valor):
        return None
    if valor == TEMPERATURA_DE_ARRANQUE_C:
        return None
    if valor < TEMPERATURA_MIN_C or valor > TEMPERATURA_MAX_C:
        return None
    return round(valor, 2)
