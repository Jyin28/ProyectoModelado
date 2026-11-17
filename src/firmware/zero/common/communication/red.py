"""red.py (ZERO) - Comprueba que haya Internet.

En la Zero el WiFi lo conecta y reconecta Raspberry Pi OS; aqui solo se
verifica que funcione, para avisar y detener el audio si se cae.

Funciones:
    hay_internet()   True si se puede abrir una conexion TCP al servidor
    revisar()        igual, pero imprime un aviso cuando el estado cambia
"""
import socket
from urllib.parse import urlparse

import secretos

_URL = getattr(secretos, "INGESTA_URL", "")
_ultimo = {"estado": None}


def _destino():
    """Servidor a probar: el de la ingesta, o 1.1.1.1 si todavia no hay URL."""
    if _URL:
        partes = urlparse(_URL)
        return partes.hostname, partes.port or (443 if partes.scheme == "https" else 80)
    return "1.1.1.1", 443


def hay_internet():
    try:
        socket.create_connection(_destino(), timeout=2).close()
        return True
    except OSError:
        return False


def revisar():
    estado = hay_internet()
    if estado != _ultimo["estado"]:
        print("Internet:", "conectado" if estado else "SIN CONEXION")
        _ultimo["estado"] = estado
    return estado
