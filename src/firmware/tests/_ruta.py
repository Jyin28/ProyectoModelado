"""Prepara sys.path para importar los modulos del firmware en CPython."""
import os
import sys
import types

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _carpeta in ("colchon", "cuna", os.path.join("common", "utilities")):
    _ruta = os.path.join(RAIZ, _carpeta)
    if _ruta not in sys.path:
        sys.path.insert(0, _ruta)

import config  # noqa: E402


def cfg_prueba(**cambios):
    """Copia de config.py con cambios, como objeto simple."""
    datos = {n: getattr(config, n) for n in dir(config) if n.isupper()}
    datos.update(cambios)
    return types.SimpleNamespace(**datos)
