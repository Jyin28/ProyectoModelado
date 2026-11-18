"""Fase 9: balanza y temperatura del biberon (logica pura, control con dobles y comandos)."""
import unittest

import _ruta
import control_alimentacion as ca
import logica_alimentacion as logica
import setup_alimentacion
import test_config_y_comandos as base

config = _ruta.config

TOMA = "1111aaaa-2222-4333-8444-55555555bbbb"


def cfg(**cambios):
    return _ruta.cfg_prueba(**cambios)


class FakeSensor:
    """HX711 simulado: entrega 'crudo' cada vez que esta listo."""

    def __init__(self, crudo=1000, listo=True):
        self.crudo = crudo
        self.esta_listo = listo
        self.lecturas = 0

    def listo(self):
        return self.esta_listo

    def leer(self):
        self.lecturas += 1
        if isinstance(self.crudo, Exception):
            raise self.crudo
        return self.crudo


class FakeTermometro:
    def __init__(self, valor=37.5):
        self.valor = valor
        self.conversiones = 0
        self.falla_convertir = False

    def convertir(self):
        if self.falla_convertir:
            raise OSError("sin sonda")
        self.conversiones += 1

    def leer(self):
        if isinstance(self.valor, Exception):
            raise self.valor
        return self.valor


class FakeAlmacen:
    def __init__(self, factor=None):
        self.factor = factor
        self.guardados = []

    def cargar(self):
        return self.factor

    def guardar(self, factor):
        self.guardados.append(factor)
        self.factor = factor
        return True


# Con tara 1000 y factor 10 cuentas por gramo: crudo 3000 son 200 g.
def crudo_de(gramos, tara=1000, factor=10):
    return tara + gramos * factor


class LogicaTests(unittest.TestCase):
    def test_toma_id_valido(self):
        self.assertTrue(logica.toma_id_valido(TOMA))
        for malo in (None, 5, "", TOMA.upper(), TOMA[:-1], TOMA + "0", TOMA.replace("-", "_"),
                     TOMA[:35] + "g", "x" * 36):
            self.assertFalse(logica.toma_id_valido(malo), repr(malo))

    def test_momentos(self):
        for m in ("inicial", "control", "final"):
            self.assertTrue(logica.momento_valido(m))
        for m in ("", "otro", None, 1, "Inicial"):
            self.assertFalse(logica.momento_valido(m))

    def test_evaluar_peso(self):
        ev = lambda g, m: logica.evaluar_peso(g, m, 2.0, 1000.0)
        self.assertEqual(ev(200.04, "inicial"), (200.0, None))
        self.assertEqual(ev(150.06, "final"), (150.1, None))
        self.assertEqual(ev(None, "inicial"), (None, "sin_calibracion"))
        # Con recipiente el inicial y el final deben superar el minimo.
        self.assertEqual(ev(1.9, "inicial"), (None, "sin_lectura"))
        self.assertEqual(ev(-5.0, "final"), (None, "sin_lectura"))
        self.assertEqual(ev(2.0, "inicial"), (2.0, None))
        # El de control puede ser 0 y un pequeno negativo es ruido, no un peso.
        self.assertEqual(ev(0.0, "control"), (0.0, None))
        self.assertEqual(ev(-1.2, "control"), (0.0, None))
        # Fuera del rango de la celda o no numerico: sin lectura.
        for g in (1000.1, float("inf"), float("nan")):
            for m in ("inicial", "control", "final"):
                self.assertEqual(ev(g, m), (None, "sin_lectura"), (g, m))
        self.assertEqual(ev(1000.0, "inicial"), (1000.0, None))

    def test_temperatura_informable(self):
        self.assertEqual(logica.temperatura_informable(37.456), 37.46)
        self.assertEqual(logica.temperatura_informable(-55), -55)
        self.assertEqual(logica.temperatura_informable(125), 125)
        for malo in (85.0, 125.1, -55.1, None, float("nan"), float("inf"), "37", True):
            self.assertIsNone(logica.temperatura_informable(malo), repr(malo))


class ControlBase(unittest.TestCase):
    def crear(self, sensor=None, termometro=False, almacen=None, **cambios):
        self.sensor = sensor or FakeSensor(crudo_de(200))
        self.term = FakeTermometro() if termometro is False else termometro
        self.almacen = almacen
        cambios.setdefault("ALIMENTACION_TARA_AL_INICIAR", False)
        self.cfg = cfg(**cambios)
        self.c = ca.ControlAlimentacion(self.sensor, self.term, self.cfg, almacen)
        self.t = 0

    def setUp(self):
        self.crear(almacen=FakeAlmacen(10.0))
        self.c.calibracion.tara = 1000.0     # factor 10 cuentas/g

    def avanzar(self, ms=20, pasos=1):
        for _ in range(pasos):
            self.t += ms
            self.c.actualizar(self.t)

    def terminar_captura(self, limite=100):
        for _ in range(limite):
            if not self.c.captura_activa():
                return
            self.avanzar()
        self.fail("la captura no termino")

    def pesar(self, momento="inicial", toma=TOMA):
        r = self.c.pesar(toma, momento, self.t)
        self.terminar_captura()
        return r

    def solo_pesos(self):
        return [e for e in self.c.sacar_eventos() if e["tipo"] != "temperatura_biberon"]


class PesajeTests(ControlBase):
    def test_pesar_responde_pendiente_y_deja_un_evento_con_gramos(self):
        r = self.c.pesar(TOMA, "inicial", self.t)
        self.assertEqual(r, {"pendiente": True, "momento": "inicial"})
        self.assertEqual(self.c.sacar_eventos(), [], "el peso no se adelanta a la medicion")
        self.terminar_captura()
        eventos = self.solo_pesos()
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0]["tipo"], "peso_alimentacion")
        self.assertEqual(eventos[0]["datos"], {"toma_id": TOMA, "momento": "inicial", "gramos": 200.0})
        self.assertEqual(self.sensor.lecturas, self.cfg.ALIMENTACION_MUESTRAS_PESO)

    def test_cada_momento_lleva_su_nombre(self):
        for momento in ("inicial", "control", "final"):
            self.pesar(momento)
        eventos = self.solo_pesos()
        self.assertEqual([e["datos"]["momento"] for e in eventos], ["inicial", "control", "final"])

    def test_promedia_las_lecturas(self):
        lecturas = iter([crudo_de(190), crudo_de(210)] * 5)
        sensor = FakeSensor()
        sensor.leer = lambda: next(lecturas)
        self.crear(sensor=sensor, almacen=FakeAlmacen(10.0))
        self.c.calibracion.tara = 1000.0
        self.pesar("final")
        self.assertEqual(self.solo_pesos()[0]["datos"]["gramos"], 200.0)

    def test_sin_calibracion_informa_el_motivo_y_no_pesa(self):
        self.crear(almacen=FakeAlmacen(None))
        self.c.calibracion.tara = 1000.0
        r = self.c.pesar(TOMA, "inicial", self.t)
        self.assertTrue(r["pendiente"])
        eventos = self.c.sacar_eventos()
        self.assertEqual([e["tipo"] for e in eventos], ["peso_alimentacion_fallido"])
        self.assertEqual(eventos[0]["datos"], {"toma_id": TOMA, "momento": "inicial", "motivo": "sin_calibracion"})
        self.assertEqual(self.sensor.lecturas, 0)

    def test_sin_tara_tampoco_hay_gramos(self):
        self.crear(almacen=FakeAlmacen(10.0))          # factor si, tara no
        self.c.pesar(TOMA, "final", self.t)
        self.assertEqual(self.c.sacar_eventos()[0]["datos"]["motivo"], "sin_calibracion")

    def test_lectura_invalida_o_sensor_mudo_informa_sin_lectura(self):
        for sensor in (FakeSensor(None), FakeSensor(OSError("x")), FakeSensor(listo=False)):
            self.crear(sensor=sensor, almacen=FakeAlmacen(10.0))
            self.c.calibracion.tara = 1000.0
            self.c.pesar(TOMA, "inicial", self.t)
            for _ in range(self.cfg.ALIMENTACION_CAPTURA_TIMEOUT_MS // 20 + 5):
                self.avanzar()
            eventos = self.solo_pesos()
            self.assertEqual(len(eventos), 1)
            self.assertEqual(eventos[0]["tipo"], "peso_alimentacion_fallido")
            self.assertEqual(eventos[0]["datos"]["motivo"], "sin_lectura")
            self.assertFalse(self.c.captura_activa())

    def test_un_peso_que_no_corresponde_a_un_recipiente_no_se_inventa(self):
        self.crear(sensor=FakeSensor(crudo_de(0.5)), almacen=FakeAlmacen(10.0))
        self.c.calibracion.tara = 1000.0
        self.pesar("inicial")
        self.assertEqual(self.solo_pesos()[0]["datos"]["motivo"], "sin_lectura")
        # Con el biberon devuelto vacio el control si se informa.
        self.pesar("control")
        self.assertEqual(self.solo_pesos()[0]["datos"]["gramos"], 0.5)

    def test_parametros_invalidos_se_rechazan_sin_medir(self):
        for toma, momento, codigo in ((None, "inicial", "parametro_invalido:toma_id"),
                                      ("x", "inicial", "parametro_invalido:toma_id"),
                                      (TOMA.upper(), "inicial", "parametro_invalido:toma_id"),
                                      (TOMA, "otro", "parametro_invalido:momento"),
                                      (TOMA, None, "parametro_invalido:momento")):
            with self.assertRaises(ValueError) as e:
                self.c.pesar(toma, momento, self.t)
            self.assertEqual(str(e.exception), codigo)
        self.assertFalse(self.c.captura_activa())
        self.assertEqual(self.sensor.lecturas, 0)

    def test_un_pesaje_a_la_vez(self):
        self.c.pesar(TOMA, "inicial", self.t)
        with self.assertRaises(ValueError) as e:
            self.c.pesar(TOMA, "control", self.t)
        self.assertEqual(str(e.exception), "captura_en_curso")
        self.terminar_captura()
        self.assertEqual(len(self.solo_pesos()), 1)

    def test_la_lista_tiene_tope_y_descarta_la_mas_antigua(self):
        for _ in range(ca.MAX_EVENTOS + 3):
            self.pesar("control")
        eventos = self.c.sacar_eventos()
        self.assertEqual(len(eventos), ca.MAX_EVENTOS)
        self.assertEqual([e["ms"] for e in eventos], sorted(e["ms"] for e in eventos))

    def test_apagar_cancela_la_captura(self):
        self.c.pesar(TOMA, "inicial", self.t)
        self.c.apagar()
        self.assertFalse(self.c.captura_activa())
        self.avanzar(20, 5)
        self.assertEqual(self.solo_pesos(), [])


class CalibracionTests(ControlBase):
    def test_la_tara_al_iniciar_toma_el_cero_con_la_balanza_vacia(self):
        self.crear(sensor=FakeSensor(1234), almacen=FakeAlmacen(10.0), ALIMENTACION_TARA_AL_INICIAR=True)
        self.avanzar()
        self.assertEqual(self.c.estado()["captura"], "tara")
        self.terminar_captura()
        self.assertEqual(self.c.calibracion.tara, 1234)
        self.assertTrue(self.c.estado()["calibrado"])
        self.assertTrue(self.c.ultimo_resultado["ok"])

    def test_sin_tara_al_iniciar_no_mide_nada(self):
        self.avanzar(20, 5)
        self.assertEqual(self.sensor.lecturas, 0)

    def test_calibrar_guarda_el_factor_en_el_almacen_propio(self):
        self.crear(sensor=FakeSensor(1000), almacen=FakeAlmacen(None))
        self.c.tarar(self.t)
        self.terminar_captura()
        self.sensor.crudo = 3000
        self.c.calibrar(200, self.t)
        self.terminar_captura()
        self.assertEqual(self.c.calibracion.factor, 10.0)
        self.assertEqual(self.almacen.guardados, [10.0])
        self.assertTrue(self.c.ultimo_resultado["guardado"])

    def test_calibrar_exige_tara_y_peso_valido(self):
        self.crear(almacen=FakeAlmacen(None))
        for peso, codigo in ((200, "falta_tara"),):
            with self.assertRaises(ValueError) as e:
                self.c.calibrar(peso, self.t)
            self.assertEqual(str(e.exception), codigo)
        self.c.calibracion.tara = 1000.0
        for peso in (0, -5, None, "200", float("nan")):
            with self.assertRaises(ValueError) as e:
                self.c.calibrar(peso, self.t)
            self.assertEqual(str(e.exception), "peso_invalido")

    def test_sin_variacion_no_cambia_el_factor(self):
        self.crear(sensor=FakeSensor(1000), almacen=FakeAlmacen(10.0))
        self.c.calibracion.tara = 1000.0
        self.c.calibrar(200, self.t)
        self.terminar_captura()
        self.assertEqual(self.c.calibracion.factor, 10.0)
        self.assertEqual((self.c.ultimo_resultado["ok"], self.c.ultimo_resultado["error"]), (False, "sin_variacion"))
        self.assertEqual(self.almacen.guardados, [])

    def test_el_factor_guardado_se_carga_pero_la_tara_se_toma_de_nuevo(self):
        self.crear(almacen=FakeAlmacen(7.5))
        self.assertEqual(self.c.calibracion.factor, 7.5)
        self.assertIsNone(self.c.calibracion.tara)
        self.assertFalse(self.c.estado()["calibrado"])


class TemperaturaTests(ControlBase):
    def temperaturas(self):
        return [e for e in self.c.sacar_eventos() if e["tipo"] == "temperatura_biberon"]

    def test_mide_cada_intervalo_y_espera_la_conversion(self):
        self.avanzar()
        self.assertEqual(self.term.conversiones, 1)
        self.assertEqual(self.temperaturas(), [], "la lectura espera a que termine la conversion")
        self.avanzar(self.cfg.ALIMENTACION_CONVERSION_TEMP_MS)
        eventos = self.temperaturas()
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0]["datos"], {"temperatura_c": 37.5})
        self.assertEqual(self.c.estado()["temperatura_c"], 37.5)
        # No vuelve a medir hasta cumplir el intervalo.
        self.avanzar(1000, 5)
        self.assertEqual(self.term.conversiones, 1)
        self.avanzar(self.cfg.ALIMENTACION_INTERVALO_TEMP_S * 1000)
        self.avanzar(self.cfg.ALIMENTACION_CONVERSION_TEMP_MS)
        self.assertEqual(len(self.temperaturas()), 1)
        self.assertEqual(self.term.conversiones, 2)

    def test_el_evento_lleva_la_hora_de_la_medicion(self):
        self.avanzar(100)
        medido = self.t
        self.avanzar(self.cfg.ALIMENTACION_CONVERSION_TEMP_MS)
        self.assertEqual(self.temperaturas()[0]["ms"], medido)

    def test_lecturas_que_no_son_mediciones_no_se_informan(self):
        for valor in (85.0, None, float("nan"), 200.0, OSError("x")):
            self.crear(termometro=FakeTermometro(valor))
            self.avanzar()
            self.avanzar(self.cfg.ALIMENTACION_CONVERSION_TEMP_MS)
            self.assertEqual(self.temperaturas(), [], repr(valor))
            self.assertIsNone(self.c.estado()["temperatura_c"])

    def test_si_la_sonda_no_responde_reintenta_en_el_siguiente_intervalo(self):
        self.term.falla_convertir = True
        self.avanzar()
        self.avanzar(self.cfg.ALIMENTACION_CONVERSION_TEMP_MS)
        self.assertEqual(self.temperaturas(), [])
        self.term.falla_convertir = False
        self.avanzar(self.cfg.ALIMENTACION_INTERVALO_TEMP_S * 1000)
        self.avanzar(self.cfg.ALIMENTACION_CONVERSION_TEMP_MS)
        self.assertEqual(len(self.temperaturas()), 1)

    def test_sin_sonda_no_hay_temperatura_ni_error(self):
        self.crear(termometro=None)
        self.avanzar(1000, 5)
        self.assertEqual(self.c.sacar_eventos(), [])
        self.assertFalse(self.c.estado()["sonda"])

    def test_el_pesaje_y_la_temperatura_conviven(self):
        self.c.pesar(TOMA, "inicial", self.t)
        self.avanzar(100, 20)
        tipos = sorted(e["tipo"] for e in self.c.sacar_eventos())
        self.assertEqual(tipos, ["peso_alimentacion", "temperatura_biberon"])

    def test_vuelta_del_contador_de_milisegundos(self):
        tope = 1 << 30
        self.c.actualizar(tope - 100)
        self.c.actualizar((tope - 100 + self.cfg.ALIMENTACION_CONVERSION_TEMP_MS) & (tope - 1))
        self.assertEqual(len(self.temperaturas()), 1)


class SinActuadoresTests(unittest.TestCase):
    def test_el_control_no_tiene_ninguna_salida(self):
        publicos = [n for n in dir(ca.ControlAlimentacion) if not n.startswith("_")]
        for nombre in publicos:
            self.assertNotRegex(nombre, r"calent|calor|enfri|suministr|dispens|motor|bomba|valvula|heat|cool")
        self.assertEqual(sorted(publicos), ["actualizar", "apagar", "calibrar", "captura_activa",
                                            "estado", "pesar", "sacar_eventos", "tarar"])


class SondaTests(unittest.TestCase):
    def test_convierte_y_lee_la_sonda_encontrada(self):
        class DS:
            def __init__(self):
                self.llamadas = []

            def convert_temp(self):
                self.llamadas.append("convert")

            def read_temp(self, rom):
                self.llamadas.append(("read", rom))
                return 36.9

        ds = DS()
        sonda = setup_alimentacion.SondaDS18B20(ds, b"\x28rom")
        sonda.convertir()
        self.assertEqual(sonda.leer(), 36.9)
        self.assertEqual(ds.llamadas, ["convert", ("read", b"\x28rom")])

    def test_validar_pines(self):
        reservados = config.PINES_RESERVADOS_WIFI
        setup_alimentacion.validar_pines((17, 16, 4), reservados)
        with self.assertRaises(ValueError):
            setup_alimentacion.validar_pines((17, 16, 24), reservados)
        with self.assertRaises(ValueError):
            setup_alimentacion.validar_pines((17, 17, 4), reservados)

    def test_deshabilitada_por_defecto_y_con_archivo_propio(self):
        self.assertFalse(config.ALIMENTACION_HABILITADO)
        self.assertNotEqual(config.ARCHIVO_CALIBRACION_ALIMENTACION, config.ARCHIVO_CALIBRACION)


class ComandosAlimentacionTests(unittest.TestCase):
    def setUp(self):
        self._modulo = config.MODULO
        self.cmd, self._restaurar = base.cargar_comandos()
        self.sensor = FakeSensor(crudo_de(150))
        self.control = ca.ControlAlimentacion(
            self.sensor, FakeTermometro(), cfg(ALIMENTACION_TARA_AL_INICIAR=False), FakeAlmacen(10.0))
        self.control.calibracion.tara = 1000.0
        self.cmd.conectar_alimentacion(self.control)

    def tearDown(self):
        config.MODULO = self._modulo
        self.cmd.conectar_alimentacion(None)
        self._restaurar()

    def ejecutar(self, modulo, comando="feeding_weigh", **params):
        config.MODULO = modulo
        return self.cmd.ejecutar({"command_id": "t", "command": comando, "params": params})

    def test_feeding_weigh_responde_pendiente_y_el_peso_llega_como_evento(self):
        r = self.ejecutar("alimentacion", toma_id=TOMA, momento="final")
        self.assertEqual((r["ok"], r["result"]), (True, {"pendiente": True, "momento": "final"}))
        t = 0
        while self.control.captura_activa():
            t += 20
            self.control.actualizar(t)
        eventos = self.control.sacar_eventos()
        self.assertEqual(eventos[0]["datos"], {"toma_id": TOMA, "momento": "final", "gramos": 150.0})

    def test_valida_los_parametros(self):
        for params, error in (({"momento": "final"}, "parametro_invalido:toma_id"),
                              ({"toma_id": 5, "momento": "final"}, "parametro_invalido:toma_id"),
                              ({"toma_id": "no-es-uuid", "momento": "final"}, "parametro_invalido:toma_id"),
                              ({"toma_id": TOMA}, "parametro_invalido:momento"),
                              ({"toma_id": TOMA, "momento": "otro"}, "parametro_invalido:momento")):
            r = self.ejecutar("alimentacion", **params)
            self.assertEqual((r["ok"], r["error"]), (False, error), params)
        self.assertFalse(self.control.captura_activa())

    def test_un_pesaje_en_curso_rechaza_otro(self):
        self.ejecutar("alimentacion", toma_id=TOMA, momento="inicial")
        r = self.ejecutar("alimentacion", toma_id=TOMA, momento="control")
        self.assertEqual((r["ok"], r["error"]), (False, "captura_en_curso"))

    def test_sin_hardware_falla_con_codigo(self):
        self.cmd.conectar_alimentacion(None)
        r = self.ejecutar("alimentacion", toma_id=TOMA, momento="inicial")
        self.assertEqual((r["ok"], r["error"]), (False, "alimentacion_no_habilitada"))

    def test_en_otro_modulo_se_rechaza_sin_tocar_nada(self):
        for otro in ("cuna", "colchon", "figuras", "habitacion", "juego"):
            r = self.ejecutar(otro, toma_id=TOMA, momento="inicial")
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:" + otro))
        self.assertFalse(self.control.captura_activa())
        self.assertEqual(self.sensor.lecturas, 0)

    def test_los_comandos_de_otros_modulos_no_valen_en_alimentacion(self):
        for comando in ("lamp_set", "led_stop", "mattress_stop", "motion_set", "room_monitor_set"):
            r = self.ejecutar("alimentacion", comando=comando)
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:alimentacion"), comando)

    def test_get_status_incluye_la_alimentacion_solo_en_ese_modulo(self):
        config.MODULO = "alimentacion"
        r = self.cmd.ejecutar({"command_id": "t", "command": "get_status", "params": {}})
        self.assertTrue(r["result"]["alimentacion"]["calibrado"])
        self.assertTrue(r["result"]["alimentacion"]["sonda"])
        config.MODULO = "habitacion"
        r = self.cmd.ejecutar({"command_id": "t", "command": "get_status", "params": {}})
        self.assertNotIn("alimentacion", r["result"])


if __name__ == "__main__":
    unittest.main()
