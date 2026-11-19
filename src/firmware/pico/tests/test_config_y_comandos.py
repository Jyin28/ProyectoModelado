import os
import re
import sys
import types
import unittest

import _ruta

config = _ruta.config


def pines_del_colchon():
    """Pines de colchon/setup_colchon.py. Se leen del texto: el modulo necesita 'machine'."""
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "colchon", "setup_colchon.py")
    with open(ruta, encoding="utf-8") as archivo:
        texto = archivo.read()
    nombres = {"HX711_DT": "HX711_DT", "HX711_SCK": "HX711_SCK",
               "BUZZER": "BUZZER_PIN", "BOTON": "BUTTON_PIN"}
    return {rotulo: int(re.search(r"^%s\s*=\s*(\d+)" % constante, texto, re.M).group(1))
            for rotulo, constante in nombres.items()}


class ConfigTests(unittest.TestCase):
    def pines_por_modulo(self):
        """Pines de cada modulo. Solo deben ser unicos dentro de un mismo modulo:
        la Pico atiende un modulo por vez (docs/Sprint4/diseno-fisico.md 5)."""
        return {
            "cuna": {
                "AM2301": config.PIN_AM2301, "PIR": config.PIN_PIR,
                "LAMPARA": config.PIN_LAMPARA,
                "I2S_BCLK": config.PIN_I2S_BCLK, "I2S_WS": config.PIN_I2S_WS,
                "I2S_DIN": config.PIN_I2S_DIN,
            },
            "figuras": {"LED%d" % i: p for i, p in enumerate(config.PINES_LEDS)},
            "colchon": pines_del_colchon(),
            "habitacion": {
                "PUERTA": config.PIN_PUERTA, "PIR_HABITACION": config.PIN_PIR_HABITACION,
            },
            "alimentacion": {
                "HX711_DT": config.PIN_ALIMENTACION_DT, "HX711_SCK": config.PIN_ALIMENTACION_SCK,
                "DS18B20": config.PIN_DS18B20,
            },
            "juego": {
                **{"BOTON%d" % i: p for i, p in enumerate(config.PINES_JUEGO_BOTONES)},
                **{"LED%d" % i: p for i, p in enumerate(config.PINES_JUEGO_LEDS)},
                "BUZZER": config.PIN_JUEGO_BUZZER,
            },
        }

    def pines(self):
        """Todos los pines con su modulo, solo para revisar los GPIO del WiFi."""
        return {"%s.%s" % (m, n): p for m, d in self.pines_por_modulo().items()
                for n, p in d.items()}

    def test_ningun_pin_usa_gpio_del_wifi(self):
        self.assertEqual(config.PINES_RESERVADOS_WIFI, (23, 24, 25, 29))
        for nombre, pin in self.pines().items():
            self.assertNotIn(pin, (23, 24, 25, 29), nombre)

    def test_no_hay_pines_repetidos_dentro_de_cada_modulo(self):
        for nombre, pines in self.pines_por_modulo().items():
            valores = list(pines.values())
            self.assertEqual(len(valores), len(set(valores)), nombre)

    def test_pines_de_la_habitacion_son_los_propuestos(self):
        self.assertEqual((config.PIN_PUERTA, config.PIN_PIR_HABITACION), (4, 5))
        self.assertFalse(config.HABITACION_HABILITADO)

    def test_pines_del_colchon_son_los_de_setup_colchon(self):
        self.assertEqual(pines_del_colchon(),
                         {"HX711_DT": 13, "HX711_SCK": 12, "BUZZER": 18, "BOTON": 19})

    def test_pines_propuestos_del_audio(self):
        self.assertEqual(config.PIN_I2S_WS, config.PIN_I2S_BCLK + 1)

    def test_modulo_por_defecto_es_valido(self):
        _ruta.modulo.validar(config.MODULO)

    def test_audio_y_voz_habilitados_en_la_cuna(self):
        self.assertTrue(config.AUDIO_HABILITADO)
        self.assertTrue(config.VOZ_HABILITADA, 'la voz exige el audio habilitado (main.preparar_voz)')

    def test_valores_del_colchon(self):
        self.assertEqual(config.DEVICE_ID, "pico-figuras-colchon-01")
        self.assertEqual(config.ALARMA_S, 60)
        self.assertEqual(config.TOLERANCIA_PESO_PCT, 10)
        self.assertTrue(config.EXIGIR_CONEXION)
        for nombre in ("REFERENCIA_MINIMA_G", "MUESTRAS_REFERENCIA", "REFERENCIA_VARIACION_MAX_PCT",
                       "FALLOS_LECTURA_MAX", "PESO_REFERENCIA_G", "ARCHIVO_CALIBRACION",
                       "HTTP_TIMEOUT_S", "HTTP_TIMEOUT_ALARMA_S", "COLA_MAX", "ENVIOS_FALLIDOS_MAX", "REINTENTO_ENVIO_S",
                       "REINTENTO_HX711_S"):
            self.assertTrue(hasattr(config, nombre), nombre)


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
_PERIFERICO_A_MODULO = {"lampara": "cuna", "audio": "cuna",
                        "figuras": "figuras", "colchon": "colchon",
                        "habitacion": "habitacion"}


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
    monitoreo = types.ModuleType("monitoreo")
    monitoreo.ALARMA = "alarm"
    monitoreo.llamadas = []
    monitoreo.situacion = {"estado": "stopped", "activo": False}
    monitoreo._s = {"referencia_g": 1000.0}
    monitoreo.estado = lambda: monitoreo.situacion["estado"]
    monitoreo.activo = lambda: monitoreo.situacion["activo"]
    monitoreo.resumen = lambda: {"state": monitoreo.situacion["estado"]}
    monitoreo.capturar_referencia = lambda: (monitoreo.llamadas.append(("capturar",)) or 1000.0)
    monitoreo.fijar_referencia = lambda g: (monitoreo.llamadas.append(("fijar", g)) or g)
    monitoreo.iniciar = lambda d, t, a: monitoreo.llamadas.append(("iniciar", d, t, a))
    monitoreo.detener = lambda motivo: (monitoreo.llamadas.append(("detener", motivo)) or True)
    monitoreo.notificar_inactivo = lambda m: monitoreo.llamadas.append(("inactivo", m))
    peso = types.ModuleType("peso")
    peso.llamadas = []
    peso.tomar_tara = lambda: (peso.llamadas.append(("tara",)) or True)
    peso.calibrar = lambda g: (peso.llamadas.append(("calibrar", g)) or 420.0)
    setup_colchon = types.ModuleType("setup_colchon")
    setup_colchon.MONITORING_TIME = 300
    nombres = ("figuras", "lampara", "comandos", "monitoreo", "peso", "setup_colchon")
    anteriores = {n: sys.modules.get(n) for n in nombres}
    sys.modules["figuras"] = figuras
    sys.modules["lampara"] = lampara
    sys.modules["monitoreo"] = monitoreo
    sys.modules["peso"] = peso
    sys.modules["setup_colchon"] = setup_colchon
    sys.modules.pop("comandos", None)
    import comandos

    def restaurar():
        for nombre, modulo in anteriores.items():
            if modulo is None:
                sys.modules.pop(nombre, None)
            else:
                sys.modules[nombre] = modulo

    comandos.time = types.SimpleNamespace(ticks_ms=lambda: 123)
    return comandos, restaurar


class ComandosTests(unittest.TestCase):
    def setUp(self):
        self._modulo_original = config.MODULO
        self.cmd, self._restaurar = cargar_comandos()
        _FIGURAS_STUB["secuencia"] = None
        self.monitoreo = sys.modules["monitoreo"]
        self.peso = sys.modules["peso"]
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

    def test_get_status_conserva_campos_y_agrega_modulo_colchon_y_audio(self):
        r = self.run_en("cuna", "get_status")
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"], {"modulo": "cuna", "lampara": 0, "secuencia": None,
                                       "colchon": None, "audio": "inactivo"})
        self.cmd.conectar_audio(None)
        r = self.run_en("cuna", "get_status")
        self.assertEqual((r["result"]["colchon"], r["result"]["audio"]), (None, None))

    def test_get_status_solo_informa_lo_que_aplica_al_modulo(self):
        _FIGURAS_STUB["secuencia"] = "chase"
        r = self.run_en("figuras", "get_status")["result"]
        self.assertEqual((r["modulo"], r["lampara"], r["secuencia"]), ("figuras", None, "chase"))
        r = self.run_en("colchon", "get_status")["result"]
        self.assertEqual((r["modulo"], r["lampara"], r["secuencia"]), ("colchon", None, None))
        self.assertEqual(r["colchon"], {"state": "stopped"})
        r = self.run_en("cuna", "get_status")["result"]
        self.assertEqual((r["lampara"], r["secuencia"]), (0, None))

    def test_comandos_de_otro_modulo_se_rechazan_sin_tocar_hardware(self):
        casos = [
            ("figuras", "lamp_set", {"level": 50}), ("colchon", "lamp_set", {"level": 50}),
            ("cuna", "led_all", {"on": True}), ("colchon", "led_stop", {}),
            ("cuna", "led_sequence", {"name": "chase", "step_s": 2}),
            ("cuna", "scale_tare", {}), ("figuras", "mattress_start", {}),
            ("colchon", "audio_play", {"sound": "tono_suave"}), ("figuras", "audio_stop", {}),
        ]
        for modulo, nombre, params in casos:
            r = self.run_en(modulo, nombre, **params)
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:" + modulo),
                             (modulo, nombre))
        self.assertEqual(self.monitoreo.llamadas + self.peso.llamadas, [])
        self.assertEqual(self.audio.llamadas, [])
        self.assertEqual(sys.modules["figuras"].llamadas, [])
        self.assertEqual(self.run_en("cuna", "get_status")["result"]["lampara"], 0)

    def test_modulo_invalido_rechaza_todo_menos_get_status(self):
        for nombre, params in (("lamp_set", {"level": 5}), ("led_all", {"on": True}),
                               ("scale_tare", {}), ("audio_status", {})):
            r = self.run_en("inexistente", nombre, **params)
            self.assertEqual((r["ok"], r["error"]),
                             (False, "comando_de_otro_modulo:inexistente"))

    def test_comandos_del_colchon(self):
        self.assertTrue(self.run_cmd("scale_tare")["ok"])
        self.assertEqual(self.run_cmd("scale_calibrate", known_g=1000)["result"], {"factor": 420.0})
        self.assertEqual(self.run_cmd("mattress_reference")["result"], {"reference_g": 1000.0})
        self.assertEqual(self.run_cmd("mattress_reference", reference_g=800)["result"],
                         {"reference_g": 800})
        r = self.run_cmd("mattress_start")
        self.assertEqual(r["result"], {"duration_s": 300, "tolerance_pct": 10, "alarm_s": 60,
                                       "reference_g": 1000.0})
        self.assertTrue(self.run_cmd("mattress_start", duration_s=120, tolerance_pct=5,
                                     alarm_s=30, reference_g=900)["ok"])
        self.assertTrue(self.run_cmd("mattress_stop")["ok"])
        self.assertEqual(self.peso.llamadas, [("tara",), ("calibrar", 1000)])
        self.assertEqual(self.monitoreo.llamadas, [
            ("capturar",), ("fijar", 800), ("iniciar", 300, 10, 60),
            ("fijar", 900), ("iniciar", 120, 5, 30), ("detener", "web")])

    def test_parar_cuando_no_hay_nada_activo_informa_el_estado_real(self):
        self.monitoreo.detener = lambda motivo: False
        r = self.run_cmd("mattress_stop")
        self.assertEqual(r["result"], {"stopped": True, "already_idle": True})
        r = self.run_cmd("alarm_stop")
        self.assertEqual(r["result"], {"alarm_stopped": True, "already_idle": True})
        self.assertEqual(self.monitoreo.llamadas, [("inactivo", "web_sync"), ("inactivo", "web_sync")])
        self.monitoreo.situacion["estado"] = "alarm"
        self.monitoreo.detener = lambda motivo: (self.monitoreo.llamadas.append(("detener", motivo)) or True)
        self.assertTrue(self.run_cmd("alarm_stop")["ok"])
        self.assertEqual(self.monitoreo.llamadas[-1], ("detener", "web"))

    def test_tara_y_calibracion_se_rechazan_con_el_monitoreo_activo(self):
        self.monitoreo.situacion["activo"] = True
        for nombre, params in (("scale_tare", {}), ("scale_calibrate", {"known_g": 1000})):
            r = self.run_cmd(nombre, **params)
            self.assertEqual((r["ok"], r["error"]), (False, "monitoreo_activo"))
        self.assertEqual(self.peso.llamadas, [])

    def test_hx711_sin_respuesta_se_informa(self):
        self.peso.tomar_tara = lambda: False
        r = self.run_cmd("scale_tare")
        self.assertEqual((r["ok"], r["error"]), (False, "hx711_sin_respuesta"))

    def test_parametros_invalidos_se_rechazan_sin_tocar_el_colchon(self):
        casos = [
            ("scale_calibrate", {}), ("scale_calibrate", {"known_g": True}),
            ("scale_calibrate", {"known_g": "1000"}), ("scale_calibrate", {"known_g": -5}),
            ("scale_calibrate", {"known_g": 99999}),
            ("mattress_reference", {"reference_g": "9"}), ("mattress_reference", {"reference_g": 99999}),
            ("mattress_start", {"duration_s": -1}), ("mattress_start", {"duration_s": "5"}),
            ("mattress_start", {"tolerance_pct": 0}), ("mattress_start", {"tolerance_pct": 99}),
            ("mattress_start", {"alarm_s": 601}),
            ("audio_play", {}), ("audio_play", {"sound": 5}),
        ]
        for nombre, params in casos:
            r = self.run_cmd(nombre, **params)
            self.assertFalse(r["ok"], (nombre, params))
        self.assertEqual(self.monitoreo.llamadas + self.peso.llamadas, [])
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
