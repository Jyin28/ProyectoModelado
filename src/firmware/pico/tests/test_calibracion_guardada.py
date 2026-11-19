"""El almacen del factor de calibracion (lo usa la alimentacion) sobrevive a reinicios."""
import json
import os
import tempfile
import unittest

import _ruta
from almacen_calibracion import AlmacenArchivo, factor_valido

FACTOR = 420.0      # (430000 - 10000) / 1000 g


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


if __name__ == "__main__":
    unittest.main()
