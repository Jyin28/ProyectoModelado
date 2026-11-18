"""Fase 6 del colchon: parametros por armado (CA-14.5, CA-15.1) y eventos para el backend.

Todo con dobles; nada prueba el HX711, el buzzer ni la red reales.
"""
import unittest

import _ruta
import test_config_y_comandos as base
import test_control_colchon as t
from control_colchon import ControlColchon, MAX_EVENTOS

config = _ruta.config

# 1000 g de referencia; 940 g = 6 % menos; 960 g = 4 % menos.
CUENTAS_940_G = 10000 + 940 * 420
CUENTAS_960_G = 10000 + 960 * 420


class ParametrosPorArmado(t.Base):
    def test_tolerancia_y_alarma_del_armado_reemplazan_a_los_de_config(self):
        self.crear()
        self.calibrar()
        self.sensor.valor = t.CUENTAS_1000_G
        self.c.armar(None, self.t, 5, 20)
        self.assertTrue(self.completar()["ok"])
        estado = self.c.estado(self.t)
        self.assertEqual((estado["tolerancia_pct"], estado["alarma_s"]), (5, 20))
        # 6 % de perdida supera el 5 % pedido: tres lecturas disparan la alarma.
        self.segundos(3, CUENTAS_940_G)
        self.assertTrue(self.c.en_alarma())
        # La alarma pedida es de 20 s, no de 60.
        self.t += 19000
        self.avanzar()
        self.assertTrue(self.c.en_alarma())
        self.avanzar(1000)
        self.assertEqual(self.c.monitor.estado, "detenido")
        self.assertEqual(self.c.monitor.motivo_parada, "timeout_alarma")

    def test_con_tolerancia_5_una_perdida_de_4_por_ciento_no_alarma(self):
        self.crear()
        self.calibrar()
        self.sensor.valor = t.CUENTAS_1000_G
        self.c.armar(None, self.t, 5, None)
        self.completar()
        self.segundos(5, CUENTAS_960_G)
        self.assertFalse(self.c.en_alarma())

    def test_valores_invalidos_se_rechazan_antes_de_medir(self):
        self.crear()
        self.calibrar()
        lecturas = self.sensor.llamadas_leer
        malos = [(0, None), (100, None), (-5, None), (True, None), ("5", None),
                 (float("nan"), None), (None, 0), (None, -1), (None, 61),
                 (None, True), (None, "20")]
        for tolerancia, alarma in malos:
            with self.assertRaises(ValueError, msg=repr((tolerancia, alarma))):
                self.c.armar(None, self.t, tolerancia, alarma)
        self.assertFalse(self.c.captura_activa())
        self.assertEqual(self.sensor.llamadas_leer, lecturas)
        self.assertEqual(self.c.monitor.estado, "inactivo")

    def test_codigos_de_error(self):
        self.crear()
        self.calibrar()
        with self.assertRaises(ValueError) as e:
            self.c.armar(None, self.t, 100, None)
        self.assertEqual(str(e.exception), "tolerancia_invalida")
        with self.assertRaises(ValueError) as e:
            self.c.armar(None, self.t, None, 61)
        self.assertEqual(str(e.exception), "alarma_invalida")

    def test_un_rearme_sin_parametros_vuelve_a_los_valores_de_config(self):
        self.crear()
        self.calibrar()
        self.sensor.valor = t.CUENTAS_1000_G
        self.c.armar(None, self.t, 5, 20)
        self.completar()
        self.c.detener(self.t)
        self.c.rearmar(None, self.t)
        self.completar()
        estado = self.c.estado(self.t)
        self.assertEqual((estado["tolerancia_pct"], estado["alarma_s"]), (10, 60))


class EventosParaElBackend(t.Base):
    def armado(self, tolerancia=None, alarma=None, duracion=300):
        self.calibrar()
        self.sensor.valor = t.CUENTAS_1000_G
        self.c.armar(duracion, self.t, tolerancia, alarma)
        self.completar()

    def test_sin_actividad_no_hay_eventos(self):
        self.crear()
        self.avanzar(5000)
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_armar_anota_colchon_armado_con_los_valores_usados(self):
        self.crear()
        self.armado(5, 20, 120)
        eventos = self.c.sacar_eventos()
        self.assertEqual([e["tipo"] for e in eventos], ["colchon_armado"])
        self.assertEqual(eventos[0]["datos"], {
            "referencia_g": 1000.0, "duracion_s": 120, "tolerancia_pct": 5, "alarma_s": 20})
        self.assertEqual(self.c.sacar_eventos(), [])        # se entregan una sola vez

    def test_la_alarma_anota_referencia_y_ultimo_peso(self):
        self.crear()
        self.armado()
        self.c.sacar_eventos()
        self.segundos(3, t.CUENTAS_890_G)
        eventos = self.c.sacar_eventos()
        self.assertEqual([e["tipo"] for e in eventos], ["alarma_colchon"])
        self.assertEqual(eventos[0]["datos"]["referencia_g"], 1000.0)
        self.assertAlmostEqual(eventos[0]["datos"]["ultimo_peso_g"], 890, places=3)

    def test_ningun_evento_lleva_una_serie_de_lecturas(self):
        self.crear()
        self.armado()
        self.segundos(3, t.CUENTAS_890_G)
        self.c.detener(self.t)
        for evento in self.c.sacar_eventos():
            self.assertTrue(set(evento["datos"]) <= {
                "referencia_g", "duracion_s", "tolerancia_pct", "alarma_s",
                "ultimo_peso_g", "motivo"})
            for valor in evento["datos"].values():
                self.assertNotIsInstance(valor, (list, tuple, dict))

    def motivo_tras(self, accion):
        self.crear()
        self.armado(duracion=30)
        self.c.sacar_eventos()
        accion()
        eventos = [e for e in self.c.sacar_eventos() if e["tipo"] == "colchon_detenido"]
        self.assertEqual(len(eventos), 1)
        return eventos[0]["datos"]["motivo"]

    def test_motivo_app(self):
        self.assertEqual(self.motivo_tras(lambda: self.c.detener(self.t)), "app")

    def test_motivo_boton(self):
        def pulsar():
            self.boton.nivel = 0
            self.avanzar(10)
            self.avanzar(100)
        self.assertEqual(self.motivo_tras(pulsar), "boton")

    def test_motivo_duracion(self):
        self.assertEqual(self.motivo_tras(lambda: self.avanzar(31000)), "duracion")

    def test_motivo_temporizador_de_alarma(self):
        def alarmar_y_esperar():
            self.segundos(3, t.CUENTAS_890_G)
            self.avanzar(61000)
        self.assertEqual(self.motivo_tras(alarmar_y_esperar), "temporizador")

    def test_motivo_wifi(self):
        self.crear(COLCHON_REQUIERE_WIFI=True)
        self.calibrar()
        self.sensor.valor = t.CUENTAS_1000_G
        self.c.armar(300, self.t)
        self.completar()
        self.c.sacar_eventos()
        self.wifi = False
        self.avanzar(10)
        eventos = self.c.sacar_eventos()
        self.assertEqual([(e["tipo"], e["datos"]) for e in eventos],
                         [("colchon_detenido", {"motivo": "wifi"})])

    def test_la_alarma_y_su_parada_salen_en_orden(self):
        self.crear()
        self.armado()
        self.c.sacar_eventos()
        self.segundos(3, t.CUENTAS_890_G)
        self.c.detener(self.t)
        self.assertEqual([e["tipo"] for e in self.c.sacar_eventos()],
                         ["alarma_colchon", "colchon_detenido"])

    def test_apagar_no_informa_nada(self):
        self.crear()
        self.armado()
        self.c.sacar_eventos()
        self.c.apagar()
        self.avanzar(10)
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_detener_sin_monitoreo_no_crea_eventos(self):
        self.crear()
        self.c.detener(self.t)
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_la_cola_tiene_tope(self):
        self.crear()
        for _ in range(MAX_EVENTOS + 5):
            self.c._anotar("alarma_colchon", self.t, {"referencia_g": 1, "ultimo_peso_g": 1})
        self.assertEqual(len(self.c.sacar_eventos()), MAX_EVENTOS)

    def test_cada_evento_trae_la_hora_de_cuando_ocurrio(self):
        self.crear()
        self.calibrar()
        self.sensor.valor = t.CUENTAS_1000_G
        self.t = 5000
        self.c.armar(300, self.t)
        self.completar()
        antes = self.t
        evento = self.c.sacar_eventos()[0]
        self.assertTrue(5000 <= evento["ms"] <= antes)


class ComandosDelColchon(unittest.TestCase):
    def setUp(self):
        self._modulo = config.MODULO
        self.cmd, self._restaurar = base.cargar_comandos()
        config.MODULO = "colchon"
        cfg = _ruta.cfg_prueba(COLCHON_REQUIERE_WIFI=False, COLCHON_MUESTRAS_CAPTURA=3)
        self.control = ControlColchon(t.FakeSensor(), t.FakePin(0), t.FakePin(1), cfg)
        self.cmd.conectar_colchon(self.control)

    def tearDown(self):
        self.cmd.conectar_colchon(None)
        config.MODULO = self._modulo
        self._restaurar()

    def ejecutar(self, comando, **params):
        return self.cmd.ejecutar({"command_id": "t", "command": comando, "params": params})

    def test_mattress_arm_con_parametros_validos_sin_calibracion_falla_por_calibracion(self):
        r = self.ejecutar("mattress_arm", duration_s=120, tolerance_pct=5, alarm_s=20)
        self.assertEqual((r["ok"], r["error"]), (False, "sin_calibracion"))

    def test_valores_fuera_de_rango_se_rechazan_con_codigo(self):
        casos = [({"tolerance_pct": 100}, "tolerancia_invalida"),
                 ({"tolerance_pct": 0}, "tolerancia_invalida"),
                 ({"alarm_s": 0}, "alarma_invalida"),
                 ({"alarm_s": 61}, "fuera_de_rango:alarm_s"),
                 ({"tolerance_pct": "5"}, "parametro_invalido:tolerance_pct"),
                 ({"alarm_s": None}, "parametro_invalido:alarm_s")]
        for params, error in casos:
            r = self.ejecutar("mattress_arm", **params)
            self.assertFalse(r["ok"], params)
            self.assertEqual(r["error"], error, params)

    def test_arm_y_rearm_pasan_los_parametros_al_control(self):
        llamadas = []

        class Espia:
            def armar(self, duracion, ahora, tolerancia=None, alarma=None):
                llamadas.append(("armar", duracion, tolerancia, alarma))
                return {"pendiente": True}

            def rearmar(self, duracion, ahora, tolerancia=None, alarma=None):
                llamadas.append(("rearmar", duracion, tolerancia, alarma))
                return {"pendiente": True}

        self.cmd.conectar_colchon(Espia())
        self.assertTrue(self.ejecutar("mattress_arm", duration_s=90, tolerance_pct=7.5, alarm_s=30)["ok"])
        self.assertTrue(self.ejecutar("mattress_rearm")["ok"])
        self.assertEqual(llamadas, [("armar", 90, 7.5, 30), ("rearmar", None, None, None)])


if __name__ == "__main__":
    unittest.main()
