"""Figuras LED: apagado inmediato al cerrar el programa (sin depender de las rampas).

Con el programa detenido nadie avanza las rampas y el PWM conserva el ultimo
brillo, asi que figuras.apagar() escribe cero en cada LED. Usa pines simulados.
"""
import os
import sys
import types
import unittest
from unittest import mock

import _ruta
import rampa

config = _ruta.config
CARPETA_FIGURAS = os.path.join(_ruta.RAIZ, "figuras-led")


class PWMFalso:
    instancias = []

    def __init__(self, pin, freq=0, duty_u16=0):
        self.pin = pin
        self.duty = duty_u16
        PWMFalso.instancias.append(self)

    def duty_u16(self, valor=None):
        if valor is None:
            return self.duty
        self.duty = valor


def cargar_figuras():
    """figuras.py con machine simulado. Devuelve (figuras, restaurar)."""
    PWMFalso.instancias = []
    maquina = types.ModuleType("machine")
    maquina.Pin = lambda numero: numero
    maquina.PWM = PWMFalso
    anteriores = {n: sys.modules.get(n) for n in ("machine", "figuras")}
    sys.modules["machine"] = maquina
    sys.modules.pop("figuras", None)
    sys.path.insert(0, CARPETA_FIGURAS)
    import figuras

    def restaurar():
        sys.path.remove(CARPETA_FIGURAS)
        for nombre, modulo in anteriores.items():
            if modulo is None:
                sys.modules.pop(nombre, None)
            else:
                sys.modules[nombre] = modulo

    return figuras, restaurar


class RampaApagarTests(unittest.TestCase):
    def test_apagar_deja_niveles_y_objetivos_en_cero_sin_rampa(self):
        r = rampa.Rampa(3, 400)
        r.paso(0)
        r.todos(True)
        r.paso(400)
        self.assertEqual(r.niveles(), (rampa.MAXIMO,) * 3)
        r.apagar()
        self.assertEqual(r.niveles(), (0, 0, 0))
        self.assertEqual(r.objetivos(), (0, 0, 0))
        self.assertEqual(r.paso(800), [])           # nada vuelve a encenderse solo


class FigurasBase(unittest.TestCase):
    """figuras.py con pines y reloj simulados (sin pruebas propias)."""

    def setUp(self):
        self.reloj = {"ms": 0}
        for nombre, funcion in (("ticks_ms", lambda: self.reloj["ms"]),
                                ("ticks_diff", lambda a, b: a - b),
                                ("ticks_add", lambda a, b: a + b)):
            parche = mock.patch.object(sys.modules["time"], nombre, funcion, create=True)
            parche.start()
            self.addCleanup(parche.stop)
        self.figuras, restaurar = cargar_figuras()
        self.addCleanup(restaurar)

    def avanzar(self, ms, pasos=1):
        for _ in range(pasos):
            self.reloj["ms"] += ms
            self.figuras.actualizar()

    def duties(self):
        return [pwm.duty for pwm in PWMFalso.instancias]


class FigurasApagarTests(FigurasBase):
    def test_los_seis_leds_se_crean_apagados(self):
        self.assertEqual(len(PWMFalso.instancias), len(config.PINES_LEDS))
        self.assertEqual(self.duties(), [0] * len(config.PINES_LEDS))

    def test_apagar_escribe_cero_en_cada_led_aunque_esten_encendidos(self):
        self.figuras.actualizar()                       # primera vuelta: toma la referencia
        self.figuras.todos(True)
        self.avanzar(100, pasos=6)                      # 600 ms > rampa de 400 ms
        self.assertEqual(self.duties(), [rampa.MAXIMO] * len(PWMFalso.instancias))
        self.figuras.apagar()
        self.assertEqual(self.duties(), [0] * len(PWMFalso.instancias))

    def test_apagar_a_mitad_de_la_rampa_no_deja_brillo_residual(self):
        self.figuras.actualizar()
        self.figuras.todos(True)
        self.avanzar(100)                               # a medio subir
        self.assertTrue(all(0 < d < rampa.MAXIMO for d in self.duties()))
        self.figuras.apagar()
        self.assertEqual(self.duties(), [0] * len(PWMFalso.instancias))
        self.avanzar(100, pasos=10)
        self.assertEqual(self.duties(), [0] * len(PWMFalso.instancias))   # sigue apagado

    def test_apagar_detiene_la_secuencia(self):
        self.figuras.actualizar()
        self.figuras.iniciar_secuencia("chase", 2)
        self.avanzar(100)                               # el primer paso ocurre enseguida
        self.assertEqual(self.figuras.secuencia_actual(), "chase")
        self.figuras.apagar()
        self.assertIsNone(self.figuras.secuencia_actual())
        self.avanzar(500, pasos=20)                     # pasan varios intervalos
        self.assertEqual(self.duties(), [0] * len(PWMFalso.instancias))


class FigurasManualTests(FigurasBase):
    """CA-13.1: encender varias figuras una por una las deja encendidas a la vez."""

    def test_encender_dos_figuras_deja_ambas_encendidas(self):
        self.figuras.actualizar()
        self.figuras.encender_led(0, True)
        self.figuras.encender_led(3, True)
        self.avanzar(100, pasos=6)                      # 600 ms > rampa de 400 ms
        duties = self.duties()
        self.assertEqual((duties[0], duties[3]), (rampa.MAXIMO, rampa.MAXIMO))
        self.assertEqual([d for i, d in enumerate(duties) if i not in (0, 3)],
                         [0] * (len(duties) - 2))

    def test_apagar_una_figura_no_apaga_las_demas(self):
        self.figuras.actualizar()
        self.figuras.todos(True)
        self.avanzar(100, pasos=6)
        self.figuras.encender_led(2, False)
        self.avanzar(100, pasos=6)
        duties = self.duties()
        self.assertEqual(duties[2], 0)
        self.assertEqual([d for i, d in enumerate(duties) if i != 2],
                         [rampa.MAXIMO] * (len(duties) - 1))

    def test_el_control_manual_reemplaza_una_secuencia_en_curso(self):
        self.figuras.actualizar()
        self.figuras.iniciar_secuencia("blink_all", 2)
        self.avanzar(100, pasos=6)                      # paso 0: todos encendidos
        self.assertEqual(self.figuras.secuencia_actual(), "blink_all")
        self.figuras.encender_led(1, True)
        self.assertIsNone(self.figuras.secuencia_actual())
        self.avanzar(100, pasos=6)
        duties = self.duties()
        self.assertEqual(duties[1], rampa.MAXIMO)
        self.assertEqual([d for i, d in enumerate(duties) if i != 1], [0] * (len(duties) - 1))
        self.avanzar(500, pasos=20)                     # la secuencia no vuelve
        self.assertEqual(self.duties(), duties)


class ConfigFigurasTests(unittest.TestCase):
    def test_pausa_del_ciclo_permite_rampas_suaves(self):
        # Al menos ~10 pasos por rampa: con 100 ms la rampa de 400 ms daba 4 saltos.
        self.assertLessEqual(config.FIGURAS_PAUSA_CICLO_MS * 10, config.LED_RAMPA_MS)
        self.assertGreaterEqual(config.FIGURAS_PAUSA_CICLO_MS, 5)


if __name__ == "__main__":
    unittest.main()
