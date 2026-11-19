"""HU-13 en el firmware: intervalo minimo de 2 s para las figuras y figuras independientes de la lampara."""
import sys
import types
import unittest

import _ruta

config = _ruta.config


def cargar_comandos():
    """comandos.py con figuras y lampara simuladas que registran cada llamada."""
    registro = []
    figuras = types.ModuleType("figuras")
    figuras.secuencia_actual = lambda: figuras.activa
    figuras.activa = None

    def iniciar_secuencia(nombre, intervalo):
        registro.append(("figuras.iniciar_secuencia", nombre, intervalo))
        figuras.activa = nombre

    figuras.iniciar_secuencia = iniciar_secuencia
    figuras.encender_led = lambda i, on: registro.append(("figuras.encender_led", i, on))
    figuras.todos = lambda on: registro.append(("figuras.todos", on))
    lampara = types.ModuleType("lampara")
    lampara.nivel = lambda: 0
    lampara.poner_nivel = lambda n: registro.append(("lampara.poner_nivel", n))

    nombres = ("figuras", "lampara", "comandos")
    anteriores = {n: sys.modules.get(n) for n in nombres}
    sys.modules["figuras"] = figuras
    sys.modules["lampara"] = lampara
    sys.modules.pop("comandos", None)
    import comandos

    def restaurar():
        for nombre, modulo in anteriores.items():
            if modulo is None:
                sys.modules.pop(nombre, None)
            else:
                sys.modules[nombre] = modulo

    return comandos, registro, restaurar


class IntervaloFigurasTests(unittest.TestCase):
    def setUp(self):
        self._modulo = config.MODULO
        self.addCleanup(setattr, config, "MODULO", self._modulo)
        config.MODULO = "figuras"
        self.cmd, self.registro, restaurar = cargar_comandos()
        self.addCleanup(restaurar)

    def secuencia(self, **params):
        return self.cmd.ejecutar({"command_id": "t", "command": "led_sequence", "params": params})

    def test_el_minimo_configurado_es_de_2_segundos(self):
        self.assertEqual(config.LED_INTERVALO_MINIMO_S, 2)

    def test_menos_de_2_segundos_se_rechaza_sin_tocar_los_led(self):
        for intervalo in (0, 0.5, 1, 1.9, 1.99, -2):
            r = self.secuencia(name="chase", step_s=intervalo)
            self.assertEqual((r["ok"], r["error"]), (False, "fuera_de_rango:step_s"), intervalo)
        self.assertEqual(self.registro, [])

    def test_exactamente_2_segundos_se_acepta(self):
        for intervalo in (2, 2.0):
            self.registro.clear()
            r = self.secuencia(name="chase", step_s=intervalo)
            self.assertTrue(r["ok"], intervalo)
            self.assertEqual(self.registro, [("figuras.iniciar_secuencia", "chase", intervalo)])

    def test_el_limite_superior_es_3600_segundos(self):
        self.assertTrue(self.secuencia(name="blink_all", step_s=3600)["ok"])
        r = self.secuencia(name="blink_all", step_s=3601)
        self.assertEqual((r["ok"], r["error"]), (False, "fuera_de_rango:step_s"))

    def test_un_intervalo_que_no_es_numero_se_rechaza(self):
        for intervalo in (None, "2", True, [2]):
            r = self.secuencia(name="chase", step_s=intervalo)
            self.assertEqual((r["ok"], r["error"]), (False, "parametro_invalido:step_s"), repr(intervalo))
        self.assertEqual(self.registro, [])
        self.assertEqual(self.secuencia(name="chase")["error"], "parametro_invalido:step_s")


class EncendidoManualTests(unittest.TestCase):
    """led_set y led_all exigen un booleano real en "on" (como motion_set)."""

    def setUp(self):
        self._modulo = config.MODULO
        self.addCleanup(setattr, config, "MODULO", self._modulo)
        config.MODULO = "figuras"
        self.cmd, self.registro, restaurar = cargar_comandos()
        self.addCleanup(restaurar)

    def orden(self, comando, **params):
        return self.cmd.ejecutar({"command_id": "t", "command": comando, "params": params})

    def test_on_que_no_es_booleano_se_rechaza_sin_tocar_los_led(self):
        for valor in ("false", "true", 0, 1, None, [True]):
            for comando, extra in (("led_set", {"index": 0}), ("led_all", {})):
                r = self.orden(comando, on=valor, **extra)
                self.assertEqual((r["ok"], r["error"]), (False, "parametro_invalido:on"),
                                 (comando, valor))
        self.assertEqual(self.orden("led_set", index=0)["error"], "parametro_invalido:on")
        self.assertEqual(self.registro, [])

    def test_on_booleano_se_aplica_tal_cual(self):
        self.assertTrue(self.orden("led_set", index=3, on=False)["ok"])
        self.assertTrue(self.orden("led_all", on=True)["ok"])
        self.assertEqual(self.registro, [("figuras.encender_led", 3, False), ("figuras.todos", True)])


class IndependenciaTests(unittest.TestCase):
    """El control de las figuras no mueve la lampara, y al reves."""

    def setUp(self):
        self._modulo = config.MODULO
        self.addCleanup(setattr, config, "MODULO", self._modulo)
        self.cmd, self.registro, restaurar = cargar_comandos()
        self.addCleanup(restaurar)

    def orden(self, comando, **params):
        return self.cmd.ejecutar({"command_id": "t", "command": comando, "params": params})

    def test_los_comandos_de_figuras_solo_tocan_figuras(self):
        config.MODULO = "figuras"
        self.assertTrue(self.orden("led_all", on=True)["ok"])
        self.assertTrue(self.orden("led_set", index=2, on=True)["ok"])
        self.assertTrue(self.orden("led_sequence", name="chase", step_s=2)["ok"])
        self.assertTrue(self.orden("led_stop")["ok"])
        self.assertTrue(all(llamada[0].startswith("figuras.") for llamada in self.registro), self.registro)

    def test_la_lampara_solo_toca_la_lampara(self):
        config.MODULO = "cuna"
        self.assertTrue(self.orden("lamp_set", level=40)["ok"])
        self.assertEqual(self.registro, [("lampara.poner_nivel", 40)])

    def test_un_comando_de_figuras_en_el_modulo_de_la_cuna_se_rechaza(self):
        config.MODULO = "cuna"
        for comando, params in (("led_all", {"on": True}), ("led_sequence", {"name": "chase", "step_s": 2}),
                                ("led_set", {"index": 0, "on": True}), ("led_stop", {})):
            r = self.orden(comando, **params)
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:cuna"), comando)
        self.assertEqual(self.registro, [])

    def test_lamp_set_en_el_modulo_de_figuras_se_rechaza(self):
        config.MODULO = "figuras"
        r = self.orden("lamp_set", level=100)
        self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:figuras"))
        self.assertEqual(self.registro, [])


if __name__ == "__main__":
    unittest.main()
