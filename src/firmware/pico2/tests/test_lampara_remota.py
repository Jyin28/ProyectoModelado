"""Pruebas de logica y serializacion de la lampara remota (Python de escritorio).

Ejecutar desde src/firmware:   python -m unittest discover -s tests -v

No usan red, hardware ni secretos. Solo cubren logica pura y el flujo del
cliente con un servidor simulado; WSS/TLS y la Pico real siguen sin probarse.
No subir esta carpeta a la Pico.
"""
import json
import os
import sys
import time
import unittest

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "common", "communication"))

# time de MicroPython (ticks_*) para que el modulo se importe en escritorio
_reloj = {"ms": 0}
time.ticks_ms = lambda: _reloj["ms"]
time.ticks_diff = lambda a, b: a - b
time.ticks_add = lambda a, b: a + b

import lampara_remota as lr          # noqa: E402
import websocket_cliente as ws       # noqa: E402

UUID = "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f"


class PruebasWebSocket(unittest.TestCase):
    def test_accept_del_rfc(self):
        self.assertEqual(ws.accept_esperado(b"dGhlIHNhbXBsZSBub25jZQ=="),
                         b"s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")

    def test_frame_enmascarado_del_rfc(self):
        marco = ws.codificar(ws.OP_TEXTO, b"Hello", mascara=bytes((0x37, 0xFA, 0x21, 0x3D)))
        self.assertEqual(marco, bytes((0x81, 0x85, 0x37, 0xFA, 0x21, 0x3D, 0x7F, 0x9F, 0x4D, 0x51, 0x58)))

    def test_frame_cliente_siempre_enmascarado(self):
        marco = ws.codificar(ws.OP_TEXTO, b"x" * 300)
        self.assertTrue(marco[1] & 0x80)
        self.assertEqual(marco[1] & 0x7F, 126)

    def test_control_no_supera_125(self):
        with self.assertRaises(ws.ErrorWebSocket):
            ws.codificar(ws.OP_PING, b"x" * 126)

    def test_handshake_valido_e_invalido(self):
        clave = b"dGhlIHNhbXBsZSBub25jZQ=="
        bueno = (b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                 b"Connection: Upgrade\r\nSec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")
        ws.validar_respuesta(bueno, clave)
        for malo in (bueno.replace(b"101", b"200"),
                     bueno.replace(b"xOo=", b"xOa="),
                     bueno.replace(b"Upgrade: websocket", b"Upgrade: otro")):
            with self.assertRaises(ws.ErrorWebSocket):
                ws.validar_respuesta(malo, clave)

    def test_decodifica_en_partes_y_fragmentado(self):
        d = ws.Decodificador()
        d.alimentar(b"\x01\x03Hel")
        self.assertIsNone(d.siguiente())
        d.alimentar(b"\x89\x00")                       # ping intercalado
        self.assertEqual(d.siguiente(), (ws.OP_PING, b""))
        d.alimentar(b"\x80\x02lo")
        self.assertEqual(d.siguiente(), (ws.OP_TEXTO, b"Hello"))

    def test_rechaza_servidor_enmascarado_rsv_y_tamano(self):
        for crudo in (b"\x81\x81abcd\x00", b"\xc1\x00", b"\x83\x00", b"\x81\x7e\x40\x00",
                      b"\x09\x00", b"\x89\x7e\x00\x80"):
            d = ws.Decodificador(maximo=8192)
            d.alimentar(crudo)
            with self.assertRaises(ws.ErrorWebSocket):
                d.siguiente()

    def test_limite_de_mensaje_fragmentado(self):
        d = ws.Decodificador(maximo=4)
        d.alimentar(b"\x01\x03abc\x80\x03def")
        with self.assertRaises(ws.ErrorWebSocket):
            d.siguiente()


class _Flujo:
    """Flujo falso para Conexion.recibir."""

    def __init__(self, entradas):
        self.entradas = list(entradas)
        self.salida = bytearray()

    def read(self, n):
        if not self.entradas:
            raise OSError(110, "timeout")
        return self.entradas.pop(0)

    def write(self, datos):
        self.salida.extend(bytes(datos))
        return len(datos)

    def close(self):
        pass


class PruebasConexion(unittest.TestCase):
    def test_ping_responde_pong_y_cierre_lanza(self):
        flujo = _Flujo([b"\x89\x02ab", b"\x81\x02hi"])
        c = ws.Conexion(flujo, flujo, 0.2)
        self.assertEqual(c.recibir(), (ws.OP_TEXTO, b"hi"))
        self.assertEqual(flujo.salida[0], 0x8A)            # pong enmascarado
        self.assertTrue(flujo.salida[1] & 0x80)
        self.assertIsNone(c.recibir())                      # timeout = sin datos
        flujo.entradas.append(b"\x88\x02\x03\xe8")
        with self.assertRaises(ws.ErrorWebSocket):
            c.recibir()

    def test_eof_es_cierre(self):
        flujo = _Flujo([b""])
        with self.assertRaises(ws.ErrorWebSocket):
            ws.Conexion(flujo, flujo, 0.2).recibir()


class PruebasLogica(unittest.TestCase):
    def test_rfc3339(self):
        base = lr.analizar_rfc3339("2026-11-11T16:04:25Z")
        self.assertEqual(lr.analizar_rfc3339("2026-11-11T16:04:25.123+00:00"), base + 123)
        self.assertEqual(lr.analizar_rfc3339("2026-11-11T16:04:25.5Z"), base + 500)
        self.assertEqual(lr.analizar_rfc3339("2026-11-11T16:04:25.123456Z"), base + 123)
        # 2026-11-11T16:04:25Z en segundos Unix
        self.assertEqual(base, 1794413065000)
        for malo in ("", "2026-11-11 16:04:25Z", "2026-11-11T16:04:25", "2026-11-11T16:04:25+02:00",
                     "2026-13-11T16:04:25Z", "2026-11-11T16:04:25.Z", None, 5):
            self.assertIsNone(lr.analizar_rfc3339(malo))

    def test_vigencia(self):
        ahora = (2026, 11, 11, 16, 4, 10, 0, 0)
        vence = lr.analizar_rfc3339("2026-11-11T16:04:25.123+00:00")
        self.assertTrue(lr.vigente(vence, ahora))
        self.assertTrue(lr.vigente(vence, (2026, 11, 11, 16, 4, 24, 0, 0)))    # 1,123 s
        self.assertFalse(lr.vigente(vence, (2026, 11, 11, 16, 4, 25, 0, 0)))   # 0,123 s: menos del margen
        self.assertFalse(lr.vigente(vence, (2026, 11, 11, 16, 4, 26, 0, 0)))   # vencida
        self.assertFalse(lr.vigente(vence, (2000, 1, 1, 0, 0, 0, 0, 0)))       # reloj sin NTP
        self.assertFalse(lr.vigente(None, ahora))
        lejos = lr.analizar_rfc3339("2026-11-11T17:04:25Z")
        self.assertFalse(lr.vigente(lejos, ahora))

    def test_validar_orden(self):
        base = {"command_id": UUID, "command": "lamp_set", "params": {"level": 40},
                "vence_en": "2026-11-11T16:04:25.123+00:00"}
        self.assertEqual(lr.validar_orden(base)["level"], 40)
        otro = dict(base, params={"level": 40.0})
        self.assertEqual(lr.validar_orden(otro)["level"], 40)
        for params in ({"level": 40.5}, {"level": 101}, {"level": -1}, {"level": True},
                       {"level": "40"}, {}, None):
            self.assertIsNone(lr.validar_orden(dict(base, params=params))["level"])
        self.assertIsNone(lr.validar_orden(dict(base, command="led_all"))["level"])
        self.assertIsNone(lr.validar_orden(dict(base, command_id="x")))
        self.assertIsNone(lr.validar_orden(dict(base, vence_en="ayer")))
        self.assertIsNone(lr.validar_orden(None))

    def test_normalizar_error_cumple_el_contrato(self):
        self.assertEqual(lr.normalizar_error("fuera_de_rango:level"), "fuera_de_rango:level")
        self.assertEqual(lr.normalizar_error("Error Raro!"), "errorraro")
        self.assertEqual(lr.normalizar_error("!!!"), "error")
        self.assertEqual(len(lr.normalizar_error("a" * 200)), 80)

    def test_respuesta_http(self):
        crudo = b"HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nnull"
        self.assertEqual(lr.analizar_respuesta(crudo[:-2]), None)
        self.assertEqual(lr.analizar_respuesta(crudo), (200, b"null"))
        chunk = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n"
        self.assertEqual(lr.analizar_respuesta(chunk), (200, b"{}"))
        self.assertIsNone(lr.analizar_respuesta(chunk[:-8]))
        with self.assertRaises(ValueError):
            lr.analizar_respuesta(b"basura\r\n\r\n")

    def test_configuracion(self):
        class Ajustes:
            LAMPARA_SUPABASE_URL = ""
            LAMPARA_PUBLISHABLE_KEY = ""
            LAMPARA_DEVICE_ID = ""
            LAMPARA_AUTH_EMAIL = ""
            LAMPARA_AUTH_PASSWORD = ""

        self.assertIsNone(lr.configurar(None, Ajustes))           # vacio = apagado
        self.assertIsNone(lr.configurar(None, object()))           # sin variables
        Ajustes.LAMPARA_SUPABASE_URL = "https://abc.supabase.co"
        self.assertIsNone(lr.configurar(None, Ajustes))           # incompleto
        Ajustes.LAMPARA_PUBLISHABLE_KEY = "sb_publishable_abc"
        Ajustes.LAMPARA_DEVICE_ID = "cuna-lampara-01"
        Ajustes.LAMPARA_AUTH_EMAIL = "a@b.c"
        Ajustes.LAMPARA_AUTH_PASSWORD = "p"
        self.assertIsNotNone(lr.configurar(None, Ajustes))
        Ajustes.LAMPARA_DEVICE_ID = "cuna-ambiente-01"
        self.assertIsNone(lr.configurar(None, Ajustes))
        Ajustes.LAMPARA_DEVICE_ID = "cuna-lampara-01"
        Ajustes.LAMPARA_SUPABASE_URL = "http://abc.supabase.co"
        self.assertIsNone(lr.configurar(None, Ajustes))


class PruebasCliente(unittest.TestCase):
    def setUp(self):
        _reloj["ms"] = 1000
        self.original_gmtime = time.gmtime
        time.gmtime = lambda: (2026, 11, 11, 16, 4, 10, 2, 315)
        self.nivel = 0
        self.ejecutadas = []
        self.c = lr.LamparaRemota("x.supabase.co", "cuna-lampara-01", "clave", "e", "p", self._ejecutar)
        self.c.contexto = object()
        self.c._estado = lr._ACTIVO
        self.c._token = "t"
        self.c._join_ref = "1"

    def tearDown(self):
        time.gmtime = self.original_gmtime

    def _ejecutar(self, orden):
        self.ejecutadas.append(orden)
        nivel = orden["params"]["level"]
        if nivel > 100:
            return {"command_id": orden["command_id"], "command": "lamp_set",
                    "ok": False, "error": "fuera_de_rango:level"}
        self.nivel = nivel
        return {"command_id": orden["command_id"], "command": "lamp_set",
                "ok": True, "result": {"level": nivel}}

    def _orden(self, nivel=40, vence="2026-11-11T16:04:25.123+00:00", comando="lamp_set"):
        return {"command_id": UUID, "command": comando, "params": {"level": nivel}, "vence_en": vence}

    def _rpc_falso(self, respuestas):
        llamadas = []

        def rpc(nombre, cuerpo):
            llamadas.append((nombre, cuerpo))
            return respuestas.pop(0)
        self.c._rpc = rpc
        return llamadas

    def test_arranca_apagada(self):
        self.c.actualizar()
        self.assertEqual(self.ejecutadas[0]["params"]["level"], 0)

    def test_join_ok_pide_orden_pero_la_senal_no_es_orden(self):
        self.c._estado = lr._UNIENDO
        self.c._procesar(json.dumps({"topic": "realtime:lampara:cuna-lampara-01", "event": "phx_reply",
                                     "ref": "1", "payload": {"status": "ok"}}).encode())
        self.assertEqual(self.c._estado, lr._ACTIVO)
        self.assertTrue(self.c._tomar)
        self.c._tomar = False
        # una senal con una orden "adentro" solo pone la bandera; no ejecuta ni guarda nada
        self.c._procesar(json.dumps({"topic": "realtime:lampara:cuna-lampara-01", "event": "broadcast",
                                     "payload": {"event": "orden_disponible", "type": "broadcast",
                                                 "payload": {"command_id": UUID, "level": 100}}}).encode())
        self.assertTrue(self.c._tomar)
        self.assertIsNone(self.c._buzon)
        self.assertEqual(self.ejecutadas, [])

    def test_join_rechazado(self):
        self.c._estado = lr._UNIENDO
        with self.assertRaises(lr.ErrorLampara):
            self.c._procesar(json.dumps({"topic": "realtime:lampara:cuna-lampara-01", "event": "phx_reply",
                                         "ref": "1", "payload": {"status": "error"}}).encode())

    def test_heartbeat_y_perdida(self):
        enviados = []
        self.c._ws = type("W", (), {"enviar_texto": lambda s, t: enviados.append(json.loads(t)),
                                    "cerrar": lambda s: None})()
        self.c._hb_ms = 0
        self.c._latido(19000)
        self.assertEqual(enviados, [])
        self.c._latido(20000)
        self.assertEqual(enviados[0]["topic"], "phoenix")
        self.assertEqual(enviados[0]["event"], "heartbeat")
        self.c._latido(25000)                                   # aun dentro de la espera
        with self.assertRaises(lr.ErrorLampara):
            self.c._latido(31000)

    def test_flujo_completo_tomar_ejecutar_confirmar(self):
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, self._orden(40)), (200, {"estado": "confirmado"})])
        self.c._tomar_si_toca(1000)
        self.assertEqual(llamadas[0][0], "tomar_orden_lampara")
        self.c.actualizar()
        self.assertEqual(self.nivel, 40)
        self.c._confirmar_si_toca(1000)
        self.assertEqual(llamadas[1], ("confirmar_orden_lampara",
                                       {"p_command_id": UUID, "p_ok": True, "p_level": 40, "p_error": None}))
        self.assertFalse(self.c._en_curso)

    def test_orden_vencida_en_la_pico_no_se_ejecuta(self):
        self.c._tomar = True
        self._rpc_falso([(200, self._orden(40, vence="2026-11-11T16:04:10.500Z"))])
        self.c._tomar_si_toca(1000)
        self.c.actualizar()
        self.assertEqual([o["params"]["level"] for o in self.ejecutadas], [0])   # solo el apagado inicial
        self.assertIsNone(self.c._salida)
        self.assertFalse(self.c._en_curso)

    def test_orden_no_lamp_set_o_nivel_invalido_se_confirma_con_error(self):
        for orden in (self._orden(40, comando="led_all"), self._orden(40.5), self._orden(150)):
            self.c._tomar = True
            self.c._en_curso = False
            self.ejecutadas.clear()
            self._rpc_falso([(200, orden)])
            self.c._tomar_si_toca(1000)
            self.assertEqual(self.ejecutadas, [])                # nunca llega a comandos
            self.assertFalse(self.c._salida["ok"])
            self.assertIsNone(self.c._salida["nivel"])
            self.assertEqual(self.c._salida["error"], "orden_invalida")

    def test_error_del_actuador_se_reporta_sin_nivel(self):
        # comandos.ejecutar rechaza 101 aunque la Pico lo hubiera aceptado como entero
        self.c._tomar = True
        self.c._ejecutar = lambda o: {"ok": False, "error": "fuera_de_rango:level"}
        self._rpc_falso([(200, self._orden(40))])
        self.c._tomar_si_toca(1000)
        self.c.actualizar()
        self.assertEqual(self.c._salida["error"], "fuera_de_rango:level")
        self.assertFalse(self.c._salida["ok"])

    def test_sin_respuesta_no_se_reporta_exito(self):
        self.c._tomar = True
        self._rpc_falso([(200, self._orden(40))])
        self.c._tomar_si_toca(1000)
        self.c.actualizar()

        def rpc(nombre, cuerpo):
            raise OSError("timeout")
        self.c._rpc = rpc
        for i in range(lr._INTENTOS_CONFIRMAR):
            self.assertIsNotNone(self.c._salida)
            self.c._confirmar_si_toca(1000 + i * 2000)
        self.assertIsNone(self.c._salida)                      # se descarta, nunca "registrada"
        self.assertFalse(self.c._en_curso)

    def test_no_toma_otra_orden_mientras_procesa(self):
        self.c._tomar = True
        self.c._en_curso = True
        llamadas = self._rpc_falso([])
        self.c._tomar_si_toca(1000)
        self.assertEqual(llamadas, [])
        self.assertTrue(self.c._tomar)                         # queda anotada

    def test_perdida_descarta_pendientes_y_apaga(self):
        self.c._tomar = True
        self._rpc_falso([(200, self._orden(70))])
        self.c._tomar_si_toca(1000)
        self.assertIsNotNone(self.c._buzon)
        self.c._perder("prueba")
        self.assertIsNone(self.c._buzon)
        self.assertIsNone(self.c._salida)
        self.c.actualizar()
        self.assertEqual(self.nivel, 0)
        self.assertEqual(self.c._estado, lr._DESCONECTADO)
        self.assertGreater(self.c._no_antes, 1000)              # backoff

    def test_orden_ejecutada_justo_al_perder_se_apaga(self):
        self.c._tomar = True
        self._rpc_falso([(200, self._orden(70))])
        self.c._tomar_si_toca(1000)
        original = self.c._ejecutar

        def ejecutar_y_perder(orden):
            resultado = original(orden)
            if orden["params"]["level"] == 70:
                self.c._perder("corte")                          # la conexion cae durante la ejecucion
            return resultado
        self.c._ejecutar = ejecutar_y_perder
        self.c.actualizar()
        self.assertEqual(self.nivel, 0)
        self.assertIsNone(self.c._salida)

    def test_backoff_crece_con_tope(self):
        previos = []
        for _ in range(8):
            self.c._perder("x")
            previos.append(self.c._no_antes - 1000)
        self.assertLess(previos[0], 4000)
        self.assertGreaterEqual(previos[-1], 60000)
        self.assertLess(previos[-1], 62000)

    def test_detener_apaga_y_no_deja_pendientes(self):
        self.c._buzon = ({}, 0)
        self.c.detener()
        self.assertIsNone(self.c._buzon)
        self.c.actualizar()
        self.assertEqual(self.nivel, 0)


if __name__ == "__main__":
    unittest.main()
