"""Ordenes remotas por modulo y voz (Python de escritorio, sin red ni hardware)."""
import json
import os
import sys
import time
import types
import unittest

import _ruta

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "..", "common", "communication"))

# Comparte el reloj simulado de test_lampara_remota (que tambien sustituye time.ticks_*).
import test_lampara_remota as _base   # noqa: E402

_reloj = _base._reloj
import lampara_remota as lr           # noqa: E402
import ordenes_remotas as orm         # noqa: E402

config = _ruta.config
UUID = "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f"
TOPIC = "realtime:modulo:figuras-01"
TOPIC_VOZ = "realtime:voz:figuras-01"


class FalsaVoz:
    def __init__(self):
        self.recibidos = []
        self.cierres = 0

    def recibir(self, carga):
        self.recibidos.append(carga)

    def finalizar(self):
        self.cierres += 1


class PruebasLogica(unittest.TestCase):
    def test_device_valido(self):
        for bueno in ("cuna-figuras-01", "cuna-audio-12", "cuna-colchon-99", "cuna-movimiento-03"):
            self.assertTrue(orm.device_valido(bueno), bueno)
        for malo in ("", None, 3, "cuna-figuras-1", "cuna-figuras-001", "cuna--01", "cuna-Figuras-01",
                     "otra-figuras-01", "cuna-figuras-0a", "cuna-fig uras-01"):
            self.assertFalse(orm.device_valido(malo), repr(malo))

    def test_producto_valido(self):
        for bueno in ("cuna-01", "figuras-01", "a", "colchon_01"):
            self.assertTrue(orm.producto_valido(bueno), bueno)
        for malo in ("", None, "-x", "_x", "Cuna-01", "a b", "x" * 65, "a/b"):
            self.assertFalse(orm.producto_valido(malo), repr(malo))

    def test_validar_orden_modulo(self):
        buena = {"command_id": UUID, "command": "led_sequence",
                 "params": {"name": "chase", "step_s": 2}, "vence_en": "2026-11-11T16:04:25.123+00:00"}
        orden = orm.validar_orden_modulo(buena)
        self.assertEqual(orden["command"], "led_sequence")
        self.assertEqual(orden["params"], {"name": "chase", "step_s": 2})
        for cambio in ({"command_id": "x"}, {"command": ""}, {"command": "LED"}, {"command": "a" * 31},
                       {"command": 5}, {"params": []}, {"params": None}, {"vence_en": "ayer"},
                       {"vence_en": None}):
            malo = dict(buena, **cambio)
            self.assertIsNone(orm.validar_orden_modulo(malo), repr(cambio))
        self.assertIsNone(orm.validar_orden_modulo(None))
        self.assertIsNone(orm.validar_orden_modulo([]))

    def test_resultado_para_confirmar_solo_valores_simples_y_cortos(self):
        self.assertEqual(orm.resultado_para_confirmar({"sequence": "chase", "n": 3, "ok": True, "x": None}),
                         {"sequence": "chase", "n": 3, "ok": True, "x": None})
        self.assertEqual(orm.resultado_para_confirmar({"a": {"b": 1}, "c": [1], "d": 1}), {"d": 1})
        self.assertEqual(orm.resultado_para_confirmar({"a": float("nan"), "b": 1.5}), {"b": 1.5})
        self.assertEqual(orm.resultado_para_confirmar(None), {})
        self.assertEqual(orm.resultado_para_confirmar({"k%d" % i: "v" * 40 for i in range(15)}), {})
        self.assertEqual(len(orm.resultado_para_confirmar({"s": "x" * 500})["s"]), 60)

    def test_configuracion(self):
        class Ajustes:
            ORDENES_SUPABASE_URL = "https://abc.supabase.co"
            ORDENES_PUBLISHABLE_KEY = "sb_publishable_abc"
            ORDENES_DEVICE_ID = "cuna-figuras-01"
            ORDENES_PRODUCTO_ID = "figuras-01"
            ORDENES_AUTH_EMAIL = "pico@example.test"
            ORDENES_AUTH_PASSWORD = "clave"

        self.assertIsNone(orm.configurar(None, types.SimpleNamespace()))
        cliente = orm.configurar(lambda o: o, Ajustes)
        self.assertIsInstance(cliente, orm.OrdenesRemotas)
        self.assertEqual(cliente._topic, TOPIC)
        for atributo, valor in (("ORDENES_SUPABASE_URL", "http://abc.supabase.co"),
                                ("ORDENES_PUBLISHABLE_KEY", "con espacios"),
                                ("ORDENES_DEVICE_ID", "cuna-figuras-1"),
                                ("ORDENES_PRODUCTO_ID", "Producto"),
                                ("ORDENES_AUTH_EMAIL", ""), ("ORDENES_AUTH_PASSWORD", "")):
            class Mal(Ajustes):
                pass
            setattr(Mal, atributo, valor)
            self.assertIsNone(orm.configurar(lambda o: o, Mal), atributo)


class PruebasCliente(unittest.TestCase):
    def setUp(self):
        _reloj["ms"] = 1000
        self.original_gmtime = time.gmtime
        time.gmtime = lambda: (2026, 11, 11, 16, 4, 10, 2, 315)
        self.modulo_original = config.MODULO
        config.MODULO = "figuras"
        self.ejecutadas = []
        self.respuesta = {"ok": True, "result": {"sequence": "chase"}}
        self.voz = FalsaVoz()
        self.c = orm.OrdenesRemotas("x.supabase.co", "cuna-figuras-01", "figuras-01", "clave", "e", "p",
                                    self._ejecutar, self.voz)
        self.c.contexto = object()
        self.c._estado = lr._ACTIVO
        self.c._token = "t"
        self.c._join_ref = "1"

    def tearDown(self):
        time.gmtime = self.original_gmtime
        config.MODULO = self.modulo_original

    def _ejecutar(self, orden):
        self.ejecutadas.append(orden)
        return dict(self.respuesta, command_id=orden["command_id"], command=orden["command"])

    def _orden(self, comando="led_sequence", params=None, vence="2026-11-11T16:04:25.123+00:00"):
        return {"command_id": UUID, "command": comando, "device_id": "cuna-figuras-01",
                "params": {"name": "chase", "step_s": 2} if params is None else params,
                "vence_en": vence}

    def _rpc_falso(self, respuestas):
        llamadas = []

        def rpc(nombre, cuerpo):
            llamadas.append((nombre, cuerpo))
            return respuestas.pop(0)
        self.c._rpc = rpc
        return llamadas

    def test_canal_del_producto(self):
        self.assertEqual(self.c._topic, TOPIC)

    def test_arranca_con_parada_segura_de_las_figuras(self):
        self.c.actualizar()
        self.assertEqual([o["command"] for o in self.ejecutadas], ["led_stop"])

    def test_la_parada_segura_de_la_cuna_detiene_el_audio(self):
        config.MODULO = "cuna"
        self.c.actualizar()
        self.assertEqual([o["command"] for o in self.ejecutadas], ["audio_stop"])
        config.MODULO = "colchon"
        self.ejecutadas.clear()
        self.c._apagar = True
        self.c.actualizar()
        self.assertEqual(self.ejecutadas, [])

    def test_flujo_completo_tomar_ejecutar_confirmar(self):
        self.c._apagar = False
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, self._orden()), (200, {"estado": "confirmado"})])
        self.c._tomar_si_toca(1000)
        self.assertEqual(llamadas[0], ("tomar_orden_modulo", {}))
        self.assertTrue(self.c._tomar, "puede haber otra orden esperando")
        self.c.actualizar()
        self.assertEqual(self.ejecutadas[0]["command"], "led_sequence")
        self.assertEqual(self.ejecutadas[0]["params"], {"name": "chase", "step_s": 2})
        self.c._confirmar_si_toca(1000)
        self.assertEqual(llamadas[1], ("confirmar_orden_modulo", {
            "p_command_id": UUID, "p_ok": True, "p_resultado": {"sequence": "chase"}, "p_error": None}))
        self.assertFalse(self.c._en_curso)

    def test_un_comando_rechazado_se_confirma_con_error_sin_resultado(self):
        self.c._apagar = False
        self.respuesta = {"ok": False, "error": "comando_de_otro_modulo:figuras"}
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, self._orden("audio_play", {"sound": "tono_suave"})),
                                    (200, {})])
        self.c._tomar_si_toca(1000)
        self.c.actualizar()
        self.c._confirmar_si_toca(1000)
        self.assertEqual(llamadas[1][1], {"p_command_id": UUID, "p_ok": False, "p_resultado": None,
                                          "p_error": "comando_de_otro_modulo:figuras"})

    def test_orden_vencida_en_la_pico_no_se_ejecuta(self):
        self.c._apagar = False
        self.c._tomar = True
        self._rpc_falso([(200, self._orden(vence="2026-11-11T16:04:10.500Z"))])
        self.c._tomar_si_toca(1000)
        self.c.actualizar()
        self.assertEqual(self.ejecutadas, [])
        self.assertIsNone(self.c._salida)
        self.assertFalse(self.c._en_curso)

    def test_orden_invalida_o_sin_respuesta_no_ejecuta_nada(self):
        self.c._apagar = False
        for respuesta in ((200, {"command_id": "x"}), (500, None), (200, None)):
            self.c._tomar = True
            self.c._tomar_fallos = 0
            self.c._tomar_no_antes = None
            self._rpc_falso([respuesta])
            self.c._tomar_si_toca(1000)
            self.c.actualizar()
        self.assertEqual(self.ejecutadas, [])
        self.assertIsNone(self.c._salida)

    def test_no_toma_otra_orden_mientras_procesa(self):
        self.c._apagar = False
        self.c._tomar = True
        self._rpc_falso([(200, self._orden())])
        self.c._tomar_si_toca(1000)
        llamadas = self._rpc_falso([])
        self.c._tomar_si_toca(1000)
        self.assertEqual(llamadas, [])

    def test_sin_confirmacion_tras_tres_intentos_se_abandona(self):
        self.c._apagar = False
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, self._orden()), (500, None), (500, None), (500, None)])
        self.c._tomar_si_toca(1000)
        self.c.actualizar()
        for ahora in (1000, 3000, 5000):
            self.c._confirmar_si_toca(ahora)
        self.assertEqual([l[0] for l in llamadas], ["tomar_orden_modulo"] + ["confirmar_orden_modulo"] * 3)
        self.assertIsNone(self.c._salida)
        self.assertFalse(self.c._en_curso)

    def test_perdida_descarta_pendientes_cierra_la_voz_y_para(self):
        self.c._apagar = False
        self.c._tomar = True
        self._rpc_falso([(200, self._orden())])
        self.c._tomar_si_toca(1000)
        self.c._perder("prueba")
        self.assertIsNone(self.c._buzon)
        self.assertEqual(self.voz.cierres, 1)
        self.c.actualizar()
        self.assertEqual([o["command"] for o in self.ejecutadas], ["led_stop"])

    def test_orden_ejecutada_justo_al_perder_se_detiene(self):
        self.c._apagar = False
        self.c._tomar = True
        self._rpc_falso([(200, self._orden())])
        self.c._tomar_si_toca(1000)
        original = self.c._ejecutar

        def ejecutar_y_perder(orden):
            resultado = original(orden)
            if orden["command"] == "led_sequence":
                self.c._perder("corte")
            return resultado
        self.c._ejecutar = ejecutar_y_perder
        self.c.actualizar()
        self.assertEqual([o["command"] for o in self.ejecutadas], ["led_sequence", "led_stop"])
        self.assertIsNone(self.c._salida)

    def test_la_senal_solo_pide_tomar(self):
        self.c._procesar(json.dumps({"topic": TOPIC, "event": "broadcast",
                                     "payload": {"event": "orden_disponible", "type": "broadcast",
                                                 "payload": {"command_id": UUID, "command": "led_all"}}}).encode())
        self.assertTrue(self.c._tomar)
        self.assertIsNone(self.c._buzon)

    def test_voz_los_fragmentos_van_a_la_sesion_y_voz_fin_la_cierra(self):
        carga = {"seq": 1, "pcm": "AAAA"}
        self.c._procesar(json.dumps({"topic": TOPIC_VOZ, "event": "broadcast",
                                     "payload": {"event": "voz", "type": "broadcast",
                                                 "payload": carga}}).encode())
        self.assertEqual(self.voz.recibidos, [carga])
        self.c._procesar(json.dumps({"topic": TOPIC_VOZ, "event": "broadcast",
                                     "payload": {"event": "voz_fin", "type": "broadcast",
                                                 "payload": {}}}).encode())
        self.assertEqual(self.voz.cierres, 1)
        self.assertFalse(self.c._tomar, "la voz no dispara la toma de ordenes")

    def test_voz_un_canal_rechazado_o_cerrado_cierra_la_sesion(self):
        for evento, carga in (("phx_error", {}), ("phx_close", {}), ("phx_reply", {"status": "error"})):
            self.c._procesar(json.dumps({"topic": TOPIC_VOZ, "event": evento, "payload": carga}).encode())
        self.assertEqual(self.voz.cierres, 3)
        self.assertEqual(self.c._estado, lr._ACTIVO, "un problema de voz no tira el canal de ordenes")

    def test_sin_voz_los_mensajes_de_voz_se_ignoran(self):
        c = orm.OrdenesRemotas("x.supabase.co", "cuna-figuras-01", "figuras-01", "clave", "e", "p", self._ejecutar)
        c._estado = lr._ACTIVO
        c._procesar(json.dumps({"topic": TOPIC_VOZ, "event": "broadcast",
                                "payload": {"event": "voz", "payload": {"seq": 0, "pcm": "AA=="}}}).encode())
        self.assertFalse(c._tomar)

    def test_renueva_el_token_en_los_dos_canales(self):
        enviados = []
        self.c._ws = types.SimpleNamespace(enviar_texto=lambda t: enviados.append(json.loads(t)),
                                           cerrar=lambda: None)
        self.c._tok_ref = None
        self.c._renovar = lambda: None
        self.c._renovar_en_linea()
        self.assertEqual([m["topic"] for m in enviados], [TOPIC, TOPIC_VOZ])
        self.assertTrue(all(m["event"] == "access_token" for m in enviados))

    def test_detener_deja_la_parada_pendiente(self):
        self.c._apagar = False
        self.c._buzon = ({}, 0)
        self.c.detener()
        self.assertIsNone(self.c._buzon)
        self.c.actualizar()
        self.assertEqual([o["command"] for o in self.ejecutadas], ["led_stop"])


class PruebasGrupo(unittest.TestCase):
    def test_reparte_las_llamadas_a_cada_cliente(self):
        llamadas = []

        class Cliente:
            def __init__(self, nombre):
                self.nombre = nombre
                self.contexto = None

            def actualizar(self):
                llamadas.append((self.nombre, "actualizar"))

            def paso(self, lista):
                llamadas.append((self.nombre, "paso", lista))

            def detener(self):
                llamadas.append((self.nombre, "detener"))

            def cerrar_red(self):
                llamadas.append((self.nombre, "cerrar_red"))

        a, b = Cliente("a"), Cliente("b")
        grupo = orm.Grupo([a, None, b])
        contexto = object()
        grupo.contexto = contexto
        self.assertIs(a.contexto, contexto)
        self.assertIs(b.contexto, contexto)
        grupo.actualizar()
        grupo.paso(True)
        grupo.detener()
        grupo.cerrar_red()
        self.assertEqual([l[0] for l in llamadas], ["a", "b"] * 4)
        self.assertEqual(llamadas[2], ("a", "paso", True))

    def test_ocupado_si_algun_cliente_lo_esta(self):
        class Cliente:
            def __init__(self, ocupado):
                self._ocupado = ocupado

            def ocupado(self):
                return self._ocupado

        self.assertFalse(orm.Grupo([Cliente(False), None, Cliente(False)]).ocupado())
        self.assertTrue(orm.Grupo([Cliente(False), Cliente(True)]).ocupado())
        self.assertFalse(orm.Grupo([]).ocupado())


if __name__ == "__main__":
    unittest.main()
