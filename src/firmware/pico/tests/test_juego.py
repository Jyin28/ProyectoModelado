"""Fase 8: juego de cinco botones (HU-19), logica pura y control con dobles."""
import unittest

import _ruta
import control_juego as cj
import logica_juego
import setup_juego
from entrada import EntradaEstable

config = _ruta.config


class Azar:
    """Aleatorio inyectado: devuelve valores fijos en orden y registra los limites."""

    def __init__(self, *valores):
        self.valores = list(valores)
        self.limites = []

    def __call__(self, n):
        self.limites.append(n)
        return self.valores.pop(0) % n


class FakePin:
    def __init__(self, nivel=1):
        self.nivel = nivel          # 1 = sin pulsar (pull-up)

    def value(self, v=None):
        if v is None:
            return self.nivel
        self.nivel = v


class FakeBuzzer:
    def __init__(self):
        self.encendido = False
        self.veces = 0

    def value(self, v):
        if v and not self.encendido:
            self.veces += 1
        self.encendido = bool(v)


class LogicaTests(unittest.TestCase):
    def test_al_encender_elige_un_objetivo(self):
        j = logica_juego.Juego(Azar(3))
        self.assertIsNone(j.objetivo)
        self.assertEqual(j.encender(), 3)
        self.assertTrue(j.encendido)

    def test_acierto_y_error(self):
        j = logica_juego.Juego(Azar(2, 0, 0))
        j.encender()
        self.assertTrue(j.pulsar(2))
        self.assertEqual((j.aciertos, j.errores), (1, 0))
        objetivo = j.objetivo
        otro = (objetivo + 1) % 5
        self.assertFalse(j.pulsar(otro))
        self.assertEqual((j.aciertos, j.errores), (1, 1))

    def test_tras_cada_pulsacion_cambia_el_objetivo_a_otro_boton(self):
        for objetivo in range(5):
            for azar in range(4):
                j = logica_juego.Juego(Azar(objetivo, azar, azar))
                j.encender()
                j.pulsar(objetivo)
                self.assertNotEqual(j.objetivo, objetivo, (objetivo, azar))
                self.assertIn(j.objetivo, range(5))

    def test_el_nuevo_objetivo_cubre_los_otros_cuatro_botones(self):
        vistos = set()
        for azar in range(4):
            j = logica_juego.Juego(Azar(2, azar))
            j.encender()
            j.pulsar(0)                       # error: tambien cambia
            vistos.add(j.objetivo)
        self.assertEqual(vistos, {0, 1, 3, 4})

    def test_pide_azar_entre_cuatro_al_cambiar(self):
        azar = Azar(1, 0)
        j = logica_juego.Juego(azar)
        j.encender()
        j.pulsar(1)
        self.assertEqual(azar.limites, [5, 4])

    def test_apagado_ignora_pulsaciones(self):
        j = logica_juego.Juego(Azar(1, 0))
        self.assertIsNone(j.pulsar(0))
        j.encender()
        j.apagar()
        self.assertIsNone(j.objetivo)
        self.assertIsNone(j.pulsar(1))
        self.assertEqual((j.aciertos, j.errores), (0, 0))

    def test_boton_inexistente_se_ignora(self):
        j = logica_juego.Juego(Azar(1))
        j.encender()
        self.assertIsNone(j.pulsar(7))
        self.assertIsNone(j.pulsar(-1))
        self.assertEqual(j.objetivo, 1)

    def test_el_juego_sigue_hasta_apagarlo(self):
        j = logica_juego.Juego(Azar(*([1, 0] * 40)))
        j.encender()
        for _ in range(40):
            j.pulsar(j.objetivo)
        self.assertEqual(j.aciertos, 40)
        self.assertTrue(j.encendido)

    def test_reencender_da_objetivo_nuevo_sin_borrar_conteos(self):
        j = logica_juego.Juego(Azar(2, 0, 4))
        j.encender()
        j.pulsar(2)
        j.apagar()
        self.assertEqual(j.encender(), 4)
        self.assertEqual(j.aciertos, 1)

    def test_necesita_al_menos_dos_botones(self):
        with self.assertRaises(ValueError):
            logica_juego.Juego(Azar(), botones=1)


class EntradaTests(unittest.TestCase):
    def test_un_rebote_corto_no_cuenta(self):
        e = EntradaEstable(30)
        self.assertFalse(e.actualizar(True, 0))
        self.assertFalse(e.actualizar(False, 10))
        self.assertFalse(e.actualizar(True, 20))
        self.assertFalse(e.actualizar(True, 40))
        self.assertTrue(e.actualizar(True, 50))
        self.assertTrue(e.valor)

    def test_devuelve_flanco_solo_una_vez(self):
        e = EntradaEstable(10)
        e.actualizar(True, 0)
        self.assertTrue(e.actualizar(True, 10))
        for t in (20, 30, 40):
            self.assertFalse(e.actualizar(True, t))

    def test_vuelta_del_contador(self):
        tope = 1 << 30
        e = EntradaEstable(30)
        e.actualizar(True, tope - 10)
        self.assertTrue(e.actualizar(True, 20))        # 30 ms despues, ya dio la vuelta


class ControlBase(unittest.TestCase):
    def crear(self, azar=None, **cambios):
        self.botones = [FakePin() for _ in range(5)]
        self.leds = [FakePin(0) for _ in range(5)]
        self.buzzer = FakeBuzzer()
        self.azar = azar or Azar(*([2] + [0] * 200))
        self.c = cj.ControlJuego(self.botones, self.leds, self.buzzer, _ruta.cfg_prueba(**cambios), self.azar)
        self.t = 0

    def setUp(self):
        self.crear()

    def avanzar(self, ms=40, pasos=1):
        for _ in range(pasos):
            self.t += ms
            self.c.actualizar(self.t)

    def pulsar(self, i, ms=40):
        self.botones[i].nivel = 0
        self.avanzar(ms, 2)

    def soltar(self, i, ms=40):
        self.botones[i].nivel = 1
        self.avanzar(ms, 2)

    def tocar(self, i):
        self.pulsar(i)
        self.soltar(i)

    def leds_encendidos(self):
        return [i for i, led in enumerate(self.leds) if led.nivel]


class ControlTests(ControlBase):
    def test_arranca_con_un_solo_led_del_objetivo_y_sin_sonido(self):
        self.assertEqual(self.leds_encendidos(), [2])
        self.assertFalse(self.buzzer.encendido)
        self.assertTrue(self.c.estado()["encendido"])

    def test_acierto_suena_y_cambia_el_led(self):
        self.pulsar(2)
        self.assertTrue(self.buzzer.encendido)
        self.assertEqual(self.buzzer.veces, 1)
        self.assertEqual(self.c.estado()["aciertos"], 1)
        self.assertEqual(len(self.leds_encendidos()), 1)
        self.assertNotEqual(self.leds_encendidos(), [2])

    def test_la_recompensa_termina_sola_y_dura_lo_configurado(self):
        self.pulsar(2)
        self.soltar(2)
        self.assertTrue(self.buzzer.encendido)
        self.avanzar(100, 2)
        self.assertTrue(self.buzzer.encendido)       # 200 ms + lo anterior: aun no 400
        self.avanzar(100, 4)
        self.assertFalse(self.buzzer.encendido)
        self.assertFalse(self.c.estado()["suena"])

    def test_error_no_suena_pero_cambia_el_objetivo(self):
        self.pulsar(0)
        self.assertFalse(self.buzzer.encendido)
        self.assertEqual(self.buzzer.veces, 0)
        self.assertEqual(self.c.estado()["errores"], 1)
        self.assertEqual(len(self.leds_encendidos()), 1)
        self.assertNotEqual(self.leds_encendidos(), [2])

    def test_mantener_pulsado_es_una_sola_pulsacion(self):
        self.pulsar(0)
        self.avanzar(200, 30)
        self.assertEqual(self.c.pulsaciones, 1)
        self.assertEqual(self.c.estado()["errores"], 1)

    def test_un_rebote_no_cuenta_como_pulsacion(self):
        for _ in range(3):
            self.botones[0].nivel = 0
            self.avanzar(10)
            self.botones[0].nivel = 1
            self.avanzar(10)
        self.assertEqual(self.c.pulsaciones, 0)

    def test_cada_pulsacion_fisica_cuenta_una_vez(self):
        for _ in range(3):
            self.tocar(0)
            self.tocar(1)
        self.assertEqual(self.c.pulsaciones, 6)

    def test_dos_botones_a_la_vez_son_dos_pulsaciones(self):
        self.botones[0].nivel = 0
        self.botones[1].nivel = 0
        self.avanzar(40, 2)
        self.assertEqual(self.c.pulsaciones, 2)

    def test_siempre_hay_un_solo_led_encendido(self):
        for i in (0, 1, 3, 4, 2, 0):
            self.tocar(i)
            self.assertEqual(len(self.leds_encendidos()), 1)

    def test_sigue_sin_limite_de_pulsaciones(self):
        for k in range(60):
            self.tocar(1 + k % 3)
        self.assertTrue(self.c.estado()["encendido"])
        self.assertEqual(self.c.pulsaciones, 60)

    def test_botones_activos_en_alto(self):
        self.crear(JUEGO_BOTON_ACTIVO_BAJO=False)
        for b in self.botones:
            b.nivel = 0
        self.avanzar(40, 2)
        self.assertEqual(self.c.pulsaciones, 0)
        self.botones[0].nivel = 1
        self.avanzar(40, 2)
        self.assertEqual(self.c.pulsaciones, 1)

    def test_pide_cinco_botones_y_cinco_leds(self):
        with self.assertRaises(ValueError):
            cj.ControlJuego(self.botones[:4], self.leds, self.buzzer, _ruta.cfg_prueba(), self.azar)
        with self.assertRaises(ValueError):
            cj.ControlJuego(self.botones, self.leds[:3], self.buzzer, _ruta.cfg_prueba(), self.azar)


class EncendidoTests(ControlBase):
    def mantener_combo(self, ms):
        a, b = config.JUEGO_COMBO_ONOFF
        self.botones[a].nivel = 0
        self.botones[b].nivel = 0
        self.avanzar(40, 2)
        self.avanzar(100, ms // 100)

    def soltar_combo(self):
        for i in config.JUEGO_COMBO_ONOFF:
            self.botones[i].nivel = 1
        self.avanzar(40, 2)

    def test_el_combo_apaga_deja_todo_en_bajo_y_vuelve_a_encender(self):
        self.mantener_combo(config.JUEGO_COMBO_MS + 200)
        self.assertFalse(self.c.estado()["encendido"])
        self.assertEqual(self.leds_encendidos(), [])
        self.assertFalse(self.buzzer.encendido)
        self.soltar_combo()
        self.mantener_combo(config.JUEGO_COMBO_MS + 200)
        self.assertTrue(self.c.estado()["encendido"])
        self.assertEqual(len(self.leds_encendidos()), 1)

    def test_mantener_el_combo_no_alterna_varias_veces(self):
        self.mantener_combo(config.JUEGO_COMBO_MS * 3)
        self.assertFalse(self.c.estado()["encendido"])

    def test_el_combo_corto_no_apaga(self):
        self.mantener_combo(500)
        self.soltar_combo()
        self.assertTrue(self.c.estado()["encendido"])

    def test_pulsar_un_solo_boton_del_combo_juega_normal(self):
        a = config.JUEGO_COMBO_ONOFF[0]
        self.avanzar(100, 30)
        self.pulsar(a)
        self.avanzar(100, 30)
        self.assertTrue(self.c.estado()["encendido"])
        self.assertEqual(self.c.pulsaciones, 1)

    def test_apagado_las_pulsaciones_no_hacen_nada(self):
        self.mantener_combo(config.JUEGO_COMBO_MS + 200)
        self.soltar_combo()
        antes = self.c.estado()
        self.tocar(1)
        self.assertEqual(self.c.estado(), antes)
        self.assertEqual(self.leds_encendidos(), [])
        self.assertFalse(self.buzzer.encendido)

    def test_apagar_del_programa_deja_salidas_en_bajo(self):
        self.pulsar(2)
        self.c.apagar()
        self.assertEqual(self.leds_encendidos(), [])
        self.assertFalse(self.buzzer.encendido)
        self.assertFalse(self.c.estado()["encendido"])

    def test_sin_inicio_encendido_espera_el_combo(self):
        self.crear(JUEGO_INICIA_ENCENDIDO=False)
        self.assertFalse(self.c.estado()["encendido"])
        self.assertEqual(self.leds_encendidos(), [])
        self.mantener_combo(config.JUEGO_COMBO_MS + 200)
        self.assertTrue(self.c.estado()["encendido"])


class ConfiguracionTests(unittest.TestCase):
    def test_apagado_por_defecto_y_cinco_pines_de_cada_tipo(self):
        self.assertIs(config.JUEGO_HABILITADO, False)
        self.assertEqual(len(config.PINES_JUEGO_BOTONES), 5)
        self.assertEqual(len(config.PINES_JUEGO_LEDS), 5)

    def test_el_combo_son_dos_botones_distintos_validos(self):
        a, b = config.JUEGO_COMBO_ONOFF
        self.assertNotEqual(a, b)
        self.assertTrue(0 <= a < 5 and 0 <= b < 5)

    def test_validar_pines(self):
        reservados = config.PINES_RESERVADOS_WIFI
        setup_juego.validar_pines((2, 3, 4), reservados)
        with self.assertRaises(ValueError):
            setup_juego.validar_pines((2, 24), reservados)
        with self.assertRaises(ValueError):
            setup_juego.validar_pines((2, 2), reservados)

    def test_main_no_exige_red_para_el_juego(self):
        original = config.MODULO
        self.addCleanup(setattr, config, "MODULO", original)
        config.MODULO = "juego"
        self.assertFalse(_ruta.modulo.requiere_red())
        self.assertTrue(_ruta.modulo.usa("juego"))
        self.assertFalse(_ruta.modulo.usa("ambiente"))
        self.assertIsNone(_ruta.modulo.periferico_de("get_status"))


if __name__ == "__main__":
    unittest.main()
