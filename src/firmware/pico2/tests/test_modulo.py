"""Selector de modulo: una sola Pico, conectada a un modulo por vez."""
import sys
import unittest

import _ruta

config = _ruta.config
modulo = _ruta.modulo


class ModuloTests(unittest.TestCase):
    def setUp(self):
        self._original = config.MODULO
        self.addCleanup(setattr, config, "MODULO", self._original)

    def test_cada_modulo_activa_solo_sus_perifericos(self):
        esperado = {
            "cuna": {"ambiente", "movimiento", "lampara", "audio"},
            "colchon": {"colchon"},
            "figuras": {"figuras"},
        }
        todos = set().union(*esperado.values())
        for nombre, propios in esperado.items():
            config.MODULO = nombre
            for periferico in todos:
                self.assertEqual(modulo.usa(periferico), periferico in propios,
                                 (nombre, periferico))

    def test_ningun_periferico_pertenece_a_dos_modulos(self):
        vistos = []
        for lista in modulo.PERIFERICOS.values():
            vistos.extend(lista)
        self.assertEqual(len(vistos), len(set(vistos)))

    def test_validar_acepta_los_tres_modulos(self):
        for nombre in ("cuna", "colchon", "figuras"):
            self.assertEqual(modulo.validar(nombre), nombre)

    def test_validar_sin_argumento_usa_config(self):
        config.MODULO = "colchon"
        self.assertEqual(modulo.validar(), "colchon")

    def test_validar_rechaza_valores_desconocidos(self):
        for nombre in ("", "Cuna", "todo", None, 3, "cuna "):
            config.MODULO = nombre
            with self.assertRaises(ValueError, msg=repr(nombre)):
                modulo.validar()

    def test_un_modulo_invalido_no_usa_ningun_periferico(self):
        config.MODULO = "todo"
        for lista in modulo.PERIFERICOS.values():
            for periferico in lista:
                self.assertFalse(modulo.usa(periferico))

    def test_todos_los_comandos_apuntan_a_un_periferico_existente(self):
        existentes = {p for lista in modulo.PERIFERICOS.values() for p in lista}
        for comando, periferico in modulo._COMANDOS.items():
            self.assertIn(periferico, existentes, comando)

    def test_get_status_no_pertenece_a_ningun_modulo(self):
        self.assertIsNone(modulo.periferico_de("get_status"))
        self.assertIsNone(modulo.periferico_de("comando_inexistente"))


class DemoPorModuloTests(unittest.TestCase):
    def setUp(self):
        self._original = config.MODULO
        self.addCleanup(setattr, config, "MODULO", self._original)
        self._previos = {n: sys.modules.get(n) for n in ("demo", "comandos")}
        sys.modules.pop("demo", None)
        sys.modules.pop("comandos", None)
        import demo
        self.demo = demo
        self.addCleanup(self._restaurar)

    def _restaurar(self):
        for nombre, mod in self._previos.items():
            if mod is None:
                sys.modules.pop(nombre, None)
            else:
                sys.modules[nombre] = mod

    def test_la_demo_de_cada_modulo_solo_usa_comandos_de_ese_modulo(self):
        for nombre in ("cuna", "figuras"):
            config.MODULO = nombre
            ordenes = self.demo.ordenes()
            self.assertTrue(ordenes, nombre)
            for orden in ordenes:
                necesario = modulo.periferico_de(orden["command"])
                if necesario is not None:
                    config.MODULO = nombre
                    self.assertTrue(modulo.usa(necesario), (nombre, orden["command"]))

    def test_el_colchon_no_tiene_demo(self):
        config.MODULO = "colchon"
        self.assertEqual(self.demo.ordenes(), [])

    def test_modulo_invalido_no_tiene_demo(self):
        config.MODULO = "todo"
        self.assertEqual(self.demo.ordenes(), [])


if __name__ == "__main__":
    unittest.main()
