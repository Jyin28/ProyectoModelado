"""almacen_calibracion.py - Guarda el factor de calibracion del colchon en la Pico.

Como la Pico se pasa de un modulo a otro y se reinicia, el factor
(cuentas por gramo) se guarda en un archivo JSON {"factor": ...} para no
repetir la calibracion con la pesa conocida cada vez.

Solo se guarda el factor: la tara depende del montaje y se toma de nuevo.
Un archivo ausente, ilegible o con un factor invalido se trata como "sin
calibracion guardada" (cargar() devuelve None), nunca como un valor por defecto.
"""
import json
import math


def factor_valido(valor):
    """El factor puede ser negativo (segun el cableado), pero no cero ni infinito."""
    return (isinstance(valor, (int, float)) and not isinstance(valor, bool)
            and math.isfinite(valor) and valor != 0)


class AlmacenArchivo:
    def __init__(self, ruta):
        self._ruta = ruta

    def cargar(self):
        """Devuelve el factor guardado, o None si no hay uno valido."""
        try:
            with open(self._ruta) as archivo:
                factor = json.load(archivo)["factor"]
        except (OSError, ValueError, KeyError, TypeError):
            return None
        return float(factor) if factor_valido(factor) else None

    def guardar(self, factor):
        """Guarda el factor. Devuelve True si se pudo escribir."""
        if not factor_valido(factor):
            return False
        try:
            with open(self._ruta, "w") as archivo:
                json.dump({"factor": float(factor)}, archivo)
        except OSError:
            return False
        return True
