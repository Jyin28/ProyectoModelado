"""Efectos del codigo funcional (LED y lampara) y estabilizacion del PIR."""
import unittest

import _ruta
import efectos
import pir

config = _ruta.config


class PatronesLedTests(unittest.TestCase):
    def setUp(self):
        self.pasos = efectos.pasos_patrones(6)

    def test_duracion_total_del_ciclo(self):
        # 6*150 + 1000 + 6*300 + 10*120 + (5*200 + 700) = 900+1000+1800+1200+1700
        self.assertEqual(sum(ms for _, ms in self.pasos), 6600)

    def test_cantidad_de_pasos(self):
        self.assertEqual(len(self.pasos), 6 + 2 + 6 + 10 + 6)

    def test_secuencial_enciende_un_led_por_paso(self):
        self.assertEqual(self.pasos[:6], [((i,), 150) for i in range(6)])

    def test_parpadeo_alternado_rebote_y_progresivo(self):
        self.assertEqual(self.pasos[6:8], [((0, 1, 2, 3, 4, 5), 500), ((), 500)])
        self.assertEqual(self.pasos[8:10], [((0, 2, 4), 300), ((1, 3, 5), 300)])
        rebote = [p for p, _ in self.pasos[14:24]]
        self.assertEqual(rebote, [(0,), (1,), (2,), (3,), (4,), (5,), (4,), (3,), (2,), (1,)])
        self.assertEqual(self.pasos[24:], [(tuple(range(i + 1)), 200) for i in range(5)]
                         + [((0, 1, 2, 3, 4, 5), 700)])

    def test_todos_los_indices_son_validos(self):
        for indices, ms in self.pasos:
            self.assertGreater(ms, 0)
            self.assertTrue(all(0 <= i < 6 for i in indices))


class TriangularTests(unittest.TestCase):
    def test_extremos_y_mitad(self):
        self.assertEqual(efectos.triangular_u16(0, 2600), 0)
        self.assertEqual(efectos.triangular_u16(1300, 2600), 65535)
        self.assertEqual(efectos.triangular_u16(2600, 2600), 0)

    def test_sube_y_baja_sin_salirse_del_rango(self):
        valores = [efectos.triangular_u16(t, 2600) for t in range(0, 5200, 20)]
        self.assertTrue(all(0 <= v <= 65535 for v in valores))
        self.assertEqual(valores[:66], sorted(valores[:66]))          # sube
        self.assertEqual(valores[65:131], sorted(valores[65:131], reverse=True))  # baja

    def test_periodo_invalido_da_cero(self):
        self.assertEqual(efectos.triangular_u16(500, 0), 0)
        self.assertEqual(efectos.triangular_u16(500, 1), 0)


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
