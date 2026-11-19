"""Fase 11: la Pico informa su estado real al conectar y mantiene su periodicidad.

Python de escritorio, sin red ni hardware. Todo con dobles: acredita la logica,
no el comportamiento en la Pico ni con Supabase real.
"""
import os
import re
import types
import unittest

import _ruta

# Comparte el reloj simulado de test_lampara_remota (que sustituye time.ticks_*).
import test_lampara_remota as _base
import test_config_y_comandos as base_comandos
import lampara_remota as lr
import ordenes_remotas as orm

_reloj = _base._reloj
config = _ruta.config


class HabitacionFalsa:
    def __init__(self, puerta, movimiento):
        self._estado = {"puerta_abierta": False, "movimiento": False,
                        "monitoreo_puerta": puerta, "monitoreo_movimiento": movimiento}

    def estado(self):
        return self._estado


class EstadoParaNubeTests(unittest.TestCase):
    def setUp(self):
        self._modulo = config.MODULO
        self.cmd, self._restaurar = base_comandos.cargar_comandos()

    def tearDown(self):
        self.cmd.conectar_habitacion(None)
        config.MODULO = self._modulo
        self._restaurar()

    def test_la_cuna_informa_el_monitoreo_apagado_tras_reiniciar(self):
        config.MODULO = "cuna"
        self.assertEqual(self.cmd.estado_para_nube(), {"monitoreo": False})

    def test_la_cuna_informa_el_monitoreo_encendido(self):
        config.MODULO = "cuna"
        self.cmd._monitoreo_movimiento = True
        self.assertEqual(self.cmd.estado_para_nube(), {"monitoreo": True})

    def test_la_habitacion_informa_cada_sensor(self):
        config.MODULO = "habitacion"
        self.cmd.conectar_habitacion(HabitacionFalsa(False, True))
        self.assertEqual(self.cmd.estado_para_nube(),
                         {"monitoreo_puerta": False, "monitoreo_movimiento": True})

    def test_las_figuras_informan_la_secuencia_o_ninguna(self):
        config.MODULO = "figuras"
        base_comandos._FIGURAS_STUB["secuencia"] = None
        self.assertEqual(self.cmd.estado_para_nube(), {"secuencia": None})
        base_comandos._FIGURAS_STUB["secuencia"] = "ola_suave"
        self.assertEqual(self.cmd.estado_para_nube(), {"secuencia": "ola_suave"})
        # Un nombre que el servidor rechazaria se informa como «sin secuencia».
        for raro in ("Ola Suave", "", "x" * 41, 7):
            base_comandos._FIGURAS_STUB["secuencia"] = raro
            self.assertEqual(self.cmd.estado_para_nube(), {"secuencia": None}, repr(raro))
        base_comandos._FIGURAS_STUB["secuencia"] = None

    def test_el_colchon_no_usa_este_informe(self):
        # El colchon avisa su estado con los eventos de colchon/monitoreo.py (monitoring_*),
        # no con reportar_estado_modulo.
        config.MODULO = "colchon"
        self.assertEqual(self.cmd.estado_para_nube(), {})

    def test_otros_modulos_no_informan_claves_ajenas(self):
        for modulo in ("alimentacion", "juego"):
            config.MODULO = modulo
            self.assertEqual(self.cmd.estado_para_nube(), {}, modulo)


class InformarAlConectarTests(unittest.TestCase):
    def setUp(self):
        _reloj["ms"] = 1000
        self.original_gmtime = __import__("time").gmtime
        self.informes = [{"monitoreo": False}]
        self.c = orm.OrdenesRemotas("x.supabase.co", "cuna-movimiento-01", "cuna-01", "clave", "e", "p",
                                    lambda orden: {"ok": True, "result": {}, "command_id": orden["command_id"],
                                                   "command": orden["command"]},
                                    estado_para_nube=lambda: dict(self.informes[-1]))
        self.c.contexto = object()
        self.c._estado = lr._ACTIVO
        self.c._token = "t"
        self.c._join_ref = "1"
        self.c._apagar = False

    def _rpc_falso(self, respuestas):
        llamadas = []

        def rpc(nombre, cuerpo):
            llamadas.append((nombre, cuerpo))
            return respuestas.pop(0)
        self.c._rpc = rpc
        return llamadas

    def test_informa_el_estado_antes_de_tomar_ordenes(self):
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, {"actualizados": 1}), (200, None)])
        self.c._tomar_si_toca(1000)
        self.assertEqual([l[0] for l in llamadas], ["reportar_estado_modulo", "tomar_orden_modulo"])
        self.assertEqual(llamadas[0][1], {"p_estado": {"monitoreo": False}})
        self.assertFalse(self.c._informar)

    def test_solo_informa_una_vez_por_conexion(self):
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, {}), (200, None), (200, None)])
        self.c._tomar_si_toca(1000)
        self.c._tomar = True
        self.c._tomar_si_toca(1000)
        self.assertEqual([l[0] for l in llamadas].count("reportar_estado_modulo"), 1)

    def test_si_falla_reintenta_sin_tomar_ordenes_y_al_tercer_fallo_sigue(self):
        self.c._tomar = True
        llamadas = self._rpc_falso([(500, None), (500, None), (500, None), (200, None)])
        self.c._tomar_si_toca(1000)
        self.assertTrue(self.c._informar)
        self.c._tomar_si_toca(1500)              # antes del plazo de reintento: no llama
        self.assertEqual(len(llamadas), 1)
        self.c._tomar_si_toca(3500)
        self.assertEqual([l[0] for l in llamadas], ["reportar_estado_modulo"] * 2)
        self.c._tomar_si_toca(6000)
        self.assertEqual([l[0] for l in llamadas][-2:], ["reportar_estado_modulo", "tomar_orden_modulo"])
        self.assertFalse(self.c._informar, "un reporte fallido no bloquea las ordenes")

    def test_un_error_de_red_cuenta_como_fallo(self):
        self.c._tomar = True

        def rpc(nombre, cuerpo):
            raise OSError("sin red")
        self.c._rpc = rpc
        self.c._tomar_si_toca(1000)
        self.assertTrue(self.c._informar)
        self.assertEqual(self.c._informar_fallos, 1)

    def test_tras_un_corte_vuelve_a_informar_con_el_estado_de_ese_momento(self):
        self.c._tomar = True
        self._rpc_falso([(200, {}), (200, None)])
        self.c._tomar_si_toca(1000)
        self.assertFalse(self.c._informar)

        self.informes.append({"monitoreo": True})
        self.c._perder("corte")
        self.assertTrue(self.c._informar)
        self.c._tomar = True
        llamadas = self._rpc_falso([(200, {}), (200, None)])
        self.c._tomar_si_toca(9000)
        self.assertEqual(llamadas[0], ("reportar_estado_modulo", {"p_estado": {"monitoreo": True}}))

    def test_un_corte_durante_el_reporte_lo_descarta(self):
        self.c._tomar = True

        def rpc(nombre, cuerpo):
            self.c._perder("corte")
            return 200, {}
        self.c._rpc = rpc
        self.c._tomar_si_toca(1000)
        self.assertTrue(self.c._informar, "sigue pendiente: la sesion nueva informara de nuevo")

    def test_sin_proveedor_no_informa(self):
        c = orm.OrdenesRemotas("x.supabase.co", "cuna-movimiento-01", "cuna-01", "clave", "e", "p", lambda o: o)
        c._estado = lr._ACTIVO
        c._tomar = True
        llamadas = []
        c._rpc = lambda nombre, cuerpo: (llamadas.append(nombre), (200, None))[1]
        c._tomar_si_toca(1000)
        self.assertEqual(llamadas, ["tomar_orden_modulo"])

    def test_configurar_pasa_el_proveedor(self):
        class Ajustes:
            ORDENES_SUPABASE_URL = "https://abc.supabase.co"
            ORDENES_PUBLISHABLE_KEY = "sb_publishable_abc"
            ORDENES_DEVICE_ID = "cuna-movimiento-01"
            ORDENES_PRODUCTO_ID = "cuna-01"
            ORDENES_AUTH_EMAIL = "pico@example.test"
            ORDENES_AUTH_PASSWORD = "clave"
        proveedor = lambda: {"monitoreo": False}  # noqa: E731
        cliente = orm.configurar(lambda o: o, Ajustes, estado_para_nube=proveedor)
        self.assertIs(cliente._estado_para_nube, proveedor)


class PeriodicidadTests(unittest.TestCase):
    """CA-30.3 y CA-30.4: ambiente cada 2 s y peso cada 1 s, con reloj simulado."""

    @staticmethod
    def _disparos(intervalo_s, duracion_s, paso_ms):
        """Simula el ciclo principal de main.py: dispara cuando han pasado intervalo_s."""
        ultimo = -intervalo_s * 1000
        disparos = []
        ahora = 0
        while ahora <= duracion_s * 1000:
            if ahora - ultimo >= intervalo_s * 1000:
                disparos.append(ahora)
                ultimo = ahora
            ahora += paso_ms
        return disparos

    def test_el_ambiente_se_lee_cada_dos_segundos(self):
        # 2 s es el minimo entre lecturas del AM2301: no bajar de aqui.
        self.assertEqual(config.INTERVALO_AMBIENTE_S, 2)
        disparos = self._disparos(config.INTERVALO_AMBIENTE_S, 10, 20)
        self.assertEqual(disparos, [0, 2000, 4000, 6000, 8000, 10000])

    def test_el_peso_se_lee_cada_segundo(self):
        ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "colchon", "setup_colchon.py")
        with open(ruta, encoding="utf-8") as archivo:
            intervalo_ms = int(re.search(r"^READING_INTERVAL\s*=\s*(\d+)", archivo.read(), re.M).group(1))
        self.assertEqual(intervalo_ms, 1000)
        disparos = self._disparos(intervalo_ms / 1000, 10, 20)
        self.assertEqual(len(disparos), 11)
        huecos = {b - a for a, b in zip(disparos, disparos[1:])}
        self.assertEqual(huecos, {1000})


if __name__ == "__main__":
    unittest.main()
