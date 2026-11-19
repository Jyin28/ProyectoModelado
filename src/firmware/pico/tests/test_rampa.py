"""Transiciones suaves de los LED (logica pura, sin hardware)."""
import unittest

import _ruta
import rampa


class RampaTests(unittest.TestCase):
    def test_primer_paso_solo_toma_la_referencia(self):
        r = rampa.Rampa(2, 400)
        r.todos(True)
        self.assertEqual(r.paso(1000), [])
        self.assertEqual(r.niveles(), (0, 0))

    def test_sube_de_forma_gradual_y_llega_al_maximo_en_la_rampa(self):
        r = rampa.Rampa(1, 400)
        r.paso(0)
        r.objetivo(0, True)
        niveles = []
        for ms in range(50, 450, 50):
            r.paso(ms)
            niveles.append(r.niveles()[0])
        self.assertEqual(niveles, sorted(niveles))
        self.assertTrue(all(b - a <= rampa.MAXIMO // 8 + 1 for a, b in zip(niveles, niveles[1:])))
        self.assertGreater(niveles[0], 0)
        self.assertLess(niveles[0], rampa.MAXIMO)
        self.assertEqual(niveles[-1], rampa.MAXIMO)

    def test_baja_de_forma_gradual(self):
        r = rampa.Rampa(1, 400)
        r.paso(0)
        r.objetivo(0, True)
        r.paso(400)
        self.assertEqual(r.niveles(), (rampa.MAXIMO,))
        r.objetivo(0, False)
        r.paso(600)
        medio = r.niveles()[0]
        self.assertGreater(medio, 0)
        self.assertLess(medio, rampa.MAXIMO)
        r.paso(800)
        self.assertEqual(r.niveles(), (0,))

    def test_cambio_de_objetivo_a_mitad_invierte_sin_saltos(self):
        r = rampa.Rampa(1, 400)
        r.paso(0)
        r.objetivo(0, True)
        r.paso(200)
        mitad = r.niveles()[0]
        r.objetivo(0, False)
        r.paso(250)
        self.assertLess(r.niveles()[0], mitad)
        self.assertGreater(r.niveles()[0], 0)

    def test_solo_informa_los_leds_que_cambian(self):
        r = rampa.Rampa(3, 400)
        r.paso(0)
        r.objetivo(1, True)
        self.assertEqual([i for i, _ in r.paso(100)], [1])
        self.assertEqual(r.paso(100), [])

    def test_funciona_con_el_contador_de_ticks_que_se_reinicia(self):
        r = rampa.Rampa(1, 400)
        limite = 1 << 30
        r.paso(limite - 100)
        r.objetivo(0, True)
        r.paso(100)
        self.assertGreater(r.niveles()[0], 0)
        self.assertLess(r.niveles()[0], rampa.MAXIMO)

    def test_indice_y_configuracion_invalidos(self):
        r = rampa.Rampa(2, 400)
        for indice in (-1, 2):
            with self.assertRaises(ValueError):
                r.objetivo(indice, True)
        for cantidad, ms in ((0, 400), (2, 0)):
            with self.assertRaises(ValueError):
                rampa.Rampa(cantidad, ms)

    def test_config_de_figuras_permite_la_secuencia_minima(self):
        config = _ruta.config
        self.assertGreater(config.LED_RAMPA_MS, 0)
        self.assertLess(config.LED_RAMPA_MS, config.LED_INTERVALO_MINIMO_S * 1000)


if __name__ == "__main__":
    unittest.main()
