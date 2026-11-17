"""eventos.py (ZERO) - Creacion de eventos con identificador unico.

Funciones:
    ahora_iso()          "2026-11-16T20:30:00Z" (UTC)
    crear(tipo, datos)   devuelve un evento {"event_id", "type", "at", "data"}

Todo evento tiene un event_id unico (UUID): asi el backend puede descartar
duplicados si un envio se reintenta. La hora se guarda en UTC (la web la
muestra en America/Costa_Rica). El reloj de la Zero lo mantiene el sistema (NTP).
"""
import uuid
from datetime import datetime, timezone


def ahora_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def crear(tipo, datos=None):
    return {
        "event_id": str(uuid.uuid4()),
        "type": tipo,
        "at": ahora_iso(),
        "data": datos if datos is not None else {},
    }
