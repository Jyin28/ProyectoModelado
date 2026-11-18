import sys
import types
import unittest

import _ruta
config = _ruta.config


class ConfigTests(unittest.TestCase):
    def pines(self):
        return {
            "AM2301": config.PIN_AM2301, "PIR": config.PIN_PIR,
            "LAMPARA": config.PIN_LAMPARA,
            **{"LED%d" % i: p for i, p in enumerate(config.PINES_LEDS)},
            "I2S_BCLK": config.PIN_I2S_BCLK, "I2S_WS": config.PIN_I2S_WS,
            "I2S_DIN": config.PIN_I2S_DIN,
        }

    def test_ningun_pin_usa_gpio_del_wifi(self):
        self.assertEqual(config.PINES_RESERVADOS_WIFI, (23, 24, 25, 29))
        for nombre, pin in self.pines().items():
            self.assertNotIn(pin, (23, 24, 25, 29), nombre)

    def test_no_hay_pines_repetidos(self):
        valores = list(self.pines().values())
        self.assertEqual(len(valores), len(set(valores)))

    def test_pines_propuestos_del_audio(self):
        self.assertEqual(config.PIN_I2S_WS, config.PIN_I2S_BCLK + 1)

    def test_modulo_por_defecto_es_valido(self):
        _ruta.modulo.validar(config.MODULO)

    def test_pines_del_codigo_funcional(self):
        self.assertEqual((config.PIN_AM2301, config.PIN_PIR, config.PIN_LAMPARA), (2, 3, 13))
        self.assertEqual(config.PINES_LEDS, (6, 7, 8, 9, 10, 11))
        self.assertEqual((config.PIN_I2S_BCLK, config.PIN_I2S_WS, config.PIN_I2S_DIN), (18, 19, 20))

    def test_modulo_por_defecto_es_completo(self):
        self.assertEqual(config.MODULO, "completo")
        self.assertEqual(config.INTERVALO_AMBIENTE_S, 15)

    def test_no_queda_configuracion_del_colchon(self):
        restos = [n for n in dir(config)
                  if n.isupper() and ("COLCHON" in n or "HX711" in n or "BUZZER" in n or "BOTON" in n)]
        self.assertEqual(restos, [])


class FakeAudio:
    def __init__(self):
        self.llamadas = []

    def iniciar(self, sonido):
        self.llamadas.append(("iniciar", sonido))
        if sonido != "tono_suave":
            raise ValueError("audio_desconocido")
        return {"sound": sonido}

    def detener(self):
        self.llamadas.append(("detener",))
        return {"estado": "inactivo"}

    def estado(self):
        return {"estado": "inactivo"}


_FIGURAS_STUB = {"secuencia": None}
_PERIFERICO_A_MODULO = {"lampara": "cuna", "audio": "cuna", "figuras": "figuras"}


def cargar_comandos():
    """Importa comandos.py con stubs de figuras y lampara (necesitan 'machine').

    comandos.py las importa de forma perezosa, asi que los stubs deben seguir en
    sys.modules mientras dura la prueba. Devuelve (comandos, restaurar).
    """
    figuras = types.ModuleType("figuras")
    figuras.secuencia_actual = lambda: _FIGURAS_STUB["secuencia"]
    figuras.llamadas = []
    figuras.todos = lambda on: figuras.llamadas.append(("todos", on))
    lampara = types.ModuleType("lampara")
    _nivel = [0]
    lampara.nivel = lambda: _nivel[0]
    lampara.poner_nivel = lambda n: _nivel.__setitem__(0, n)
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

    return comandos, restaurar


class ComandosTests(unittest.TestCase):
    def setUp(self):
        self._modulo_original = config.MODULO
        self.cmd, self._restaurar = cargar_comandos()
        _FIGURAS_STUB["secuencia"] = None
        self.audio = FakeAudio()
        self.cmd.conectar_audio(self.audio)

    def tearDown(self):
        config.MODULO = self._modulo_original
        self._restaurar()

    def run_cmd(self, nombre, **params):
        """Ejecuta el comando en el modulo al que pertenece (get_status: el actual)."""
        periferico = self.cmd.modulo.periferico_de(nombre)
        if periferico is not None:
            config.MODULO = _PERIFERICO_A_MODULO[periferico]
        return self.cmd.ejecutar({"command_id": "t", "command": nombre, "params": params})

    def run_en(self, modulo, nombre, **params):
        """Ejecuta el comando con un modulo conectado concreto."""
        config.MODULO = modulo
        return self.cmd.ejecutar({"command_id": "t", "command": nombre, "params": params})

    def test_sin_hardware_habilitado_los_comandos_fallan_con_codigo(self):
        self.cmd.conectar_audio(None)
        r = self.run_cmd("audio_play", sound="tono_suave")
        self.assertEqual((r["ok"], r["error"]), (False, "audio_no_habilitado"))

    def test_get_status_conserva_campos_y_agrega_modulo_y_audio(self):
        r = self.run_en("cuna", "get_status")
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"], {"modulo": "cuna", "lampara": 0, "secuencia": None,
                                       "audio": "inactivo"})
        self.cmd.conectar_audio(None)
        r = self.run_en("cuna", "get_status")
        self.assertIsNone(r["result"]["audio"])

    def test_get_status_solo_informa_lo_que_aplica_al_modulo(self):
        _FIGURAS_STUB["secuencia"] = "chase"
        r = self.run_en("figuras", "get_status")["result"]
        self.assertEqual((r["modulo"], r["lampara"], r["secuencia"]), ("figuras", None, "chase"))
        r = self.run_en("cuna", "get_status")["result"]
        self.assertEqual((r["lampara"], r["secuencia"]), (0, None))

    def test_comandos_de_otro_modulo_se_rechazan_sin_tocar_hardware(self):
        casos = [
            ("figuras", "lamp_set", {"level": 50}),
            ("cuna", "led_all", {"on": True}),
            ("cuna", "led_sequence", {"name": "chase", "step_s": 2}),
            ("figuras", "audio_play", {"sound": "tono_suave"}), ("figuras", "audio_stop", {}),
        ]
        for modulo, nombre, params in casos:
            r = self.run_en(modulo, nombre, **params)
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:" + modulo),
                             (modulo, nombre))
        self.assertEqual(self.audio.llamadas, [])
        self.assertEqual(sys.modules["figuras"].llamadas, [])
        self.assertEqual(self.run_en("cuna", "get_status")["result"]["lampara"], 0)

    def test_modulo_invalido_rechaza_todo_menos_get_status(self):
        for nombre, params in (("lamp_set", {"level": 5}), ("led_all", {"on": True}),
                               ("audio_status", {})):
            r = self.run_en("inexistente", nombre, **params)
            self.assertEqual((r["ok"], r["error"]),
                             (False, "comando_de_otro_modulo:inexistente"))

    def test_parametros_invalidos_de_audio_se_rechazan(self):
        for nombre, params in (("audio_play", {}), ("audio_play", {"sound": 5})):
            r = self.run_cmd(nombre, **params)
            self.assertFalse(r["ok"], (nombre, params))
        self.assertEqual(self.audio.llamadas, [])

    def test_comandos_de_audio_y_error_del_catalogo(self):
        self.assertTrue(self.run_cmd("audio_play", sound="tono_suave")["ok"])
        self.assertTrue(self.run_cmd("audio_stop")["ok"])
        self.assertTrue(self.run_cmd("audio_status")["ok"])
        r = self.run_cmd("audio_play", sound="otro")
        self.assertEqual((r["ok"], r["error"]), (False, "audio_desconocido"))

    def test_comandos_previos_siguen_funcionando(self):
        r = self.run_cmd("comando_inexistente")
        self.assertEqual((r["ok"], r["error"]), (False, "comando_desconocido"))
        r = self.run_cmd("lamp_set", level=150)
        self.assertFalse(r["ok"])


if __name__ == "__main__":
    unittest.main()
