"""lampara_remota.py - Orden remota de la lampara (Supabase Auth + Realtime + RPC).

Flujo (contrato: src/shared/contracts/lampara.md):
  1. Cuenta Auth exclusiva del dispositivo -> JWT (se renueva antes de vencer).
  2. WSS a Supabase Realtime (protocolo 1.0.0), phx_join al canal privado
     "realtime:lampara:<id>" y heartbeat cada 20 s.
  3. Al confirmarse la suscripcion y ante cada broadcast "orden_disponible"
     (solo un aviso) llama al RPC tomar_orden_lampara.
  4. La orden pasa por un buzon de un solo lugar al hilo principal, que
     comprueba su vigencia y la ejecuta con comandos.ejecutar.
  5. El worker confirma con el RPC confirmar_orden_lampara.

Reparto de hilos: paso() corre en el unico worker de red (ambiente.py) y
nunca ocupa otro hilo; actualizar() corre en el ciclo principal y es el unico
que toca el actuador. Al perder la conexion se descartan las ordenes
pendientes y la lampara se apaga. Nunca se imprimen credenciales, tokens ni
respuestas del servidor.

Sin variables LAMPARA_* en secrets.py el cliente queda apagado.
"""
import json
import os
import _thread
import time

import websocket_cliente as ws

_ID_CANAL = "lampara"
_HEARTBEAT_MS = 20000
_ESPERA_HEARTBEAT_MS = 10000
_ESPERA_JOIN_MS = 10000
_TIMEOUT_HTTPS_S = 3
_MAX_RESPUESTA = 12288
_ESPERA_RESPUESTA_MS = 6000
_BACKOFF_MS = (2000, 4000, 8000, 16000, 32000, 60000)
_BACKOFF_GRAVE_MS = 60000
_MARGEN_VIGENCIA_MS = 1000       # no se ejecuta con menos de 1 s de vigencia
_VIGENCIA_MAX_MS = 120000        # una vigencia mayor delata un reloj mal puesto
_ANIO_MINIMO = 2024              # hora anterior = NTP no sincronizado
_INTENTOS_CONFIRMAR = 3
_INTENTOS_TOMAR = 3

_ALFANUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_CARACTERES_CLAVE = _ALFANUM + "_.-"
_CARACTERES_ERROR = "abcdefghijklmnopqrstuvwxyz0123456789_:-"

_DESCONECTADO = 0
_UNIENDO = 1
_ACTIVO = 2


class ErrorLampara(Exception):
    def __init__(self, motivo, grave=False):
        Exception.__init__(self, motivo)
        self.motivo = motivo
        self.grave = grave


# ---------------------------------------------------------------------------
# Logica pura (sin red ni hardware): se prueba en una computadora
# ---------------------------------------------------------------------------

def _solo(texto, permitidos):
    return isinstance(texto, str) and bool(texto) and all(c in permitidos for c in texto)


def host_de_url(url):
    """'https://<host>' (sin ruta) -> host; None si no es valido."""
    if not isinstance(url, str) or not url.startswith("https://"):
        return None
    host = url[8:].rstrip("/")
    if not host or len(host) > 100 or not _solo(host, "abcdefghijklmnopqrstuvwxyz0123456789.-"):
        return None
    return host


def id_valido(device_id):
    """cuna-lampara-NN"""
    return (isinstance(device_id, str) and len(device_id) == 15
            and device_id.startswith("cuna-lampara-") and device_id[13:].isdigit())


def uuid_valido(texto):
    if not isinstance(texto, str) or len(texto) != 36:
        return False
    for i, c in enumerate(texto):
        if i in (8, 13, 18, 23):
            if c != "-":
                return False
        elif c not in "0123456789abcdefABCDEF":
            return False
    return True


def nivel_valido(valor):
    """Entero 0..100 (acepta 40.0 por si numeric conserva la escala)."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, float):
        if valor != valor or valor != int(valor):
            return None
        valor = int(valor)
    if not isinstance(valor, int) or valor < 0 or valor > 100:
        return None
    return valor


def normalizar_error(texto):
    if not isinstance(texto, str):
        return "error"
    limpio = "".join(c for c in texto.lower() if c in _CARACTERES_ERROR)[:80]
    return limpio or "error"


def _dias_civil(a, m, d):
    if m <= 2:
        a -= 1
    era = a // 400
    aa = a - era * 400
    doy = (153 * ((m + 9) % 12) + 2) // 5 + d - 1
    return era * 146097 + aa * 365 + aa // 4 - aa // 100 + doy - 719468


def segundos_utc(tupla):
    """Segundos desde 1970 de (a, m, d, h, mi, s, ...) en UTC."""
    return _dias_civil(tupla[0], tupla[1], tupla[2]) * 86400 + tupla[3] * 3600 + tupla[4] * 60 + tupla[5]


def analizar_rfc3339(texto):
    """Milisegundos UTC desde 1970 de 'AAAA-MM-DDTHH:MM:SS[.f](Z|+00:00)'. None si no valido."""
    if not isinstance(texto, str) or len(texto) < 20 or len(texto) > 40:
        return None
    if (texto[4] != "-" or texto[7] != "-" or texto[10] not in "Tt"
            or texto[13] != ":" or texto[16] != ":"):
        return None
    campos = (texto[0:4], texto[5:7], texto[8:10], texto[11:13], texto[14:16], texto[17:19])
    if not all(c.isdigit() for c in campos):
        return None
    a, m, d, h, mi, s = [int(c) for c in campos]
    if not (1 <= m <= 12 and 1 <= d <= 31 and h <= 23 and mi <= 59 and s <= 59):
        return None
    resto = texto[19:]
    ms = 0
    if resto.startswith("."):
        i = 1
        while i < len(resto) and resto[i].isdigit():
            i += 1
        if i == 1:
            return None
        ms = int((resto[1:i] + "000")[:3])
        resto = resto[i:]
    if resto not in ("Z", "z", "+00:00", "-00:00"):
        return None
    return segundos_utc((a, m, d, h, mi, s)) * 1000 + ms


def vigente(vence_ms, ahora):
    """True si falta mas del margen para vence_ms y el reloj es plausible."""
    if vence_ms is None or ahora[0] < _ANIO_MINIMO:
        return False
    restante = vence_ms - segundos_utc(ahora) * 1000
    return _MARGEN_VIGENCIA_MS < restante <= _VIGENCIA_MAX_MS


def validar_orden(obj):
    """Orden devuelta por tomar_orden_lampara.

    None si no es utilizable (sin command_id valido no hay como confirmar).
    Si es valida devuelve dict(command_id, vence_ms, level); level es None
    cuando el comando no es lamp_set o el nivel no es entero 0..100.
    """
    if not isinstance(obj, dict) or not uuid_valido(obj.get("command_id")):
        return None
    vence = analizar_rfc3339(obj.get("vence_en"))
    if vence is None:
        return None
    nivel = None
    params = obj.get("params")
    if obj.get("command") == "lamp_set" and isinstance(params, dict):
        nivel = nivel_valido(params.get("level"))
    return {"command_id": obj["command_id"], "vence_ms": vence, "level": nivel}


def analizar_respuesta(datos, final=False):
    """Respuesta HTTP/1.x -> (estado, cuerpo) o None si esta incompleta.

    Entiende Content-Length y Transfer-Encoding: chunked.
    """
    fin = datos.find(b"\r\n\r\n")
    if fin < 0:
        if final:
            raise ValueError("http_incompleto")
        return None
    lineas = bytes(datos[:fin]).split(b"\r\n")
    estado = lineas[0].split(None, 2)
    if len(estado) < 2 or not estado[0].startswith(b"HTTP/1.") or not estado[1].isdigit():
        raise ValueError("http_invalido")
    campos = {}
    for linea in lineas[1:]:
        nombre, separador, valor = linea.partition(b":")
        if separador:
            campos[nombre.strip().lower()] = valor.strip().lower()
    codigo = int(estado[1])
    cuerpo = bytes(datos[fin + 4:])
    if campos.get(b"transfer-encoding") == b"chunked":
        salida = bytearray()
        pos = 0
        while True:
            fila = cuerpo.find(b"\r\n", pos)
            if fila < 0:
                break
            try:
                tam = int(cuerpo[pos:fila].split(b";")[0], 16)
            except ValueError:
                raise ValueError("http_chunk_invalido")
            if tam == 0:
                return codigo, bytes(salida)
            if len(cuerpo) < fila + 2 + tam + 2:
                break
            salida.extend(cuerpo[fila + 2:fila + 2 + tam])
            pos = fila + 2 + tam + 2
        if final:
            raise ValueError("http_incompleto")
        return None
    if b"content-length" in campos:
        largo = campos[b"content-length"]
        if not largo.isdigit():
            raise ValueError("http_invalido")
        if len(cuerpo) >= int(largo):
            return codigo, cuerpo[:int(largo)]
        if final:
            raise ValueError("http_incompleto")
        return None
    return (codigo, cuerpo) if final else None


def _http(host, contexto, ruta, cabeceras, cuerpo):
    """POST HTTPS con limite de tamano y plazo. Devuelve (estado, bytes)."""
    lineas = "POST %s HTTP/1.1\r\nHost: %s\r\n" % (ruta, host)
    for nombre in cabeceras:
        lineas += "%s: %s\r\n" % (nombre, cabeceras[nombre])
    lineas += "Content-Type: application/json\r\nAccept: application/json\r\n"
    lineas += "Content-Length: %d\r\nConnection: close\r\n\r\n" % len(cuerpo)
    tls, _ = ws.conectar_tls(host, contexto, _TIMEOUT_HTTPS_S)
    try:
        ws.escribir(tls, lineas.encode() + cuerpo)
        limite = time.ticks_add(time.ticks_ms(), _ESPERA_RESPUESTA_MS)
        recibido = bytearray()
        while True:
            if time.ticks_diff(limite, time.ticks_ms()) <= 0:
                raise OSError("Respuesta HTTPS con tiempo agotado")
            try:
                datos = ws.leer(tls, 1024)
            except ws.ErrorWebSocket:
                datos = b""
            if datos is None:
                raise OSError("Respuesta HTTPS con tiempo agotado")
            final = not datos
            recibido.extend(datos)
            if len(recibido) > _MAX_RESPUESTA:
                raise OSError("Respuesta HTTPS demasiado grande")
            resultado = analizar_respuesta(recibido, final)
            if resultado is not None:
                return resultado
    finally:
        tls.close()


# ---------------------------------------------------------------------------
# Cliente
# ---------------------------------------------------------------------------

class LamparaRemota:
    def __init__(self, host, device_id, clave, email, password, ejecutar):
        self._host = host
        self._device = device_id
        self._clave = clave
        self._email = email
        self._password = password
        self._ejecutar = ejecutar          # comandos.ejecutar
        self.contexto = None               # SSLContext, lo asigna ambiente.iniciar
        self._lock = _thread.allocate_lock()
        self._topic = "realtime:%s:%s" % (_ID_CANAL, device_id)

        # Estado del worker de red
        self._ws = None
        self._estado = _DESCONECTADO
        self._token = None
        self._refresh = None
        self._expira_ms = 0
        self._margen_ms = 120000
        self._fallos = 0
        self._no_antes = None
        self._ref_n = 0
        self._join_ref = None
        self._tok_ref = None
        self._hb_ref = None
        self._hb_ms = 0
        self._join_ms = 0
        self._tomar = False
        self._tomar_no_antes = None
        self._tomar_fallos = 0
        self._detenido = False

        # Compartido con el hilo principal (siempre bajo _lock)
        self._gen = 0
        self._buzon = None                 # (orden, gen), un solo lugar
        self._salida = None                # confirmacion pendiente de enviar
        self._en_curso = False             # una orden tomada y aun sin cerrar
        self._apagar = True                # arranque seguro: lampara apagada

    # -- ciclo principal -----------------------------------------------------

    def actualizar(self):
        """Hilo principal: aplica apagados y ejecuta la orden del buzon."""
        with self._lock:
            orden, gen = self._buzon if self._buzon is not None else (None, None)
            self._buzon = None
            apagar = self._apagar
            self._apagar = False
        if apagar:
            self._apagar_lampara()
        if orden is None:
            return

        if not vigente(orden["vence_ms"], time.gmtime()):
            print("Lampara: orden vencida, no se ejecuta")
            with self._lock:
                if gen == self._gen:
                    self._en_curso = False
            return

        nivel = orden["level"]
        confirmacion = self._ejecutar({
            "command_id": orden["command_id"],
            "command": "lamp_set",
            "params": {"level": nivel},
        })
        resultado = confirmacion.get("result") or {}
        if confirmacion.get("ok") and nivel_valido(resultado.get("level")) == nivel:
            salida = self._salida_nueva(orden, True, nivel, None)
        elif confirmacion.get("ok"):
            salida = self._salida_nueva(orden, False, None, "nivel_distinto")
        else:
            salida = self._salida_nueva(orden, False, None, normalizar_error(confirmacion.get("error")))
        with self._lock:
            vencida_la_sesion = gen != self._gen
            if not vencida_la_sesion:
                self._salida = salida
        if vencida_la_sesion:
            self._apagar_lampara()

    def _apagar_lampara(self):
        self._ejecutar({"command_id": "local-apagado", "command": "lamp_set",
                        "params": {"level": 0}})

    @staticmethod
    def _salida_nueva(orden, ok, nivel, error):
        return {"id": orden["command_id"], "ok": ok, "nivel": nivel, "error": error,
                "vence_ms": orden["vence_ms"], "intentos": 0, "no_antes": None}

    def detener(self):
        """Desde cualquier hilo: no se aceptan mas ordenes y se apaga la lampara."""
        with self._lock:
            self._detenido = True
            self._gen += 1
            self._buzon = None
            self._salida = None
            self._en_curso = False
            self._apagar = True

    # -- worker de red -------------------------------------------------------

    def paso(self, red_lista):
        """Worker: avanza un poco y vuelve (polling cooperativo)."""
        try:
            if self._detenido:
                self.cerrar_red()
                return
            if not red_lista or self.contexto is None:
                if self._ws is not None:
                    self._perder("red", penalizar=False)
                return
            self._avanzar()
        except ErrorLampara as error:
            self._perder(error.motivo, grave=error.grave)
        except Exception as error:
            self._perder("fallo_" + type(error).__name__)

    def cerrar_red(self):
        ws_actual, self._ws = self._ws, None
        self._estado = _DESCONECTADO
        if ws_actual is not None:
            ws_actual.cerrar()

    def _perder(self, motivo, penalizar=True, grave=False):
        con_sesion = self._ws is not None or self._estado != _DESCONECTADO
        self.cerrar_red()
        with self._lock:
            self._gen += 1
            self._buzon = None
            self._salida = None
            self._en_curso = False
            self._apagar = True
        self._tomar = False
        self._hb_ref = None
        if penalizar:
            self._fallos += 1
            espera = _BACKOFF_GRAVE_MS if grave else _BACKOFF_MS[min(self._fallos, len(_BACKOFF_MS)) - 1]
            espera += ord(os.urandom(1)) * 4          # jitter de hasta ~1 s
            self._no_antes = time.ticks_add(time.ticks_ms(), espera)
        if con_sesion or penalizar:
            print("Lampara: sin conexion (%s)" % motivo)

    def _avanzar(self):
        ahora = time.ticks_ms()
        if self._ws is None:
            if self._no_antes is not None and time.ticks_diff(ahora, self._no_antes) < 0:
                return
            self._asegurar_token()
            self._abrir()
            return
        self._leer_mensajes()
        ahora = time.ticks_ms()
        if self._estado == _UNIENDO:
            if time.ticks_diff(ahora, self._join_ms) > _ESPERA_JOIN_MS:
                raise ErrorLampara("join_tiempo")
            return
        if self._estado != _ACTIVO:
            return
        self._latido(ahora)
        if time.ticks_diff(self._expira_ms, ahora) < self._margen_ms:
            self._renovar_en_linea()
        self._tomar_si_toca(ahora)
        self._confirmar_si_toca(ahora)

    # -- autenticacion -------------------------------------------------------

    def _autenticar(self, ruta, cuerpo):
        cuerpo = json.dumps(cuerpo).encode()
        estado, datos = _http(self._host, self.contexto, ruta, {"apikey": self._clave}, cuerpo)
        if estado != 200:
            raise ErrorLampara("auth_http_%d" % estado, grave=estado in (400, 401, 403, 422))
        try:
            sesion = json.loads(datos.decode())
        except ValueError:
            raise ErrorLampara("auth_respuesta")
        datos = None
        token = sesion.get("access_token") if isinstance(sesion, dict) else None
        refresh = sesion.get("refresh_token") if isinstance(sesion, dict) else None
        vida = sesion.get("expires_in") if isinstance(sesion, dict) else None
        if not _solo(token, _CARACTERES_CLAVE) or len(token) > 4096:
            raise ErrorLampara("auth_respuesta")
        if not isinstance(vida, int) or isinstance(vida, bool) or vida < 30:
            vida = 3600
        self._token = token
        self._refresh = refresh if _solo(refresh, _CARACTERES_CLAVE) else None
        self._margen_ms = min(120000, vida * 500)
        self._expira_ms = time.ticks_add(time.ticks_ms(), vida * 1000)

    def _asegurar_token(self):
        """Token vigente: reutiliza, renueva con refresh o vuelve a autenticar."""
        if self._token is not None and time.ticks_diff(self._expira_ms, time.ticks_ms()) > self._margen_ms:
            return
        self._renovar()

    def _renovar(self):
        if self._refresh is not None:
            try:
                self._autenticar("/auth/v1/token?grant_type=refresh_token",
                                 {"refresh_token": self._refresh})
                return
            except ErrorLampara:
                self._refresh = None
        self._autenticar("/auth/v1/token?grant_type=password",
                         {"email": self._email, "password": self._password})

    def _renovar_en_linea(self):
        """Renueva el JWT y lo entrega al canal con el evento access_token."""
        self._renovar()
        self._tok_ref = self._siguiente_ref()
        self._enviar(self._topic, "access_token", {"access_token": self._token},
                     self._tok_ref, self._join_ref)

    # -- Realtime ------------------------------------------------------------

    def _siguiente_ref(self):
        self._ref_n += 1
        return str(self._ref_n)

    def _enviar(self, topic, evento, payload, ref, join_ref=None):
        mensaje = {"topic": topic, "event": evento, "payload": payload, "ref": ref}
        if join_ref is not None:
            mensaje["join_ref"] = join_ref
        self._ws.enviar_texto(json.dumps(mensaje))

    def _abrir(self):
        ruta = "/realtime/v1/websocket?apikey=%s&vsn=1.0.0" % self._clave
        self._ws = ws.Conexion.abrir(self._host, ruta, self.contexto)
        self._join_ref = self._siguiente_ref()
        self._tok_ref = None
        config = {
            "broadcast": {"self": False, "ack": False},
            "presence": {"enabled": False},
            "postgres_changes": [],
            "private": True,
        }
        self._enviar(self._topic, "phx_join",
                     {"config": config, "access_token": self._token},
                     self._join_ref, self._join_ref)
        ahora = time.ticks_ms()
        self._estado = _UNIENDO
        self._join_ms = ahora
        self._hb_ms = ahora
        self._hb_ref = None

    def _leer_mensajes(self):
        for _ in range(6):
            mensaje = self._ws.recibir()
            if mensaje is None:
                return
            if mensaje[0] == ws.OP_TEXTO:
                self._procesar(mensaje[1])

    def _latido(self, ahora):
        if self._hb_ref is not None:
            if time.ticks_diff(ahora, self._hb_ms) > _ESPERA_HEARTBEAT_MS:
                raise ErrorLampara("heartbeat_perdido")
        elif time.ticks_diff(ahora, self._hb_ms) >= _HEARTBEAT_MS:
            self._hb_ref = self._siguiente_ref()
            self._hb_ms = ahora
            self._enviar("phoenix", "heartbeat", {}, self._hb_ref)

    def _procesar(self, datos):
        """Interpreta un mensaje Phoenix. Las ordenes nunca viajan aqui."""
        try:
            mensaje = json.loads(datos.decode())
        except ValueError:
            return
        if not isinstance(mensaje, dict):
            return
        evento = mensaje.get("event")
        topic = mensaje.get("topic")
        payload = mensaje.get("payload")
        if not isinstance(payload, dict):
            payload = {}
        ref = mensaje.get("ref")

        if evento == "phx_reply":
            ok = payload.get("status") == "ok"
            if topic == "phoenix":
                if ref == self._hb_ref:
                    self._hb_ref = None
            elif topic == self._topic and ref == self._join_ref and self._estado == _UNIENDO:
                if not ok:
                    raise ErrorLampara("join_rechazado")
                self._estado = _ACTIVO
                self._fallos = 0
                self._no_antes = None
                self._tomar = True
                self._tomar_fallos = 0
                self._tomar_no_antes = None
                print("Lampara: suscrita al canal")
            elif topic == self._topic and ref == self._tok_ref and not ok:
                raise ErrorLampara("token_rechazado")
        elif topic == self._topic and evento in ("phx_error", "phx_close"):
            raise ErrorLampara("canal_cerrado")
        elif topic == self._topic and evento == "system":
            if payload.get("status") == "error":
                raise ErrorLampara("canal_error")
        elif topic == self._topic and evento == "broadcast" and self._estado == _ACTIVO:
            if payload.get("event") == "orden_disponible":
                self._tomar = True        # solo senal: la orden sale del RPC

    # -- RPC -----------------------------------------------------------------

    def _rpc(self, nombre, cuerpo):
        cabeceras = {"apikey": self._clave, "Authorization": "Bearer " + self._token}
        estado, datos = _http(self._host, self.contexto, "/rest/v1/rpc/" + nombre,
                              cabeceras, json.dumps(cuerpo).encode())
        if estado == 401:
            self._expira_ms = time.ticks_ms()        # fuerza renovar en el proximo paso
        resultado = None
        if 200 <= estado < 300 and datos:
            try:
                resultado = json.loads(datos.decode())
            except ValueError:
                raise ErrorLampara("rpc_respuesta")
        return estado, resultado

    def _tomar_si_toca(self, ahora):
        if not self._tomar:
            return
        if self._tomar_no_antes is not None and time.ticks_diff(ahora, self._tomar_no_antes) < 0:
            return
        with self._lock:
            if self._en_curso:
                return                    # se procesa en secuencia; la senal queda anotada
            gen = self._gen
        try:
            estado, obj = self._rpc("tomar_orden_lampara", {})
        except OSError:
            estado, obj = 0, None
        if not 200 <= estado < 300:
            self._tomar_fallos += 1
            if self._tomar_fallos >= _INTENTOS_TOMAR:
                self._tomar = False
                print("Lampara: no se pudo recuperar la orden (HTTP %d)" % estado)
            else:
                self._tomar_no_antes = time.ticks_add(ahora, 2000)
            return
        self._tomar = False
        self._tomar_fallos = 0
        if obj is None:
            return
        orden = validar_orden(obj)
        obj = None
        if orden is None:
            print("Lampara: orden recibida no valida")
            return
        with self._lock:
            if gen != self._gen:
                return
            self._en_curso = True
            if orden["level"] is None:
                self._salida = self._salida_nueva(orden, False, None, "orden_invalida")
            else:
                self._buzon = (orden, gen)

    def _confirmar_si_toca(self, ahora):
        with self._lock:
            salida = self._salida
            gen = self._gen
        if salida is None:
            return
        if salida["no_antes"] is not None and time.ticks_diff(ahora, salida["no_antes"]) < 0:
            return
        cuerpo = {"p_command_id": salida["id"], "p_ok": salida["ok"],
                  "p_level": salida["nivel"], "p_error": salida["error"]}
        try:
            estado, _ = self._rpc("confirmar_orden_lampara", cuerpo)
        except OSError:
            estado = 0
        with self._lock:
            if gen != self._gen:
                return
            if 200 <= estado < 300:
                self._salida = None
                self._en_curso = False
                print("Lampara: confirmacion registrada")
                return
            salida["intentos"] += 1
            if salida["intentos"] >= _INTENTOS_CONFIRMAR:
                self._salida = None
                self._en_curso = False
                print("Lampara: confirmacion no registrada (HTTP %d)" % estado)
            else:
                salida["no_antes"] = time.ticks_add(ahora, 1000)


def configurar(ejecutar, ajustes=None):
    """LamparaRemota si secrets.py tiene la configuracion LAMPARA_*; si no, None."""
    if ajustes is None:
        import secrets as ajustes
    url = getattr(ajustes, "LAMPARA_SUPABASE_URL", "")
    clave = getattr(ajustes, "LAMPARA_PUBLISHABLE_KEY", "")
    dispositivo = getattr(ajustes, "LAMPARA_DEVICE_ID", "")
    email = getattr(ajustes, "LAMPARA_AUTH_EMAIL", "")
    password = getattr(ajustes, "LAMPARA_AUTH_PASSWORD", "")
    if not (url or clave or dispositivo or email or password):
        print("Lampara remota: desactivada (sin configuracion)")
        return None
    host = host_de_url(url)
    if host is None:
        print("Lampara remota: URL de Supabase invalida")
    elif not _solo(clave, _CARACTERES_CLAVE) or len(clave) > 300:
        print("Lampara remota: clave publicable ausente o invalida")
    elif not id_valido(dispositivo):
        print("Lampara remota: identificador de modulo invalido")
    elif not isinstance(email, str) or not email or not isinstance(password, str) or not password:
        print("Lampara remota: falta la cuenta del dispositivo")
    else:
        print("Lampara remota: habilitada para", dispositivo)
        return LamparaRemota(host, dispositivo, clave, email, password, ejecutar)
    return None
