"""Publica lecturas ambientales en Supabase sin esperar por la red en el ciclo principal.

Usa la misma configuracion que la Pico del colchon (secrets.py): INGESTA_URL y
DEVICE_TOKEN, con el mismo formato de lote que la Edge Function `ingesta`:
    {"device_id": ..., "events": [{"event_id", "type": "ambiente", "at", "data"}]}
El PIR se envia aparte, como su propio modulo (MOVIMIENTO_DEVICE_ID y
MOVIMIENTO_TOKEN): un lote con un solo evento {"type": "movimiento", "data": {}}.
"""

import _thread
import binascii
import json
import math
import os
import socket
import ssl
import time

import config
import rutas
import secrets
import wifi

_RUTA_INGESTA = "/functions/v1/ingesta"
_CA = "/common/communication/gts-root-r4.der"
_INTERVALO_MS = config.INTERVALO_AMBIENTE_S * 1000
_TIMEOUT_HTTPS_S = 3


def _uuid4():
    aleatorio = bytearray(os.urandom(16))
    aleatorio[6] = (aleatorio[6] & 0x0f) | 0x40
    aleatorio[8] = (aleatorio[8] & 0x3f) | 0x80
    hex_id = binascii.hexlify(aleatorio).decode()
    return "-".join((hex_id[:8], hex_id[8:12], hex_id[12:16], hex_id[16:20], hex_id[20:]))


def _post(host, autorizacion, contexto, cuerpo, timeout):
    direcciones = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
    if not direcciones:
        raise OSError("Servidor sin direccion IPv4")
    direccion = direcciones[0]
    tcp = socket.socket(*direccion[:3])
    conexion = tcp
    try:
        tcp.settimeout(timeout)
        tcp.connect(direccion[-1])
        conexion = contexto.wrap_socket(tcp, server_hostname=host)
        cabecera = (
            "POST " + _RUTA_INGESTA + " HTTP/1.1\r\n"
            "Host: %s\r\nAuthorization: Bearer %s\r\n"
            "Content-Type: application/json\r\nContent-Length: %d\r\n"
            "Connection: close\r\n\r\n"
        ) % (host, autorizacion, len(cuerpo))
        solicitud = memoryview(cabecera.encode() + cuerpo)
        while solicitud:
            escritos = conexion.write(solicitud)
            if not escritos:
                raise OSError("Envio HTTPS interrumpido")
            solicitud = solicitud[escritos:]

        estado = conexion.readline(128).split(None, 2)
        if len(estado) < 2 or not estado[0].startswith(b"HTTP/1.") or not estado[1].isdigit():
            raise OSError("Respuesta HTTP invalida")
        return int(estado[1])
    finally:
        conexion.close()


class EnvioAmbiente:
    def __init__(self, host, dispositivo, token, contexto, ntp, remota=None, movimiento=None):
        # host=None: no hay envio a Ingesta; solo trabaja la lampara remota.
        # dispositivo/token=None: ambiente deshabilitado (puede seguir movimiento).
        # movimiento: (device_id, token) del PIR, o None si esta deshabilitado.
        self._host = host
        self._dispositivo = dispositivo
        self._token = token
        self._contexto = contexto
        self._ntp = ntp
        self._remota = remota
        self._movimiento = movimiento
        self._lock = _thread.allocate_lock()
        self._activo = True
        self._wifi_conectado = False
        self._reloj_listo = False
        self._pendiente = None
        self._pendiente_movimiento = None   # como maximo un evento PIR en RAM

    def registrar_movimiento(self, detectado_ms):
        """Guarda el flanco ascendente del PIR. Sin hora confiable o con un
        evento ya pendiente, lo omite: nunca se acumulan eventos."""
        if self._movimiento is None or self._host is None:
            return
        with self._lock:
            if not self._reloj_listo or self._pendiente_movimiento is not None:
                return
            utc = time.gmtime()
            lote = {
                "device_id": self._movimiento[0],
                "events": [{
                    "event_id": _uuid4(),
                    "type": "movimiento",
                    "at": "%04d-%02d-%02dT%02d:%02d:%02dZ" % utc[:6],
                    "data": {},
                }],
            }
            self._pendiente_movimiento = (json.dumps(lote).encode(), detectado_ms)

    def registrar(self, temperatura, humedad, medido_ms):
        if self._dispositivo is None or not math.isfinite(temperatura) or not 0 <= humedad <= 100:
            return
        with self._lock:
            if not self._reloj_listo:
                return
            utc = time.gmtime()
            lote = {
                "device_id": self._dispositivo,
                "events": [{
                    "event_id": _uuid4(),
                    "type": "ambiente",
                    "at": "%04d-%02d-%02dT%02d:%02d:%02dZ" % utc[:6],
                    "data": {"temperatura_c": temperatura, "humedad_pct": humedad},
                }],
            }
            self._pendiente = (json.dumps(lote).encode(), medido_ms)

    def esta_conectado(self):
        with self._lock:
            return self._wifi_conectado

    def detener(self):
        with self._lock:
            self._activo = False
            self._wifi_conectado = False
            self._reloj_listo = False
            self._pendiente = None
            self._pendiente_movimiento = None
        if self._remota is not None:
            self._remota.detener()

    def _enviar(self, cuerpo, medido_ms, token=None, nombre="Ambiente"):
        token = token or self._token
        for intento in range(2):
            restante_ms = _INTERVALO_MS - time.ticks_diff(time.ticks_ms(), medido_ms)
            if not self._activo or restante_ms <= 0 or not wifi.esta_conectado():
                return
            try:
                estado = _post(
                    self._host, token, self._contexto, cuerpo,
                    min(_TIMEOUT_HTTPS_S, restante_ms / 1000),
                )
            except (OSError, ValueError, MemoryError) as error:
                print("%s: fallo HTTPS (%s)" % (nombre, type(error).__name__))
                return
            print("%s: HTTP %d" % (nombre, estado))
            if estado != 503:
                return
            if intento == 0:
                time.sleep_ms(250)

    def ejecutar(self):
        ultima_revision = time.ticks_add(time.ticks_ms(), -config.REVISAR_WIFI_CADA_S * 1000)
        ultimo_ntp = None
        try:
            while self._activo:
                ahora = time.ticks_ms()
                conectado = wifi.esta_conectado()
                with self._lock:
                    self._wifi_conectado = self._activo and conectado
                if not conectado:
                    with self._lock:
                        self._reloj_listo = False
                        self._pendiente = None
                        self._pendiente_movimiento = None
                    ultimo_ntp = None
                    if time.ticks_diff(ahora, ultima_revision) >= config.REVISAR_WIFI_CADA_S * 1000:
                        try:
                            wifi.asegurar_conexion()
                        except OSError:
                            print("Ambiente: no se pudo reconectar al WiFi")
                        ultima_revision = time.ticks_ms()
                elif not self._reloj_listo:
                    if ultimo_ntp is None or time.ticks_diff(ahora, ultimo_ntp) >= _INTERVALO_MS:
                        try:
                            self._ntp.settime()
                        except (OSError, ValueError, OverflowError):
                            print("Ambiente: hora pendiente de sincronizar")
                        else:
                            conectado = wifi.esta_conectado()
                            with self._lock:
                                self._reloj_listo = self._activo and conectado
                            if self._reloj_listo:
                                print("Ambiente: hora UTC sincronizada")
                        ultimo_ntp = time.ticks_ms()
                else:
                    with self._lock:
                        pendiente = self._pendiente
                        self._pendiente = None
                        movimiento = self._pendiente_movimiento
                        self._pendiente_movimiento = None
                    if pendiente is not None:
                        self._enviar(*pendiente)
                    if movimiento is not None:
                        self._enviar(*movimiento, token=self._movimiento[1], nombre="Movimiento")
                if self._remota is not None:
                    # Polling cooperativo de la lampara remota en este mismo hilo
                    self._remota.paso(self._reloj_listo and wifi.esta_conectado())
                time.sleep_ms(100)
        finally:
            self.detener()
            if self._remota is not None:
                self._remota.cerrar_red()


def _leer_host():
    """Servidor de Ingesta (de INGESTA_URL en secrets.py), o None."""
    url = getattr(secrets, "INGESTA_URL", "")
    if not url:
        print("Ambiente: envio desactivado; falta la configuracion de Supabase")
        return None
    if not url.startswith("https://") or not url.endswith(_RUTA_INGESTA):
        print("Ambiente: URL de Ingesta invalida")
        return None
    host = url[8:-len(_RUTA_INGESTA)]
    if not host or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789.-" for c in host):
        print("Ambiente: servidor de Ingesta invalido")
        return None
    return host


def _credencial_movimiento():
    """(device_id, token) del PIR, o None si el monitoreo esta deshabilitado
    o la configuracion es invalida."""
    if not config.MONITOREO_MOVIMIENTO_HABILITADO:
        return None
    dispositivo = getattr(secrets, "MOVIMIENTO_DEVICE_ID", "")
    token = getattr(secrets, "MOVIMIENTO_TOKEN", "")
    if (len(dispositivo) != 18 or not dispositivo.startswith("cuna-movimiento-")
            or not dispositivo[16:].isdigit()):
        print("Movimiento: MOVIMIENTO_DEVICE_ID invalido (cuna-movimiento-NN); no se envia")
        return None
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        print("Movimiento: MOVIMIENTO_TOKEN invalido (64 caracteres hex); no se envia")
        return None
    print("Movimiento: envio a Supabase habilitado")
    return (dispositivo, token)


def _credencial_ambiente():
    """(device_id, token) para la Ingesta, o None si no esta listo."""
    dispositivo = config.DEVICE_ID
    token = getattr(secrets, "DEVICE_TOKEN", "")
    if not dispositivo or not token:
        print("Ambiente: envio desactivado; falta DEVICE_TOKEN en secrets.py")
        return None
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        print("Ambiente: formato de DEVICE_TOKEN invalido (64 caracteres hex)")
        return None
    return dispositivo, token


def iniciar(remota=None):
    """Inicia el unico worker de red.

    Envia a Supabase las lecturas de ambiente y los eventos del PIR (cargas
    separadas, cada una con su credencial) y, si se pasa, atiende la lampara
    remota. Sin credenciales de Ingesta pero con lampara remota, el worker corre
    solo para ella (host=None).
    """
    host = _leer_host()
    ambiente = _credencial_ambiente() if host is not None else None
    movimiento = _credencial_movimiento() if host is not None else None
    if ambiente is None and movimiento is None:
        host = None                 # sin cargas de Ingesta no se usa el host
    if host is None and remota is None:
        return None
    dispositivo, token = ambiente or (None, None)

    try:
        import ntptime

        ntptime.timeout = 2
        contexto = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        contexto.verify_mode = ssl.CERT_REQUIRED
        ruta_ca = rutas.buscar(_CA)
        try:
            with open(ruta_ca, "rb") as certificado:
                datos_ca = certificado.read()
        except OSError:
            print("Ambiente: no se pudo leer el certificado %s" % ruta_ca)
            raise
        # El primer parametro de load_verify_locations es cafile (una RUTA); los
        # bytes del certificado DER van en cadata.
        contexto.load_verify_locations(cadata=datos_ca)
        if remota is not None:
            remota.contexto = contexto
        envio = EnvioAmbiente(host, dispositivo, token, contexto, ntptime, remota, movimiento)
        # La lampara remota agrega TLS, JSON y WebSocket: pila mayor (pendiente de medir en hardware)
        pila_anterior = _thread.stack_size((16 if remota is not None else 12) * 1024)
        try:
            _thread.start_new_thread(envio.ejecutar, ())
        finally:
            _thread.stack_size(pila_anterior)
    except (ImportError, AttributeError, OSError, ValueError, MemoryError, RuntimeError) as error:
        print("Ambiente: no se pudo iniciar el envio (%s: %s)" % (type(error).__name__, error))
        return None
    return envio
