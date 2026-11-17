import sys
import types
import unittest
from unittest.mock import Mock

import _ruta
import setup_colchon

config = _ruta.config


class ConfigTests(unittest.TestCase):
    def pines(self):
        return {
            "AM2301": config.PIN_AM2301, "PIR": config.PIN_PIR,
            "LAMPARA": config.PIN_LAMPARA,
            **{"LED%d" % i: p for i, p in enumerate(config.PINES_LEDS)},
            "HX711_DT": config.PIN_HX711_DT, "HX711_SCK": config.PIN_HX711_SCK,
            "BUZZER": config.PIN_BUZZER, "BOTON": config.PIN_BOTON,
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

    def test_pines_propuestos_del_colchon_y_audio(self):
        self.assertEqual((config.PIN_HX711_SCK, config.PIN_HX711_DT), (16, 17))
        self.assertEqual(config.PIN_BUZZER, 14)
        self.assertEqual(config.PIN_BOTON, 15)
        self.assertEqual(config.PIN_I2S_WS, config.PIN_I2S_BCLK + 1)

    def test_hardware_apagado_por_defecto(self):
        self.assertFalse(config.COLCHON_HABILITADO)
        self.assertFalse(config.AUDIO_HABILITADO)

    def test_valores_de_los_requisitos(self):
        self.assertEqual(config.COLCHON_TOLERANCIA_PCT, 10)
        self.assertEqual(config.COLCHON_LECTURAS_REQUERIDAS, 3)
        self.assertEqual(config.COLCHON_INTERVALO_MS, 1000)
        self.assertEqual(config.COLCHON_ALARMA_MAX_S, 60)
        self.assertTrue(config.COLCHON_REQUIERE_WIFI)

    def test_validar_pines_del_colchon(self):
        reservados = config.PINES_RESERVADOS_WIFI
        setup_colchon.validar_pines((16, 17, 14, 15), reservados)
        with self.assertRaises(ValueError):
            setup_colchon.validar_pines((16, 17, 24, 15), reservados)
        with self.assertRaises(ValueError):
            setup_colchon.validar_pines((16, 17, 14, 14), reservados)


class BuzzerPasivoTests(unittest.TestCase):
    def test_tono_usa_pwm_y_apagado_deja_gpio_en_bajo(self):
        pin = Mock()
        crear_pwm = Mock()
        buzzer = setup_colchon.BuzzerPasivo(pin, "salida", crear_pwm, 2000)
        pin.init.assert_called_once_with("salida", value=0)
        crear_pwm.assert_not_called()

        buzzer.value(1)
        buzzer.value(1)
        crear_pwm.assert_called_once_with(pin, freq=2000, duty_u16=32768)

        buzzer.value(0)
        buzzer.value(0)
        crear_pwm.return_value.deinit.assert_called_once_with()
        pin.init.assert_called_with("salida", value=0)
        self.assertEqual(pin.init.call_count, 2)

    def test_fallo_al_crear_pwm_devuelve_gpio_a_salida_baja(self):
        pin = Mock()
        crear_pwm = Mock(side_effect=OSError("sin PWM"))
        buzzer = setup_colchon.BuzzerPasivo(pin, "salida", crear_pwm, 2000)
        pin.init.reset_mock()
        with self.assertRaises(OSError):
            buzzer.value(1)
        pin.init.assert_called_once_with("salida", value=0)


class FakeColchon:
    def __init__(self):
        self.llamadas = []
        self.monitor = types.SimpleNamespace(estado="inactivo")

    def estado(self, ahora):
        return {"estado": "inactivo", "ahora": ahora}

    def tara(self, ahora):
        self.llamadas.append(("tara", ahora))
        return {"pendiente": True}

    def calibrar(self, peso, ahora):
        self.llamadas.append(("calibrar", peso))
        return {"pendiente": True}

    def armar(self, duracion, ahora):
        self.llamadas.append(("armar", duracion))
        return {"pendiente": True}

    def rearmar(self, duracion, ahora):
        self.llamadas.append(("rearmar", duracion))
        return {"pendiente": True}

    def detener(self, ahora):
        self.llamadas.append(("detener",))
        return {"detenido": True}


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


def cargar_comandos():
    """Importa comandos.py con stubs de figuras y lampara (necesitan 'machine')."""
    figuras = types.ModuleType("figuras")
    figuras.secuencia_actual = lambda: None
    lampara = types.ModuleType("lampara")
    _nivel = [0]
    lampara.nivel = lambda: _nivel[0]
    lampara.poner_nivel = lambda n: _nivel.__setitem__(0, n)
    anteriores = {n: sys.modules.get(n) for n in ("figuras", "lampara", "comandos")}
    sys.modules["figuras"] = figuras
    sys.modules["lampara"] = lampara
    sys.modules.pop("comandos", None)
    try:
        import comandos
    finally:
        for nombre, modulo in anteriores.items():
            if nombre != "comandos":
                if modulo is None:
                    sys.modules.pop(nombre, None)
                else:
                    sys.modules[nombre] = modulo
    comandos.time = types.SimpleNamespace(ticks_ms=lambda: 123)
    return comandos


class ComandosTests(unittest.TestCase):
    def setUp(self):
        self.cmd = cargar_comandos()
        self.colchon = FakeColchon()
        self.audio = FakeAudio()
        self.cmd.conectar_colchon(self.colchon)
        self.cmd.conectar_audio(self.audio)

    def tearDown(self):
        sys.modules.pop("comandos", None)

    def run_cmd(self, nombre, **params):
        return self.cmd.ejecutar({"command_id": "t", "command": nombre, "params": params})

    def test_sin_hardware_habilitado_los_comandos_fallan_con_codigo(self):
        self.cmd.conectar_colchon(None)
        self.cmd.conectar_audio(None)
        r = self.run_cmd("mattress_status")
        self.assertEqual((r["ok"], r["error"]), (False, "colchon_no_habilitado"))
        r = self.run_cmd("audio_play", sound="tono_suave")
        self.assertEqual((r["ok"], r["error"]), (False, "audio_no_habilitado"))

    def test_get_status_conserva_campos_y_agrega_colchon_y_audio(self):
        r = self.run_cmd("get_status")
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"], {"lampara": 0, "secuencia": None,
                                       "colchon": "inactivo", "audio": "inactivo"})
        self.cmd.conectar_colchon(None)
        self.cmd.conectar_audio(None)
        r = self.run_cmd("get_status")
        self.assertEqual((r["result"]["colchon"], r["result"]["audio"]), (None, None))

    def test_comandos_del_colchon(self):
        self.assertTrue(self.run_cmd("mattress_status")["ok"])
        self.assertTrue(self.run_cmd("mattress_tare")["ok"])
        self.assertTrue(self.run_cmd("mattress_calibrate", known_weight_g=1000)["ok"])
        self.assertTrue(self.run_cmd("mattress_arm")["ok"])
        self.assertTrue(self.run_cmd("mattress_arm", duration_s=120)["ok"])
        self.assertTrue(self.run_cmd("mattress_rearm")["ok"])
        self.assertTrue(self.run_cmd("mattress_stop")["ok"])
        self.assertEqual(self.colchon.llamadas, [
            ("tara", 123), ("calibrar", 1000), ("armar", None), ("armar", 120),
            ("rearmar", None), ("detener",)])

    def test_parametros_invalidos_se_rechazan_sin_llamar_al_colchon(self):
        casos = [
            ("mattress_calibrate", {}), ("mattress_calibrate", {"known_weight_g": True}),
            ("mattress_calibrate", {"known_weight_g": "1000"}),
            ("mattress_calibrate", {"known_weight_g": -5}),
            ("mattress_calibrate", {"known_weight_g": 99999}),
            ("mattress_arm", {"duration_s": None}), ("mattress_arm", {"duration_s": -1}),
            ("mattress_rearm", {"duration_s": "5"}),
            ("audio_play", {}), ("audio_play", {"sound": 5}),
        ]
        for nombre, params in casos:
            r = self.run_cmd(nombre, **params)
            self.assertFalse(r["ok"], (nombre, params))
        self.assertEqual(self.colchon.llamadas, [])
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
