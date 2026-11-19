import unittest

import _ruta  # noqa: F401  (prepara sys.path)
import rutas


class RutasTests(unittest.TestCase):
    def buscar(self, ruta, existentes):
        return rutas.buscar(ruta, lambda r: r in existentes)

    def test_la_ruta_original_va_primero(self):
        self.assertEqual(rutas.candidatas("/common/x.der")[0], "/common/x.der")
        self.assertEqual(rutas.candidatas("prueba.wav")[0], "prueba.wav")

    def test_no_repite_candidatas(self):
        c = rutas.candidatas("/common/x.der")
        self.assertEqual(len(c), len(set(c)))

    def test_certificado_en_la_raiz(self):
        ruta = "/common/communication/gts-root-r4.der"
        self.assertEqual(self.buscar(ruta, {ruta}), ruta)

    def test_certificado_bajo_pico(self):
        ruta = "/common/communication/gts-root-r4.der"
        real = "/pico/common/communication/gts-root-r4.der"
        self.assertEqual(self.buscar(ruta, {real}), real)

    def test_wav_relativo_en_raiz_en_pico_o_en_cuna(self):
        self.assertEqual(self.buscar("prueba.wav", {"/prueba.wav"}), "/prueba.wav")
        self.assertEqual(self.buscar("prueba.wav", {"/pico/prueba.wav"}), "/pico/prueba.wav")
        self.assertEqual(self.buscar("prueba.wav", {"/pico/cuna/prueba.wav"}),
                         "/pico/cuna/prueba.wav")

    def test_si_no_existe_devuelve_la_original(self):
        self.assertEqual(self.buscar("prueba.wav", set()), "prueba.wav")

    def test_existe_con_archivo_real_y_falso(self):
        self.assertTrue(rutas.existe(__file__))
        self.assertFalse(rutas.existe(__file__ + ".no-existe"))


if __name__ == "__main__":
    unittest.main()
