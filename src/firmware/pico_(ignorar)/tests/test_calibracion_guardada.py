"""El factor de calibracion del colchon sobrevive a reinicios y cambios de modulo."""
import json
import os
import tempfile
import unittest

import _ruta
import test_control_colchon as base
from almacen_calibracion import AlmacenArchivo, factor_valido
from control_colchon import ControlColchon

FACTOR = 420.0      # (430000 - 10000) / 1000 g, como en test_control_colchon


class AlmacenFalso:
    def __init__(self, factor=None, guarda=True):
        self.factor = factor
        self.guarda = guarda
        self.guardados = []

    def cargar(self):
        return self.factor

    def guardar(self, factor):
        if self.guarda:
            self.guardados.append(factor)
            self.factor = factor
        return self.guarda


class AlmacenArchivoTests(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.addCleanup(self._dir.cleanup)
        self.ruta = os.path.join(self._dir.name, "calibracion.json")

    def escribir(self, texto):
        with open(self.ruta, "w") as archivo:
            archivo.write(texto)

    def test_sin_archivo_no_hay_factor(self):
        self.assertIsNone(AlmacenArchivo(self.ruta).cargar())

    def test_guarda_y_carga_el_factor_incluso_negativo(self):
        almacen = AlmacenArchivo(self.ruta)
        for factor in (420.0, -0.0035):
            self.assertTrue(almacen.guardar(factor))
            self.assertEqual(AlmacenArchivo(self.ruta).cargar(), factor)

    def test_archivo_danado_o_incompleto_se_trata_como_sin_calibracion(self):
        for contenido in ("", "no es json", "{", "[]", "{}", '{"factor": null}',
                          '{"factor": "420"}', '{"factor": true}', '{"factor": 0}',
                          '{"factor": NaN}', '{"factor": Infinity}'):
            self.escribir(contenido)
            self.assertIsNone(AlmacenArchivo(self.ruta).cargar(), contenido)

    def test_no_guarda_factores_invalidos(self):
        almacen = AlmacenArchivo(self.ruta)
        for factor in (0, None, True, "420", float("nan"), float("inf")):
            self.assertFalse(almacen.guardar(factor), repr(factor))
        self.assertFalse(os.path.exists(self.ruta))

    def test_error_de_escritura_devuelve_false(self):
        ruta = os.path.join(self._dir.name, "no_existe", "calibracion.json")
        self.assertFalse(AlmacenArchivo(ruta).guardar(FACTOR))

    def test_solo_se_guarda_el_factor_no_la_tara(self):
        AlmacenArchivo(self.ruta).guardar(FACTOR)
        with open(self.ruta) as archivo:
            self.assertEqual(json.load(archivo), {"factor": FACTOR})

    def test_factor_valido(self):
        self.assertTrue(factor_valido(1))
        self.assertTrue(factor_valido(-2.5))
        self.assertFalse(factor_valido(0))


class ControlConAlmacen(base.Base):
    def crear_con(self, almacen):
        self.crear()
        self.almacen = almacen
        self.c = ControlColchon(self.sensor, self.buzzer, self.boton, self.cfg, almacen)

    def test_calibrar_guarda_el_factor_y_lo_informa(self):
        self.crear_con(AlmacenFalso())
        self.c.tara(self.t)
        self.completar()
        self.sensor.valor = base.CUENTAS_1000_G
        self.c.calibrar(1000, self.t)
        resultado = self.completar()
        self.assertEqual((resultado["ok"], resultado["guardado"]), (True, True))
        self.assertEqual(self.almacen.guardados, [FACTOR])

    def test_tras_reiniciar_el_factor_esta_pero_falta_la_tara(self):
        self.crear_con(AlmacenFalso(factor=FACTOR))
        self.assertEqual(self.c.calibracion.factor, FACTOR)
        self.assertFalse(self.c.estado(0)["calibrado"])       # sin tara no esta lista
        with self.assertRaises(ValueError) as e:
            self.c.armar(None, 0)
        self.assertEqual(str(e.exception), "sin_calibracion")
        self.sensor.valor = base.TARA
        self.c.tara(self.t)
        self.assertTrue(self.completar()["ok"])
        self.assertTrue(self.c.estado(self.t)["calibrado"])
        self.assertTrue(self.armar_en()["ok"])

    def test_el_factor_cargado_convierte_a_gramos_igual_que_el_calibrado(self):
        self.crear_con(AlmacenFalso(factor=FACTOR))
        self.sensor.valor = base.TARA
        self.c.tara(self.t)
        self.completar()
        self.assertEqual(self.c.calibracion.a_gramos(base.CUENTAS_900_G), 900)

    def test_sin_factor_guardado_exige_calibrar(self):
        self.crear_con(AlmacenFalso(factor=None))
        self.assertIsNone(self.c.calibracion.factor)
        self.assertFalse(self.c.estado(0)["calibrado"])

    def test_calibracion_fallida_no_pisa_el_factor_guardado(self):
        self.crear_con(AlmacenFalso(factor=FACTOR))
        self.sensor.valor = base.TARA
        self.c.tara(self.t)
        self.completar()
        self.c.calibrar(1000, self.t)           # misma lectura que la tara: sin variacion
        resultado = self.completar()
        self.assertEqual((resultado["ok"], resultado["error"]), (False, "sin_variacion"))
        self.assertEqual(self.almacen.guardados, [])
        self.assertEqual(self.almacen.factor, FACTOR)

    def test_si_no_se_puede_guardar_la_calibracion_sigue_valiendo(self):
        self.crear_con(AlmacenFalso(guarda=False))
        self.c.tara(self.t)
        self.completar()
        self.sensor.valor = base.CUENTAS_1000_G
        self.c.calibrar(1000, self.t)
        resultado = self.completar()
        self.assertEqual((resultado["ok"], resultado["guardado"]), (True, False))
        self.assertTrue(self.c.estado(self.t)["calibrado"])

    def test_sin_almacen_se_comporta_como_antes(self):
        self.crear()
        self.c.tara(self.t)
        self.completar()
        self.sensor.valor = base.CUENTAS_1000_G
        self.c.calibrar(1000, self.t)
        self.assertNotIn("guardado", self.completar())


if __name__ == "__main__":
    unittest.main()
