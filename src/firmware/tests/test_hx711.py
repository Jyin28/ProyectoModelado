import unittest

import _ruta  # noqa: F401
import hx711


class FakeHx711:
    """Simula DOUT/SCK: tras cada flanco de subida de SCK entrega el siguiente bit."""

    def __init__(self, palabra, listo=True):
        self.palabra = palabra
        self.esta_listo = listo
        self.pulsos = 0
        self.sck = _Sck(self)
        self.dt = _Dt(self)


class _Sck:
    def __init__(self, padre):
        self.padre = padre
        self.nivel = 0

    def value(self, v=None):
        if v is None:
            return self.nivel
        if v == 1 and self.nivel == 0:
            self.padre.pulsos += 1
        self.nivel = v


class _Dt:
    def __init__(self, padre):
        self.padre = padre

    def value(self):
        p = self.padre
        if p.pulsos == 0:
            return 0 if p.esta_listo else 1
        if p.pulsos <= 24:
            return (p.palabra >> (24 - p.pulsos)) & 1
        return 1


class Hx711Tests(unittest.TestCase):
    def setUp(self):
        self.irq = []
        self._dis, self._en = hx711.disable_irq, hx711.enable_irq
        hx711.disable_irq = lambda: self.irq.append("off") or 7
        hx711.enable_irq = lambda estado: self.irq.append(("on", estado))

    def tearDown(self):
        hx711.disable_irq, hx711.enable_irq = self._dis, self._en

    def leer(self, palabra):
        hw = FakeHx711(palabra)
        return hw, hx711.Hx711(hw.dt, hw.sck).leer()

    def test_positivo_y_negativo(self):
        self.assertEqual(self.leer(0x000123)[1], 291)
        self.assertEqual(self.leer(0xFFFFFF)[1], -1)
        self.assertEqual(self.leer(0x800001)[1], -8388607)
        self.assertEqual(self.leer(0x7FFFFE)[1], 8388606)

    def test_saturacion_es_invalida(self):
        self.assertIsNone(self.leer(0x7FFFFF)[1])
        self.assertIsNone(self.leer(0x800000)[1])

    def test_son_25_pulsos_y_sck_termina_en_bajo(self):
        hw, _ = self.leer(0x000001)
        self.assertEqual(hw.pulsos, 25)
        self.assertEqual(hw.sck.nivel, 0)

    def test_ganancia_alternativa_agrega_pulsos(self):
        hw = FakeHx711(5)
        self.assertEqual(hx711.Hx711(hw.dt, hw.sck, pulsos_extra=3).leer(), 5)
        self.assertEqual(hw.pulsos, 27)
        with self.assertRaises(ValueError):
            hx711.Hx711(hw.dt, hw.sck, pulsos_extra=4)

    def test_no_listo_salta_sin_tocar_sck(self):
        hw = FakeHx711(5, listo=False)
        sensor = hx711.Hx711(hw.dt, hw.sck)
        self.assertFalse(sensor.listo())
        self.assertIsNone(sensor.leer())
        self.assertEqual(hw.pulsos, 0)
        self.assertEqual(self.irq, [])

    def test_interrupciones_solo_durante_la_rafaga_y_se_restauran(self):
        self.leer(5)
        self.assertEqual(self.irq, ["off", ("on", 7)])

    def test_interrupciones_se_restauran_si_falla_el_pin(self):
        hw = FakeHx711(5)
        sensor = hx711.Hx711(hw.dt, hw.sck)

        def falla(v=None):
            if v is None:
                return 0
            raise OSError("pin")
        sensor._sck.value = falla
        with self.assertRaises(OSError):
            sensor.leer()
        self.assertEqual(self.irq[-1], ("on", 7))


if __name__ == "__main__":
    unittest.main()
