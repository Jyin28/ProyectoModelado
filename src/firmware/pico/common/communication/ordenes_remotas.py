"""ordenes_remotas.py - Ordenes remotas por modulo (figuras, audio, movimiento, colchon) y voz.

SIN PROBAR EN HARDWARE NI CON SUPABASE REAL. Contratos:
src/shared/contracts/ordenes.md y voz.md.

Es la version general de lampara_remota.py y reutiliza su conexion, su
autenticacion, su latido y su logica pura. Cambia lo siguiente:
  - Canal "realtime:modulo:<producto>" y RPC tomar_orden_modulo /
    confirmar_orden_modulo. Una cuenta de dispositivo recibe las ordenes de todos
    los modulos de su producto.
  - La orden trae command y params; se ejecuta con comandos.ejecutar, que
    rechaza lo que no sea del modulo conectado.
  - Con voz, une ademas el canal "realtime:voz:<producto>" y entrega cada
    fragmento a voz.Voz (que solo encola; nada se guarda).
  - Al perder la conexion se descartan las ordenes pendientes y se hace una
    parada segura (figuras apagadas, audio detenido).

Reparto de hilos igual que en lampara_remota.py: paso() corre en el unico
worker de red; actualizar() corre en el ciclo principal y es el unico que toca
los actuadores. Nunca se imprimen credenciales, tokens ni respuestas.

Sin variables ORDENES_* en secrets.py el cliente queda apagado.
"""
import json
import time

import config
import lampara_remota as lr

_COMANDOS_PARADA = {"figuras": ("led_stop",), "cuna": ("audio_stop",), "colchon": ()}
_MAX_RESULTADO = 400
_LETRAS = "abcdefghijklmnopqrstuvwxyz"
_PRODUCTO = "abcdefghijklmnopqrstuvwxyz0123456789_-"


def device_valido(device_id):
    """cuna-<tipo>-NN"""
    if not isinstance(device_id, str) or not device_id.startswith("cuna-") or len(device_id) < 10:
        return False
    tipo, _, numero = device_id[5:].rpartition("-")
    return (bool(tipo) and all(c in _LETRAS for c in tipo)
            and len(numero) == 2 and numero.isdigit())


def producto_valido(producto):
    return (isinstance(producto, str) and 0 < len(producto) <= 64
            and producto[0] in _PRODUCTO[:-2] and all(c in _PRODUCTO for c in producto))


def validar_orden_modulo(obj):
    """Orden devuelta por tomar_orden_modulo, o None si no es utilizable."""
    if not isinstance(obj, dict) or not lr.uuid_valido(obj.get("command_id")):
        return None
    vence = lr.analizar_rfc3339(obj.get("vence_en"))
    comando = obj.get("command")
    params = obj.get("params")
    if vence is None or not isinstance(comando, str) or not 0 < len(comando) <= 30:
        return None
    if not all(c in _LETRAS + "_" for c in comando) or not isinstance(params, dict):
        return None
    return {"command_id": obj["command_id"], "vence_ms": vence,
            "command": comando, "params": params}


def resultado_para_confirmar(resultado):
    """Resultado del comando limitado a valores simples y a un tamano fijo."""
    if not isinstance(resultado, dict):
        return {}
    limpio = {}
    for clave in resultado:
        valor = resultado[clave]
        if (isinstance(clave, str) and len(clave) <= 30
                and (valor is None or isinstance(valor, (bool, int, str))
                     or (isinstance(valor, float) and valor == valor))):
            limpio[clave] = valor if not isinstance(valor, str) else valor[:60]
    if len(json.dumps(limpio)) > _MAX_RESULTADO:
        return {}
    return limpio


class OrdenesRemotas(lr.LamparaRemota):
    _ROTULO = "Ordenes"

    def __init__(self, host, device_id, producto, clave, email, password, ejecutar, voz=None,
                 estado_para_nube=None):
        lr.LamparaRemota.__init__(self, host, device_id, clave, email, password, ejecutar)
        self._estado_para_nube = estado_para_nube
        self._informar = True          # informar el estado real al conectar (CA-28.3)
        self._informar_fallos = 0
        self._informar_no_antes = None
        self._topic = "realtime:modulo:" + producto
        self._voz = voz
        self._topic_voz = "realtime:voz:" + producto
        self._voz_join_ref = None

    # -- ciclo principal -----------------------------------------------------

    def actualizar(self):
        """Hilo principal: aplica paradas y ejecuta la orden del buzon."""
        with self._lock:
            orden, gen = self._buzon if self._buzon is not None else (None, None)
            self._buzon = None
            parar = self._apagar
            self._apagar = False
        if parar:
            self._parada_segura()
        if orden is None:
            return

        if not lr.vigente(orden["vence_ms"], time.gmtime()):
            print("Ordenes: orden vencida, no se ejecuta")
            with self._lock:
                if gen == self._gen:
                    self._en_curso = False
            return

        confirmacion = self._ejecutar({
            "command_id": orden["command_id"],
            "command": orden["command"],
            "params": orden["params"],
        })
        if confirmacion.get("ok"):
            salida = self._salida_orden(
                orden, True, resultado_para_confirmar(confirmacion.get("result")), None)
        else:
            salida = self._salida_orden(
                orden, False, None, lr.normalizar_error(confirmacion.get("error")))
        with self._lock:
            vencida_la_sesion = gen != self._gen
            if not vencida_la_sesion:
                self._salida = salida
        if vencida_la_sesion:
            self._parada_segura()

    def _parada_segura(self):
        for comando in _COMANDOS_PARADA.get(config.MODULO, ()):
            self._ejecutar({"command_id": "local-parada", "command": comando, "params": {}})

    @staticmethod
    def _salida_orden(orden, ok, resultado, error):
        return {"id": orden["command_id"], "ok": ok, "resultado": resultado, "error": error,
                "vence_ms": orden["vence_ms"], "intentos": 0, "no_antes": None}

    # -- red -----------------------------------------------------------------

    def _perder(self, motivo, penalizar=True, grave=False):
        if self._voz is not None:
            self._voz.finalizar()
        self._informar = True          # tras cualquier corte se vuelve a informar
        self._informar_fallos = 0
        self._informar_no_antes = None
        lr.LamparaRemota._perder(self, motivo, penalizar, grave)

    def _abrir(self):
        lr.LamparaRemota._abrir(self)
        if self._voz is not None:
            self._voz_join_ref = self._siguiente_ref()
            config_canal = {
                "broadcast": {"self": False, "ack": False},
                "presence": {"enabled": False},
                "postgres_changes": [],
                "private": True,
            }
            self._enviar(self._topic_voz, "phx_join",
                         {"config": config_canal, "access_token": self._token},
                         self._voz_join_ref, self._voz_join_ref)

    def _renovar_en_linea(self):
        lr.LamparaRemota._renovar_en_linea(self)
        if self._voz is not None:
            self._enviar(self._topic_voz, "access_token", {"access_token": self._token},
                         self._siguiente_ref(), self._voz_join_ref)

    def _procesar(self, datos):
        if self._voz is not None and self._estado == lr._ACTIVO:
            try:
                mensaje = json.loads(datos.decode())
            except ValueError:
                return
            if isinstance(mensaje, dict) and mensaje.get("topic") == self._topic_voz:
                self._procesar_voz(mensaje)
                return
        lr.LamparaRemota._procesar(self, datos)

    def _procesar_voz(self, mensaje):
        evento = mensaje.get("event")
        carga = mensaje.get("payload")
        if not isinstance(carga, dict):
            carga = {}
        if evento == "broadcast":
            if carga.get("event") == "voz":
                self._voz.recibir(carga.get("payload"))
            elif carga.get("event") == "voz_fin":
                self._voz.finalizar()
        elif evento in ("phx_error", "phx_close"):
            self._voz.finalizar()
        elif evento == "phx_reply" and carga.get("status") != "ok":
            self._voz.finalizar()
            print("Voz: canal rechazado")

    # -- RPC -----------------------------------------------------------------

    def _informar_si_toca(self, ahora):
        """Informa al servidor el estado real del modulo, antes de tomar ordenes.

        Hasta que lo logra (o agota los intentos) no se toman ordenes: asi una
        orden pendiente no se aplica sobre un estado que el servidor desconoce.
        """
        if not self._informar:
            return True
        if self._estado_para_nube is None:
            self._informar = False
            return True
        if self._informar_no_antes is not None and time.ticks_diff(ahora, self._informar_no_antes) < 0:
            return False
        with self._lock:
            gen = self._gen
        try:
            estado, _ = self._rpc("reportar_estado_modulo", {"p_estado": self._estado_para_nube()})
        except (OSError, ValueError):
            estado = 0
        with self._lock:
            if gen != self._gen:
                return False
        if 200 <= estado < 300:
            self._informar = False
            print("Ordenes: estado informado al servidor")
            return True
        self._informar_fallos += 1
        if self._informar_fallos >= lr._INTENTOS_TOMAR:
            self._informar = False      # no bloquea las ordenes por un fallo del reporte
            print("Ordenes: no se pudo informar el estado (HTTP %d)" % estado)
            return True
        self._informar_no_antes = time.ticks_add(ahora, 2000)
        return False

    def _tomar_si_toca(self, ahora):
        if not self._tomar:
            return
        if not self._informar_si_toca(ahora):
            return
        if self._tomar_no_antes is not None and time.ticks_diff(ahora, self._tomar_no_antes) < 0:
            return
        with self._lock:
            if self._en_curso:
                return                    # se procesa en secuencia; la senal queda anotada
            gen = self._gen
        try:
            estado, obj = self._rpc("tomar_orden_modulo", {})
        except OSError:
            estado, obj = 0, None
        if not 200 <= estado < 300:
            self._tomar_fallos += 1
            if self._tomar_fallos >= lr._INTENTOS_TOMAR:
                self._tomar = False
                print("Ordenes: no se pudo recuperar la orden (HTTP %d)" % estado)
            else:
                self._tomar_no_antes = time.ticks_add(ahora, 2000)
            return
        self._tomar = False
        self._tomar_fallos = 0
        if obj is None:
            return
        orden = validar_orden_modulo(obj)
        obj = None
        if orden is None:
            print("Ordenes: orden recibida no valida")
            return
        with self._lock:
            if gen != self._gen:
                return
            self._en_curso = True
            self._buzon = (orden, gen)
        self._tomar = True                # puede haber otra orden esperando en el producto

    def _confirmar_si_toca(self, ahora):
        with self._lock:
            salida = self._salida
            gen = self._gen
        if salida is None:
            return
        if salida["no_antes"] is not None and time.ticks_diff(ahora, salida["no_antes"]) < 0:
            return
        cuerpo = {"p_command_id": salida["id"], "p_ok": salida["ok"],
                  "p_resultado": salida["resultado"], "p_error": salida["error"]}
        try:
            estado, _ = self._rpc("confirmar_orden_modulo", cuerpo)
        except OSError:
            estado = 0
        with self._lock:
            if gen != self._gen:
                return
            if 200 <= estado < 300:
                self._salida = None
                self._en_curso = False
                print("Ordenes: confirmacion registrada")
                return
            salida["intentos"] += 1
            if salida["intentos"] >= lr._INTENTOS_CONFIRMAR:
                self._salida = None
                self._en_curso = False
                print("Ordenes: confirmacion no registrada (HTTP %d)" % estado)
            else:
                salida["no_antes"] = time.ticks_add(ahora, 1000)


class Grupo:
    """Varios clientes remotos (lampara y ordenes) bajo el unico worker de red."""

    def __init__(self, clientes):
        self._clientes = [c for c in clientes if c is not None]
        self._contexto = None

    @property
    def contexto(self):
        return self._contexto

    @contexto.setter
    def contexto(self, valor):
        self._contexto = valor
        for cliente in self._clientes:
            cliente.contexto = valor

    def actualizar(self):
        for cliente in self._clientes:
            cliente.actualizar()

    def paso(self, red_lista):
        for cliente in self._clientes:
            cliente.paso(red_lista)

    def ocupado(self):
        return any(cliente.ocupado() for cliente in self._clientes)

    def detener(self):
        for cliente in self._clientes:
            cliente.detener()

    def cerrar_red(self):
        for cliente in self._clientes:
            cliente.cerrar_red()


def configurar(ejecutar, ajustes=None, voz=None, estado_para_nube=None):
    """OrdenesRemotas si secrets.py tiene la configuracion ORDENES_*; si no, None."""
    if ajustes is None:
        import secrets as ajustes
    url = getattr(ajustes, "ORDENES_SUPABASE_URL", "")
    clave = getattr(ajustes, "ORDENES_PUBLISHABLE_KEY", "")
    dispositivo = getattr(ajustes, "ORDENES_DEVICE_ID", "")
    producto = getattr(ajustes, "ORDENES_PRODUCTO_ID", "")
    email = getattr(ajustes, "ORDENES_AUTH_EMAIL", "")
    password = getattr(ajustes, "ORDENES_AUTH_PASSWORD", "")
    if not (url or clave or dispositivo or producto or email or password):
        print("Ordenes remotas: desactivadas (sin configuracion)")
        return None
    host = lr.host_de_url(url)
    if host is None:
        print("Ordenes remotas: URL de Supabase invalida")
    elif not lr._solo(clave, lr._CARACTERES_CLAVE) or len(clave) > 300:
        print("Ordenes remotas: clave publicable ausente o invalida")
    elif not device_valido(dispositivo):
        print("Ordenes remotas: identificador de modulo invalido")
    elif not producto_valido(producto):
        print("Ordenes remotas: identificador de producto invalido")
    elif not isinstance(email, str) or not email or not isinstance(password, str) or not password:
        print("Ordenes remotas: falta la cuenta del dispositivo")
    else:
        print("Ordenes remotas: habilitadas para", dispositivo)
        return OrdenesRemotas(host, dispositivo, producto, clave, email, password, ejecutar, voz,
                              estado_para_nube)
    return None
