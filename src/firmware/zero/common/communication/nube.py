"""nube.py (ZERO) - Envio de eventos a la nube por HTTPS, en un hilo aparte.

Funciones:
    iniciar()            arranca el hilo de envio (si secretos.py esta completo)
    detener()            para el hilo
    habilitada()         True si hay INGESTA_URL y DEVICE_TOKEN
    encolar(evento)      guarda un evento para enviarlo (no bloquea)
    hay_conexion()       False tras varios envios seguidos fallidos
    leer_comandos()      ordenes que llegaron de la web (pendiente: Realtime)

Formato del envio (PROVISIONAL, validar con backend):
    POST INGESTA_URL     Authorization: Bearer DEVICE_TOKEN
    {"device_id": "...", "events": [{"event_id", "type", "at", "data"}, ...]}

El envio corre en un hilo, asi que una red lenta no frena el ciclo principal.
Si un envio falla, el lote se reintenta cada REINTENTO_ENVIO_S; mientras tanto
la cola guarda como maximo COLA_MAX eventos (los mas viejos se descartan).

PENDIENTE (no implementado, no probado):
  * Recibir comandos por Supabase Realtime (WSS). Mientras tanto
    leer_comandos() devuelve [] y las ordenes salen de demo.py.
"""
import queue
import threading

import requests

import config
import secretos

_URL = getattr(secretos, "INGESTA_URL", "")
_TOKEN = getattr(secretos, "DEVICE_TOKEN", "")

_cola = queue.Queue()
_parar = threading.Event()
_hilo = None
_estado = {"fallos": 0}


def habilitada():
    return bool(_URL and _TOKEN)


def encolar(evento):
    """Agrega un evento a la cola. Si se llena, descarta el mas viejo."""
    _cola.put(evento)
    while _cola.qsize() > config.COLA_MAX:
        try:
            _cola.get_nowait()
        except queue.Empty:
            break


def hay_conexion():
    """True mientras no haya varios envios seguidos fallidos (o si no hay nube)."""
    return _estado["fallos"] < config.ENVIOS_FALLIDOS_MAX


def _post(lote):
    respuesta = requests.post(
        _URL,
        json={"device_id": config.DEVICE_ID, "events": lote},
        headers={"Authorization": "Bearer " + _TOKEN},
        timeout=config.HTTP_TIMEOUT_S,
    )
    return 200 <= respuesta.status_code < 300


def _trabajador():
    pendiente = []                               # lote que fallo y se reintenta
    while not _parar.is_set():
        if not pendiente:
            try:
                pendiente.append(_cola.get(timeout=0.5))
            except queue.Empty:
                continue
            while len(pendiente) < 10:
                try:
                    pendiente.append(_cola.get_nowait())
                except queue.Empty:
                    break
        try:
            correcto = _post(pendiente)
        except requests.RequestException as error:
            print("Error enviando a la nube:", error)
            correcto = False

        if correcto:
            pendiente = []
            _estado["fallos"] = 0
        else:
            _estado["fallos"] += 1
            _parar.wait(config.REINTENTO_ENVIO_S)


def iniciar():
    global _hilo
    if not habilitada():
        print("Nube desactivada (falta INGESTA_URL / DEVICE_TOKEN en secretos.py)")
        return
    _parar.clear()
    _hilo = threading.Thread(target=_trabajador, name="nube", daemon=True)
    _hilo.start()


def detener():
    _parar.set()
    if _hilo is not None:
        _hilo.join(timeout=config.HTTP_TIMEOUT_S + 1)


def leer_comandos():
    """Ordenes pendientes de la web. PENDIENTE: Supabase Realtime."""
    return []
