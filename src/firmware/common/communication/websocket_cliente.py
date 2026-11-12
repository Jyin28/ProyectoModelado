"""websocket_cliente.py - Cliente WebSocket (RFC 6455) minimo sobre TLS.

Solo lo necesario para Supabase Realtime: apertura con validacion de
HTTP 101 y Sec-WebSocket-Accept, frames de cliente siempre enmascarados,
frames de texto, ping/pong, cierre, fragmentacion y limites de tamano.
Usa solo modulos estandar de MicroPython (binascii, hashlib, os, struct).

La logica de frames (codificar, Decodificador, validar_respuesta) no toca
la red y se prueba en una computadora (src/firmware/tests).
"""
import binascii
import hashlib
import os
import struct
import time

_GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

OP_CONT = 0
OP_TEXTO = 1
OP_BINARIO = 2
OP_CIERRE = 8
OP_PING = 9
OP_PONG = 10

MAX_PAYLOAD = 8192      # mensaje completo recibido (bytes)
MAX_ENVIO = 4096        # mensaje enviado por este cliente (bytes)
MAX_CABECERA = 2048     # respuesta HTTP del handshake (bytes)

# errno de "tiempo agotado / sin datos" en MicroPython (ETIMEDOUT, EAGAIN, ...)
_ERRNO_TIMEOUT = (110, 11, 116, 60, 10060)


class ErrorWebSocket(OSError):
    """Violacion del protocolo, cierre o fallo de la conexion."""


def es_timeout(error):
    return bool(error.args) and error.args[0] in _ERRNO_TIMEOUT


def clave_nueva():
    return binascii.b2a_base64(os.urandom(16)).strip()


def accept_esperado(clave):
    return binascii.b2a_base64(hashlib.sha1(clave + _GUID).digest()).strip()


def construir_solicitud(host, ruta, clave):
    texto = (
        "GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\n"
        "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ) % (ruta, host, clave.decode())
    return texto.encode()


def validar_respuesta(cabecera, clave):
    """Comprueba HTTP 101, Upgrade, Connection y Sec-WebSocket-Accept."""
    try:
        lineas = bytes(cabecera).decode().split("\r\n")
    except ValueError:
        raise ErrorWebSocket("handshake_invalido")
    estado = lineas[0].split(None, 2)
    if len(estado) < 2 or not estado[0].startswith("HTTP/1.") or estado[1] != "101":
        raise ErrorWebSocket("handshake_estado")
    campos = {}
    for linea in lineas[1:]:
        nombre, separador, valor = linea.partition(":")
        if separador:
            campos[nombre.strip().lower()] = valor.strip()
    if campos.get("upgrade", "").lower() != "websocket":
        raise ErrorWebSocket("handshake_upgrade")
    if "upgrade" not in campos.get("connection", "").lower():
        raise ErrorWebSocket("handshake_connection")
    if campos.get("sec-websocket-accept", "").encode() != accept_esperado(clave):
        raise ErrorWebSocket("handshake_accept")


def codificar(opcode, datos=b"", mascara=None):
    """Frame de cliente: FIN=1 y siempre enmascarado."""
    n = len(datos)
    if n > MAX_ENVIO or (opcode >= 8 and n > 125):
        raise ErrorWebSocket("envio_demasiado_grande")
    if mascara is None:
        mascara = os.urandom(4)
    marco = bytearray((0x80 | opcode,))
    if n < 126:
        marco.append(0x80 | n)
    else:
        marco.append(0x80 | 126)
        marco.extend(struct.pack(">H", n))
    marco.extend(mascara)
    cuerpo = bytearray(datos)
    for i in range(n):
        cuerpo[i] ^= mascara[i & 3]
    marco.extend(cuerpo)
    return bytes(marco)


class Decodificador:
    """Reensambla frames de servidor a partir de bytes parciales."""

    def __init__(self, maximo=MAX_PAYLOAD):
        self._buf = bytearray()
        self._max = maximo
        self._op = None
        self._frag = bytearray()

    def alimentar(self, datos):
        self._buf.extend(datos)

    def _marco(self):
        b = self._buf
        if len(b) < 2:
            return None
        if b[0] & 0x70:
            raise ErrorWebSocket("rsv_no_soportado")
        if b[1] & 0x80:
            raise ErrorWebSocket("servidor_enmascarado")
        fin = bool(b[0] & 0x80)
        op = b[0] & 0x0F
        if 3 <= op <= 7 or op > 10:
            raise ErrorWebSocket("opcode_invalido")
        n = b[1] & 0x7F
        cab = 2
        if n == 126:
            if len(b) < 4:
                return None
            n = struct.unpack(">H", bytes(b[2:4]))[0]
            cab = 4
        elif n == 127:
            if len(b) < 10:
                return None
            n = struct.unpack(">Q", bytes(b[2:10]))[0]
            cab = 10
        if n > self._max or (op >= 8 and (n > 125 or not fin)):
            raise ErrorWebSocket("frame_demasiado_grande")
        if len(b) < cab + n:
            return None
        datos = bytes(b[cab:cab + n])
        del b[:cab + n]
        return fin, op, datos

    def siguiente(self):
        """(opcode, payload) de un mensaje completo, o None si falta."""
        while True:
            marco = self._marco()
            if marco is None:
                return None
            fin, op, datos = marco
            if op >= 8:
                return op, datos
            if op == OP_CONT:
                if self._op is None:
                    raise ErrorWebSocket("continuacion_sin_inicio")
                self._frag.extend(datos)
            else:
                if self._op is not None:
                    raise ErrorWebSocket("fragmento_sin_terminar")
                self._op = op
                self._frag = bytearray(datos)
            if len(self._frag) > self._max:
                raise ErrorWebSocket("mensaje_demasiado_grande")
            if fin:
                completo = (self._op, bytes(self._frag))
                self._op = None
                self._frag = bytearray()
                return completo


def conectar_tls(host, contexto, timeout_s):
    """Abre TCP + TLS validando certificado y nombre. Devuelve (tls, tcp)."""
    import socket

    direcciones = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
    if not direcciones:
        raise OSError("Servidor sin direccion IPv4")
    direccion = direcciones[0]
    tcp = socket.socket(*direccion[:3])
    tls = tcp
    try:
        tcp.settimeout(timeout_s)
        tcp.connect(direccion[-1])
        tls = contexto.wrap_socket(tcp, server_hostname=host)
    except BaseException:
        tls.close()
        raise
    return tls, tcp


def leer(flujo, n):
    """Bytes leidos; None si no hay datos aun; ErrorWebSocket si se cerro."""
    try:
        datos = flujo.read(n)
    except OSError as error:
        if es_timeout(error):
            return None
        raise
    if datos is None:
        return None
    if not datos:
        raise ErrorWebSocket("conexion_cerrada")
    return datos


def escribir(flujo, datos):
    vista = memoryview(datos)
    while vista:
        escritos = flujo.write(vista)
        if not escritos:
            raise ErrorWebSocket("envio_interrumpido")
        vista = vista[escritos:]


class Conexion:
    def __init__(self, tls, tcp, lectura_s):
        self._tls = tls
        self._tcp = tcp
        self._lectura_s = lectura_s
        self._dec = Decodificador()
        self.cerrada = False

    @classmethod
    def abrir(cls, host, ruta, contexto, conexion_s=4, handshake_s=6, lectura_s=0.2):
        """GET Upgrade; valida 101 y Sec-WebSocket-Accept."""
        tls, tcp = conectar_tls(host, contexto, conexion_s)
        try:
            clave = clave_nueva()
            escribir(tls, construir_solicitud(host, ruta, clave))
            limite = time.ticks_add(time.ticks_ms(), int(handshake_s * 1000))
            recibido = bytearray()
            while True:
                fin = recibido.find(b"\r\n\r\n")
                if fin >= 0:
                    break
                if len(recibido) > MAX_CABECERA or time.ticks_diff(limite, time.ticks_ms()) <= 0:
                    raise ErrorWebSocket("handshake_tiempo")
                datos = leer(tls, 512)
                if datos is not None:
                    recibido.extend(datos)
            validar_respuesta(recibido[:fin], clave)
            objeto = cls(tls, tcp, lectura_s)
            objeto._dec.alimentar(recibido[fin + 4:])
            tcp.settimeout(lectura_s)
            return objeto
        except BaseException:
            tls.close()
            raise

    def enviar(self, opcode, datos=b""):
        escribir(self._tls, codificar(opcode, datos))

    def enviar_texto(self, texto):
        self.enviar(OP_TEXTO, texto.encode())

    def recibir(self):
        """Mensaje de texto/binario (opcode, datos) o None si no hay completo.

        Responde ping con pong. Un cierre remoto lanza ErrorWebSocket.
        """
        for _ in range(8):
            mensaje = self._dec.siguiente()
            if mensaje is None:
                datos = leer(self._tls, 1024)
                if datos is None:
                    return None
                self._dec.alimentar(datos)
                continue
            op, datos = mensaje
            if op == OP_PING:
                self.enviar(OP_PONG, datos)
            elif op == OP_CIERRE:
                self.cerrada = True
                try:
                    self.enviar(OP_CIERRE, datos[:2])
                except OSError:
                    pass
                raise ErrorWebSocket("cierre_remoto")
            elif op != OP_PONG:
                return mensaje
        return None

    def cerrar(self):
        if not self.cerrada:
            self.cerrada = True
            try:
                self.enviar(OP_CIERRE, b"\x03\xe8")
            except (OSError, ValueError):
                pass
        try:
            self._tls.close()
        except OSError:
            pass
