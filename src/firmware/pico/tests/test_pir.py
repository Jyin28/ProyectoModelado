"""Estabilizacion del PIR (60 s + 2 s en reposo), como en el codigo funcional."""
import unittest

import _ruta
import pir

config = _ruta.config


class PirTests(unittest.TestCase):
    def crear(self, estabilizacion_s=60, reposo_s=2):
        self.t = 0
        self.valor = 0
        self.mensajes = []
        self.pir = pir.EstabilizadorPIR(
            lambda: self.valor, lambda: self.t, lambda a, b: a - b,
            estabilizacion_s, reposo_s, avisar=self.mensajes.append)

    def avanzar(self, ms):
        self.t += ms
        return self.pir.actualizar()

    def test_durante_la_estabilizacion_no_informa_movimiento(self):
        self.crear()
        self.valor = 1
        for _ in range(100):
            self.assertFalse(self.avanzar(500))      # 50 s en total
        self.assertEqual(self.pir.estado, pir.ESTABILIZANDO)

    def test_pasa_a_listo_tras_60_s_y_2_s_en_reposo(self):
        self.crear()
        self.avanzar(60_000)
        self.assertEqual(self.pir.estado, pir.ESPERANDO_REPOSO)
        self.avanzar(100)                            # empieza el reposo
        self.avanzar(1_900)
        self.assertFalse(self.pir.listo)
        self.avanzar(100)
        self.assertTrue(self.pir.listo)
        self.assertIn("PIR listo. Ahora pasa la mano frente al sensor.", self.mensajes)

    def test_un_valor_alto_reinicia_la_espera_de_reposo(self):
        self.crear()
        self.avanzar(60_000)
        self.avanzar(100)
        self.avanzar(1_500)
        self.valor = 1
        self.avanzar(100)                            # reinicia
        self.valor = 0
        self.avanzar(100)
        self.avanzar(1_900)
        self.assertFalse(self.pir.listo)
        self.avanzar(200)
        self.assertTrue(self.pir.listo)

    def test_ya_listo_informa_el_movimiento_real(self):
        self.crear(estabilizacion_s=1, reposo_s=1)
        self.avanzar(1_000)
        self.avanzar(100)
        self.avanzar(1_000)
        self.assertTrue(self.pir.listo)
        self.assertFalse(self.avanzar(100))
        self.valor = 1
        self.assertTrue(self.avanzar(100))
        self.valor = 0
        self.assertFalse(self.avanzar(100))

    def test_config_usa_los_tiempos_del_codigo_funcional(self):
        self.assertEqual((config.PIR_ESTABILIZACION_S, config.PIR_REPOSO_S), (60, 2))


if __name__ == "__main__":
    unittest.main()
