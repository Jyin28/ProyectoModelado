
"""Generación de eventos UUID v4 con fecha UTC para Supabase (MicroPython)."""

import binascii
import os
import time

_hora_sincronizada = False


def sincronizar_hora():
    """Sincroniza el reloj mediante NTP y valida que la hora sea razonable."""
    global _hora_sincronizada

    _hora_sincronizada = False

    try:
        import ntptime
        ntptime.settime()

        t = time.gmtime()

        if t[0] < 2024:
            raise RuntimeError("La fecha obtenida por NTP no es valida.")

        _hora_sincronizada = True

        print("Hora UTC sincronizada:", ahora_iso())
        return True

    except Exception as error:
        print("No se pudo sincronizar la hora:", error)
        return False


def hora_valida():
    """Solo considera valida la hora si NTP funciono en este arranque."""
    return _hora_sincronizada and time.gmtime()[0] >= 2024


def ahora_iso():
    """Devuelve la fecha UTC en formato ISO 8601."""
    if not hora_valida():
        return None

    t = time.gmtime()

    return "%04d-%02d-%02dT%02d:%02d:%02dZ" % (
        t[0], t[1], t[2], t[3], t[4], t[5]
    )


def _uuid4():
    """Genera un UUID v4 sin depender del modulo uuid."""
    b = bytearray(os.urandom(16))
    b[6] = (b[6] & 0x0F) | 0x40
    b[8] = (b[8] & 0x3F) | 0x80

    h = binascii.hexlify(b).decode()

    return "%s-%s-%s-%s-%s" % (
        h[0:8], h[8:12], h[12:16], h[16:20], h[20:32]
    )


def crear(tipo, datos=None):
    """Crea un evento solo si NTP se sincronizo correctamente."""
    fecha = ahora_iso()

    if fecha is None:
        raise RuntimeError(
            "No se puede crear un evento sin sincronizacion NTP."
        )

    return {
        "event_id": _uuid4(),
        "type": tipo,
        "at": fecha,
        "data": datos if datos is not None else {},
    }
