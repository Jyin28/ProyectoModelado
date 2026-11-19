"""Publica lecturas ambientales sin esperar por la red en el ciclo principal."""

import _thread
import binascii
import json
import math
import os
import socket
import ssl
import time

import cola_eventos
import config
import modulo
import rutas
import secrets
import wifi

_RUTA_INGESTA = "/functions/v1/ingesta"
_CA = "/common/communication/gts-root-r4.der"
# Independientes de la cadencia de lectura (config.INTERVALO_AMBIENTE_S): un POST
# TLS tarda segundos, asi que una lectura sigue siendo enviable 10 s despues de
# medirse, y la hora NTP no se reintenta cada vez que se lee el sensor.
_VIGENCIA_ENVIO_MS = 10000
_REINTENTO_NTP_MS = 10000
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
    def __init__(self, host, dispositivo, token, contexto, ntp, remota=None, movimiento=None,
                 habitacion=None, alimentacion=None):
        # host=None: no hay envio a Ingesta; solo trabaja la lampara remota.
        # dispositivo/token=None: ambiente deshabilitado (puede seguir movimiento).
        self._host = host
        self._dispositivo = dispositivo
        self._token = token
        self._contexto = contexto
        self._ntp = ntp
        self._remota = remota
        # (device_id, token) del modulo de movimiento, o None si esta deshabilitado.
        self._movimiento = movimiento
        # (device_id, token) de la habitacion, o None. Sus eventos esperan en una cola
        # acotada y se reintentan con el mismo event_id.
        self._habitacion = habitacion
        # (device_id, token) de la alimentacion, o None. Pesos y temperatura del biberon.
        self._alimentacion = alimentacion
        # Una cola por modulo con eventos: nombre -> (nombre para consola, credencial, cola).
        self._cargas = {}
        for clave, rotulo, credencial in (("habitacion", "Habitacion", habitacion),
                                          ("alimentacion", "Alimentacion", alimentacion)):
            if credencial is not None:
                self._cargas[clave] = (rotulo, credencial, cola_eventos.ColaEventos(_uuid4))
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
            evento = {
                "event_id": _uuid4(),
                "device_id": self._movimiento[0],
                "tipo": "movimiento",
                "ts": "%04d-%02d-%02dT%02d:%02d:%02dZ" % utc[:6],
                "datos": {},
            }
            self._pendiente_movimiento = (json.dumps(evento).encode(), detectado_ms)

    def registrar_evento_modulo(self, clave, tipo, datos, ocurrido_ms):
        """Encola un evento de un modulo con cola (habitacion o alimentacion). No exige
        hora ni WiFi ahora: la hora UTC se calcula al enviar, restando lo que paso
        desde que ocurrio."""
        if self._host is None or clave not in self._cargas:
            return
        with self._lock:
            if self._activo:
                self._cargas[clave][2].agregar(tipo, datos, ocurrido_ms)

    def registrar_evento_habitacion(self, tipo, datos, ocurrido_ms):
        """Evento de la habitacion (puerta o movimiento_habitacion)."""
        self.registrar_evento_modulo("habitacion", tipo, datos, ocurrido_ms)

    def registrar_evento_alimentacion(self, tipo, datos, ocurrido_ms):
        """Evento de la alimentacion (peso_alimentacion, peso_alimentacion_fallido
        o temperatura_biberon)."""
        self.registrar_evento_modulo("alimentacion", tipo, datos, ocurrido_ms)

    def registrar(self, temperatura, humedad, medido_ms):
        if self._dispositivo is None or not math.isfinite(temperatura) or not 0 <= humedad <= 100:
            return
        with self._lock:
            if not self._reloj_listo:
                return
            utc = time.gmtime()
            evento = {
                "event_id": _uuid4(),
                "device_id": self._dispositivo,
                "tipo": "ambiente",
                "ts": "%04d-%02d-%02dT%02d:%02d:%02dZ" % utc[:6],
                "datos": {"temperatura_c": temperatura, "humedad_pct": humedad},
            }
            self._pendiente = (json.dumps(evento).encode(), medido_ms)

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
            for carga in self._cargas.values():
                carga[2].vaciar()
        if self._remota is not None:
            self._remota.detener()

    def _enviar(self, cuerpo, medido_ms, token=None, nombre="Ambiente"):
        token = token or self._token
        for intento in range(2):
            restante_ms = _VIGENCIA_ENVIO_MS - time.ticks_diff(time.ticks_ms(), medido_ms)
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

    def _enviar_eventos(self, clave):
        """Envia en orden los eventos de un modulo con cola. Un fallo transitorio
        detiene el turno y se reintenta mas tarde con el mismo event_id."""
        rotulo, (device_id, token), cola = self._cargas[clave]
        ahora = time.ticks_ms()
        with self._lock:
            lista = cola.pendientes(ahora)
        for evento, edad_s in lista:
            if not self._activo or not wifi.esta_conectado():
                return
            utc = time.gmtime(time.time() - edad_s)
            cuerpo = json.dumps({
                "event_id": evento["event_id"],
                "device_id": device_id,
                "tipo": evento["tipo"],
                "ts": "%04d-%02d-%02dT%02d:%02d:%02dZ" % utc[:6],
                "datos": evento["datos"],
            }).encode()
            try:
                estado = _post(self._host, token, self._contexto, cuerpo, _TIMEOUT_HTTPS_S)
            except (OSError, ValueError, MemoryError) as error:
                print("%s: fallo HTTPS (%s)" % (rotulo, type(error).__name__))
                estado = None
            print("%s: HTTP %s" % (rotulo, estado))
            with self._lock:
                if estado is None or estado == 503:
                    cola.reintentar(evento, time.ticks_ms())
                    return
                # 2xx y 409 (ya recibido) terminan; cualquier otro rechazo no se
                # reintenta: el mismo evento volveria a rechazarse.
                cola.terminado(evento)

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
                    if ultimo_ntp is None or time.ticks_diff(ahora, ultimo_ntp) >= _REINTENTO_NTP_MS:
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
                elif self._remota is None or not self._remota.ocupado():
                    # Con una orden remota en curso (plazo de 15 s) no se gastan segundos
                    # en POST de lecturas: se conservan y salen cuando la orden termina
                    # (una lectura vieja se descarta por su vigencia).
                    with self._lock:
                        pendiente = self._pendiente
                        self._pendiente = None
                        movimiento = self._pendiente_movimiento
                        self._pendiente_movimiento = None
                    if pendiente is not None:
                        self._enviar(*pendiente)
                    if movimiento is not None:
                        self._enviar(*movimiento, token=self._movimiento[1], nombre="Movimiento")
                    for clave in self._cargas:
                        self._enviar_eventos(clave)
                if self._remota is not None:
                    # Polling cooperativo de la lampara remota en este mismo hilo
                    self._remota.paso(self._reloj_listo and wifi.esta_conectado())
                time.sleep_ms(100)
        finally:
            self.detener()
            if self._remota is not None:
                self._remota.cerrar_red()


def _credencial_movimiento():
    """(device_id, token) del PIR, o None si el monitoreo esta deshabilitado
    o la configuracion es invalida."""
    if not (config.MONITOREO_MOVIMIENTO_HABILITADO and modulo.usa("movimiento")):
        return None                 # el PIR solo existe en el modulo cuna
    dispositivo = getattr(secrets, "MOVIMIENTO_DEVICE_ID", "")
    token = getattr(secrets, "MOVIMIENTO_TOKEN", "")
    if (len(dispositivo) != 18 or not dispositivo.startswith("cuna-movimiento-")
            or not dispositivo[16:].isdigit()):
        print("Movimiento: device_id invalido; monitoreo desactivado")
        return None
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        print("Movimiento: credencial invalida; monitoreo desactivado")
        return None
    print("Movimiento: monitoreo habilitado localmente")
    return (dispositivo, token)


def _credencial_habitacion():
    """(device_id, token) de la habitacion, o None si no aplica."""
    if not (config.HABITACION_HABILITADO and modulo.usa("habitacion")):
        return None
    dispositivo = getattr(secrets, "HABITACION_DEVICE_ID", "")
    token = getattr(secrets, "HABITACION_TOKEN", "")
    if (len(dispositivo) != 18 or not dispositivo.startswith("cuna-habitacion-")
            or not dispositivo[16:].isdigit()):
        print("Habitacion: device_id invalido; no se informa a Supabase")
        return None
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        print("Habitacion: credencial invalida; no se informa a Supabase")
        return None
    return (dispositivo, token)


def _credencial_alimentacion():
    """(device_id, token) de la alimentacion, o None si no aplica."""
    if not (config.ALIMENTACION_HABILITADO and modulo.usa("alimentacion")):
        return None
    dispositivo = getattr(secrets, "ALIMENTACION_DEVICE_ID", "")
    token = getattr(secrets, "ALIMENTACION_TOKEN", "")
    if (len(dispositivo) != 20 or not dispositivo.startswith("cuna-alimentacion-")
            or not dispositivo[18:].isdigit()):
        print("Alimentacion: device_id invalido; no se informa a Supabase")
        return None
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        print("Alimentacion: credencial invalida; no se informa a Supabase")
        return None
    return (dispositivo, token)


def _leer_host():
    """Servidor de Ingesta (compartido por ambiente y movimiento), o None."""
    url = getattr(secrets, "AMBIENTE_URL", "")
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


def _credencial_ambiente():
    """(dispositivo, token) del envio de ambiente, o None si no esta listo."""
    dispositivo = getattr(secrets, "AMBIENTE_DEVICE_ID", "")
    token = getattr(secrets, "AMBIENTE_TOKEN", "")
    if not dispositivo or not token:
        print("Ambiente: envio desactivado; falta la configuracion de Supabase")
        return None
    if len(token) != 64 or any(c not in "0123456789abcdefABCDEF" for c in token):
        print("Ambiente: formato de credencial invalido")
        return None
    return dispositivo, token


def iniciar(remota=None):
    """Inicia el unico worker de red.

    Atiende, como cargas separadas, el envio de ambiente, el de movimiento
    (PIR) y los eventos de la habitacion y de la alimentacion, y si se pasa, la lampara remota. Si no hay ni ambiente ni
    movimiento configurados pero si lampara remota, el worker corre solo para
    ella (host=None).
    """
    host = _leer_host()
    ambiente = _credencial_ambiente() if host is not None else None
    movimiento = _credencial_movimiento() if host is not None else None
    habitacion = _credencial_habitacion() if host is not None else None
    alimentacion = _credencial_alimentacion() if host is not None else None
    if (ambiente is None and movimiento is None and habitacion is None
            and alimentacion is None):
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
        # bytes del certificado DER van en cadata. Con los bytes en cafile,
        # MicroPython los trata como un nombre de archivo y falla con ENOENT.
        contexto.load_verify_locations(cadata=datos_ca)
        if remota is not None:
            remota.contexto = contexto
        envio = EnvioAmbiente(host, dispositivo, token, contexto, ntptime, remota, movimiento,
                              habitacion, alimentacion)
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
