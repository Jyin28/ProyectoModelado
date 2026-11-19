"""Fase 7: sensor de puerta y PIR de la habitacion (logica pura y comandos)."""
import unittest

import _ruta
import control_habitacion as ch
import setup_habitacion
import test_config_y_comandos as base

config = _ruta.config


class FakePin:
    def __init__(self, nivel=0):
        self.nivel = nivel

    def value(self):
        return self.nivel


def cfg(**cambios):
    return _ruta.cfg_prueba(**cambios)


class Base(unittest.TestCase):
    def setUp(self):
        self.puerta = FakePin(0)      # reed cerrado con pull-up y contacto a GND: 0
        self.pir = FakePin(0)
        self.c = ch.ControlHabitacion(self.puerta, self.pir, cfg())
        self.t = 0

    def avanzar(self, ms=200, pasos=1):
        for _ in range(pasos):
            self.t += ms
            self.c.actualizar(self.t)

    def abrir_puerta(self):
        self.puerta.nivel = 1
        self.avanzar(150, 2)

    def cerrar_puerta(self):
        self.puerta.nivel = 0
        self.avanzar(150, 2)

    def mover(self):
        self.pir.nivel = 1
        self.avanzar(150, 2)

    def quieto(self):
        self.pir.nivel = 0
        self.avanzar(150, 2)


class MonitoreoTests(Base):
    def test_arranca_apagado_y_no_informa_nada(self):
        self.abrir_puerta()
        self.mover()
        self.assertEqual(self.c.sacar_eventos(), [])
        self.assertEqual(self.c.estado()["monitoreo_puerta"], False)
        self.assertEqual(self.c.estado()["monitoreo_movimiento"], False)

    def test_puerta_activa_informa_una_apertura(self):
        self.c.fijar_monitoreo("puerta", True)
        self.abrir_puerta()
        eventos = self.c.sacar_eventos()
        self.assertEqual([(e["tipo"], e["datos"]) for e in eventos], [("puerta", {})])

    def test_puerta_abierta_no_repite_y_cerrar_no_informa(self):
        self.c.fijar_monitoreo("puerta", True)
        self.abrir_puerta()
        self.avanzar(500, 10)
        self.cerrar_puerta()
        self.assertEqual(len(self.c.sacar_eventos()), 1)

    def test_dos_aperturas_son_dos_eventos(self):
        self.c.fijar_monitoreo("puerta", True)
        self.abrir_puerta()
        self.cerrar_puerta()
        self.abrir_puerta()
        self.assertEqual(len(self.c.sacar_eventos()), 2)

    def test_movimiento_activo_informa_un_flanco(self):
        self.c.fijar_monitoreo("movimiento", True)
        self.mover()
        self.avanzar(500, 5)
        eventos = self.c.sacar_eventos()
        self.assertEqual([e["tipo"] for e in eventos], ["movimiento_habitacion"])

    def test_cada_sensor_tiene_su_propio_monitoreo(self):
        self.c.fijar_monitoreo("puerta", True)
        self.mover()
        self.assertEqual(self.c.sacar_eventos(), [])
        self.abrir_puerta()
        self.assertEqual([e["tipo"] for e in self.c.sacar_eventos()], ["puerta"])

    def test_puerta_y_movimiento_juntos_son_dos_eventos(self):
        self.c.fijar_monitoreo("puerta", True)
        self.c.fijar_monitoreo("movimiento", True)
        self.puerta.nivel = 1
        self.pir.nivel = 1
        self.avanzar(150, 2)
        tipos = sorted(e["tipo"] for e in self.c.sacar_eventos())
        self.assertEqual(tipos, ["movimiento_habitacion", "puerta"])

    def test_activar_con_la_puerta_ya_abierta_no_genera_evento(self):
        self.abrir_puerta()
        self.c.fijar_monitoreo("puerta", True)
        self.avanzar(500, 5)
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_desactivar_evita_eventos(self):
        self.c.fijar_monitoreo("puerta", True)
        self.c.fijar_monitoreo("puerta", False)
        self.abrir_puerta()
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_un_rebote_corto_no_cuenta(self):
        self.c.fijar_monitoreo("puerta", True)
        self.puerta.nivel = 1
        self.avanzar(30)
        self.puerta.nivel = 0
        self.avanzar(30, 5)
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_sacar_eventos_vacia_la_lista(self):
        self.c.fijar_monitoreo("puerta", True)
        self.abrir_puerta()
        self.assertEqual(len(self.c.sacar_eventos()), 1)
        self.assertEqual(self.c.sacar_eventos(), [])

    def test_la_lista_tiene_tope_y_descarta_el_mas_antiguo(self):
        self.c.fijar_monitoreo("puerta", True)
        for _ in range(ch.MAX_EVENTOS + 3):
            self.abrir_puerta()
            self.cerrar_puerta()
        eventos = self.c.sacar_eventos()
        self.assertEqual(len(eventos), ch.MAX_EVENTOS)
        self.assertEqual([e["ms"] for e in eventos], sorted(e["ms"] for e in eventos))

    def test_el_evento_no_lleva_direccion_ni_fotos(self):
        self.c.fijar_monitoreo("puerta", True)
        self.abrir_puerta()
        self.assertEqual(self.c.sacar_eventos()[0]["datos"], {})

    def test_con_la_logica_invertida_abierto_es_bajo(self):
        c = ch.ControlHabitacion(self.puerta, self.pir, cfg(PUERTA_ABIERTA_ES_ALTO=False))
        c.fijar_monitoreo("puerta", True)
        self.puerta.nivel = 1             # cerrado con esta logica
        for t in (0, 150, 300):
            c.actualizar(t)
        self.puerta.nivel = 0             # abierto
        for t in (450, 600, 750):
            c.actualizar(t)
        self.assertEqual(len(c.sacar_eventos()), 1)

    def test_apagar_deja_todo_apagado(self):
        self.c.fijar_monitoreo("puerta", True)
        self.abrir_puerta()
        self.c.apagar()
        self.assertEqual(self.c.sacar_eventos(), [])
        self.assertFalse(self.c.monitoreo("puerta"))

    def test_sensor_o_valor_invalido_se_rechaza(self):
        for sensor in ("camara", "", None, 3):
            with self.assertRaises(ValueError):
                self.c.fijar_monitoreo(sensor, True)
        for activo in (1, "true", None):
            with self.assertRaises(ValueError):
                self.c.fijar_monitoreo("puerta", activo)

    def test_vuelta_del_contador_de_milisegundos(self):
        c = ch.ControlHabitacion(self.puerta, self.pir, cfg())
        c.fijar_monitoreo("puerta", True)
        base_ms = (1 << 30) - 100
        self.puerta.nivel = 1
        c.actualizar(base_ms)
        c.actualizar((base_ms + 150) & ((1 << 30) - 1))
        self.assertEqual(len(c.sacar_eventos()), 1)


class PinesTests(unittest.TestCase):
    def test_validar_pines(self):
        reservados = config.PINES_RESERVADOS_WIFI
        setup_habitacion.validar_pines((4, 5), reservados)
        with self.assertRaises(ValueError):
            setup_habitacion.validar_pines((4, 24), reservados)
        with self.assertRaises(ValueError):
            setup_habitacion.validar_pines((4, 4), reservados)

    def test_deshabilitada_por_defecto(self):
        self.assertFalse(config.HABITACION_HABILITADO)


class ComandosHabitacionTests(unittest.TestCase):
    def setUp(self):
        self._modulo = config.MODULO
        self.cmd, self._restaurar = base.cargar_comandos()
        self.control = ch.ControlHabitacion(FakePin(0), FakePin(0), cfg())
        self.cmd.conectar_habitacion(self.control)

    def tearDown(self):
        config.MODULO = self._modulo
        self.cmd.conectar_habitacion(None)
        self._restaurar()

    def ejecutar(self, modulo, **params):
        config.MODULO = modulo
        return self.cmd.ejecutar({"command_id": "t", "command": "room_monitor_set",
                                  "params": params})

    def test_enciende_y_apaga_cada_sensor(self):
        r = self.ejecutar("habitacion", sensor="puerta", enabled=True)
        self.assertEqual((r["ok"], r["result"]), (True, {"sensor": "puerta", "enabled": True}))
        self.assertTrue(self.control.monitoreo("puerta"))
        self.assertFalse(self.control.monitoreo("movimiento"))
        r = self.ejecutar("habitacion", sensor="puerta", enabled=False)
        self.assertTrue(r["ok"])
        self.assertFalse(self.control.monitoreo("puerta"))

    def test_valida_los_parametros(self):
        for params, error in (({"enabled": True}, "parametro_invalido:sensor"),
                              ({"sensor": "camara", "enabled": True}, "parametro_invalido:sensor"),
                              ({"sensor": "puerta"}, "parametro_invalido:enabled"),
                              ({"sensor": "puerta", "enabled": 1}, "parametro_invalido:enabled")):
            r = self.ejecutar("habitacion", **params)
            self.assertEqual((r["ok"], r["error"]), (False, error), params)
        self.assertFalse(self.control.monitoreo("puerta"))

    def test_sin_hardware_falla_con_codigo(self):
        self.cmd.conectar_habitacion(None)
        r = self.ejecutar("habitacion", sensor="puerta", enabled=True)
        self.assertEqual((r["ok"], r["error"]), (False, "habitacion_no_habilitada"))

    def test_en_otro_modulo_se_rechaza_sin_tocar_nada(self):
        for otro in ("cuna", "colchon", "figuras"):
            r = self.ejecutar(otro, sensor="puerta", enabled=True)
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:" + otro))
        self.assertFalse(self.control.monitoreo("puerta"))

    def test_get_status_incluye_la_habitacion(self):
        config.MODULO = "habitacion"
        r = self.cmd.ejecutar({"command_id": "t", "command": "get_status", "params": {}})
        self.assertEqual(r["result"]["habitacion"]["monitoreo_puerta"], False)

    def test_los_comandos_de_otros_modulos_no_valen_en_la_habitacion(self):
        config.MODULO = "habitacion"
        for comando in ("lamp_set", "led_stop", "mattress_stop", "motion_set"):
            r = self.cmd.ejecutar({"command_id": "t", "command": comando, "params": {}})
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:habitacion"))


if __name__ == "__main__":
    unittest.main()
