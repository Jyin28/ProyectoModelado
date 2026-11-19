"""rutas.py - Encuentra archivos de la Pico sin depender de donde se copiaron.

main.py busca los modulos en la raiz de la Pico o bajo "/pico/...", pero el certificado
y el WAV se suelen copiar a la raiz. buscar() prueba las ubicaciones habituales y devuelve la
primera que existe (o la ruta original si ninguna existe, para que el error de
open() diga cual faltaba).
"""
import os

# Ubicaciones donde puede estar un archivo, de mas a menos probable.
_RAICES = ("", "/pico", "/pico/cuna", "/cuna")


def existe(ruta):
    try:
        os.stat(ruta)
        return True
    except OSError:
        return False


def candidatas(ruta):
    """Rutas a probar para 'ruta' (absoluta o relativa), sin repetir."""
    nombre = ruta.lstrip("/")
    resultado = [ruta]
    for raiz in _RAICES:
        candidata = raiz + "/" + nombre
        if candidata not in resultado:
            resultado.append(candidata)
    return resultado


def buscar(ruta, existe_fn=existe):
    """Primera ruta candidata que existe; si ninguna, devuelve 'ruta' sin cambios."""
    for candidata in candidatas(ruta):
        if existe_fn(candidata):
            return candidata
    return ruta
