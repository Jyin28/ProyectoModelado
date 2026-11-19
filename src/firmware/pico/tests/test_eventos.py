"""Pruebas de eventos.sincronizar_hora: varios servidores NTP y mas tiempo de espera.

Python de escritorio, con un ntptime simulado: acreditan la logica de reintentos, no que
la red de la Pico alcance los servidores.
"""
import io
import sys
import types
import unittest
from contextlib import redirect_stdout
from unittest import mock

import _ruta  # noqa: F401
import eventos


class NtpFalso(types.ModuleType):
    """Modulo ntptime simulado: 'fallan' dice cuantos intentos fallan antes de acertar."""

    def __init__(self, fallan=0):
        super().__init__("ntptime")
        self.host = "pool.ntp.org"
        self.timeout = 1
        self.fallan = fallan
        self.llamadas = []

    def settime(self):
        self.llamadas.append((self.host, self.timeout))
        if len(self.llamadas) <= self.fallan:
            raise OSError(110, "ETIMEDOUT")


class SincronizarHoraTests(unittest.TestCase):
    def setUp(self):
        self._anterior = sys.modules.get("ntptime")
        eventos._hora_sincronizada = False
        eventos._siguiente = 0

    def tearDown(self):
        if self._anterior is None:
            sys.modules.pop("ntptime", None)
        else:
            sys.modules["ntptime"] = self._anterior
        eventos._hora_sincronizada = False
        eventos._siguiente = 0

    def sincronizar(self, ntp):
        sys.modules["ntptime"] = ntp
        salida = io.StringIO()
        with redirect_stdout(salida):
            resultado = eventos.sincronizar_hora()
        return resultado, salida.getvalue()

    def test_a_la_primera_usa_el_primer_servidor_con_mas_espera(self):
        ntp = NtpFalso(fallan=0)
        ok, salida = self.sincronizar(ntp)
        self.assertTrue(ok)
        self.assertTrue(eventos.hora_valida())
        self.assertEqual(ntp.llamadas, [("pool.ntp.org", eventos._TIMEOUT_S)])
        self.assertGreater(eventos._TIMEOUT_S, 1)   # el valor por defecto de ntptime (1 s) no alcanza
        self.assertIn("Hora UTC sincronizada (pool.ntp.org)", salida)

    def test_si_un_servidor_no_responde_prueba_otro_en_la_misma_llamada(self):
        ntp = NtpFalso(fallan=1)
        ok, salida = self.sincronizar(ntp)
        self.assertTrue(ok)
        self.assertEqual([h for h, _ in ntp.llamadas], ["pool.ntp.org", "time.google.com"])
        self.assertIn("Hora UTC sincronizada (time.google.com)", salida)
        self.assertNotIn("ETIMEDOUT", salida)       # un servidor caido no se muestra como error

    def test_si_todos_fallan_devuelve_false_y_un_solo_aviso(self):
        ntp = NtpFalso(fallan=99)
        ok, salida = self.sincronizar(ntp)
        self.assertFalse(ok)
        self.assertFalse(eventos.hora_valida())
        self.assertEqual(len(ntp.llamadas), eventos._INTENTOS)
        self.assertEqual(salida.count("No se pudo sincronizar la hora"), 1)
        self.assertIn("pool.ntp.org, time.google.com", salida)

    def test_cada_llamada_sigue_con_el_servidor_que_toca(self):
        ntp = NtpFalso(fallan=99)
        for _ in range(2):
            self.sincronizar(ntp)
        self.assertEqual([h for h, _ in ntp.llamadas],
                         ["pool.ntp.org", "time.google.com", "time.cloudflare.com", "time.nist.gov"])
        self.sincronizar(ntp)       # da la vuelta y vuelve a empezar
        self.assertEqual(ntp.llamadas[4][0], "pool.ntp.org")

    def test_una_fecha_anterior_a_2024_no_se_acepta(self):
        ntp = NtpFalso(fallan=0)
        with mock.patch.object(eventos.time, "gmtime", return_value=(2000, 1, 1, 0, 0, 0, 5, 1, 0)):
            ok, _ = self.sincronizar(ntp)
            self.assertFalse(ok)
            self.assertFalse(eventos.hora_valida())

    def test_sin_modulo_ntptime_devuelve_false(self):
        sys.modules["ntptime"] = None       # hace fallar "import ntptime"
        salida = io.StringIO()
        with redirect_stdout(salida):
            self.assertFalse(eventos.sincronizar_hora())
        self.assertIn("falta el modulo ntptime", salida.getvalue())

    def test_un_nuevo_intento_no_deja_hora_valida_si_falla(self):
        ok, _ = self.sincronizar(NtpFalso(fallan=0))
        self.assertTrue(ok)
        ok, _ = self.sincronizar(NtpFalso(fallan=99))
        self.assertFalse(ok)
        self.assertFalse(eventos.hora_valida())


class CrearEventoTests(unittest.TestCase):
    def test_sin_hora_valida_no_se_crean_eventos(self):
        eventos._hora_sincronizada = False
        with self.assertRaises(RuntimeError):
            eventos.crear("monitoring_started")

    def test_con_hora_valida_el_evento_trae_id_tipo_fecha_y_datos(self):
        eventos._hora_sincronizada = True
        try:
            ev = eventos.crear("alarm_started", {"weight_g": 1.5})
        finally:
            eventos._hora_sincronizada = False
        self.assertEqual(ev["type"], "alarm_started")
        self.assertEqual(ev["data"], {"weight_g": 1.5})
        self.assertEqual(len(ev["event_id"]), 36)
        self.assertTrue(ev["at"].endswith("Z"))


if __name__ == "__main__":
    unittest.main()
