"""Arranque del envio: el certificado se carga como cadata (no como ruta) y se busca en la Pico."""
import os
import sys
import tempfile
import types
import unittest

import _ruta

TOKEN = "a" * 64


def cargar_ambiente(**ajustes):
    """Importa ambiente.py con wifi y secrets simulados (necesitan MicroPython)."""
    nombres = ("ambiente", "wifi", "secrets")
    anteriores = {n: sys.modules.get(n) for n in nombres}
    sys.modules["wifi"] = types.SimpleNamespace(esta_conectado=lambda: True)
    sys.modules["secrets"] = types.SimpleNamespace(**ajustes)
    sys.modules.pop("ambiente", None)
    import ambiente

    def restaurar():
        for nombre, modulo in anteriores.items():
            if modulo is None:
                sys.modules.pop(nombre, None)
            else:
                sys.modules[nombre] = modulo

    return ambiente, restaurar


class IniciarTests(unittest.TestCase):
    def setUp(self):
        self.ambiente, restaurar = cargar_ambiente(
            AMBIENTE_URL="https://abc.supabase.co/functions/v1/ingesta",
            AMBIENTE_DEVICE_ID="cuna-ambiente-01", AMBIENTE_TOKEN=TOKEN)
        self.addCleanup(restaurar)
        self.contextos = []
        contextos = self.contextos

        class Contexto:
            def __init__(self, protocolo):
                self.llamadas = []
                contextos.append(self)

            def load_verify_locations(self, cafile=None, cadata=None):
                self.llamadas.append((cafile, cadata))

        self.ambiente.ssl = types.SimpleNamespace(
            SSLContext=Contexto, PROTOCOL_TLS_CLIENT=16, CERT_REQUIRED=2)
        self.ambiente._thread = types.SimpleNamespace(
            start_new_thread=lambda f, a: None, stack_size=lambda n: 0,
            allocate_lock=self.ambiente._thread.allocate_lock)
        self._ntp_previo = sys.modules.get("ntptime")
        sys.modules["ntptime"] = types.SimpleNamespace(timeout=0)
        self.addCleanup(self._restaurar_ntp)
        self.archivo = tempfile.NamedTemporaryFile(delete=False, suffix=".der")
        self.archivo.write(b"certificado-der-falso")
        self.archivo.close()
        self.addCleanup(os.unlink, self.archivo.name)
        self.ambiente._CA = self.archivo.name

    def _restaurar_ntp(self):
        if self._ntp_previo is None:
            sys.modules.pop("ntptime", None)
        else:
            sys.modules["ntptime"] = self._ntp_previo

    def test_el_certificado_se_pasa_como_cadata_y_no_como_ruta(self):
        envio = self.ambiente.iniciar()
        self.assertIsNotNone(envio)
        self.assertEqual(self.contextos[0].llamadas, [(None, b"certificado-der-falso")])

    def test_certificado_ausente_no_arranca_el_envio(self):
        self.ambiente._CA = self.archivo.name + ".no-existe"
        self.assertIsNone(self.ambiente.iniciar())
        self.assertEqual(self.contextos[0].llamadas, [])

    def test_el_certificado_se_busca_con_rutas(self):
        usadas = []
        self.ambiente.rutas = types.SimpleNamespace(
            buscar=lambda ruta: usadas.append(ruta) or self.archivo.name)
        self.ambiente._CA = "/common/communication/gts-root-r4.der"
        self.assertIsNotNone(self.ambiente.iniciar())
        self.assertEqual(usadas, ["/common/communication/gts-root-r4.der"])


class CredencialMovimientoTests(unittest.TestCase):
    """El PIR solo existe en el modulo cuna: otros modulos no cargan su credencial."""

    def setUp(self):
        self.ambiente, restaurar = cargar_ambiente(
            MOVIMIENTO_DEVICE_ID="cuna-movimiento-01", MOVIMIENTO_TOKEN=TOKEN)
        self.addCleanup(restaurar)
        for nombre in ("MODULO", "MONITOREO_MOVIMIENTO_HABILITADO"):
            self.addCleanup(setattr, _ruta.config, nombre, getattr(_ruta.config, nombre))
        _ruta.config.MONITOREO_MOVIMIENTO_HABILITADO = True

    def test_en_la_cuna_se_carga(self):
        _ruta.config.MODULO = "cuna"
        self.assertEqual(self.ambiente._credencial_movimiento(), ("cuna-movimiento-01", TOKEN))

    def test_en_figuras_y_otros_modulos_no_se_carga(self):
        for modulo in ("figuras", "colchon", "habitacion", "alimentacion"):
            _ruta.config.MODULO = modulo
            self.assertIsNone(self.ambiente._credencial_movimiento(), modulo)

    def test_con_el_interruptor_apagado_no_se_carga(self):
        _ruta.config.MODULO = "cuna"
        _ruta.config.MONITOREO_MOVIMIENTO_HABILITADO = False
        self.assertIsNone(self.ambiente._credencial_movimiento())


class OrdenEnCursoTests(unittest.TestCase):
    """Con una orden remota en curso (plazo de 15 s) el worker no gasta tiempo en POST."""

    def setUp(self):
        import test_lampara_remota as base   # sustituye time.ticks_* y time.sleep_ms
        base._reloj["ms"] = 0
        self.ambiente, restaurar = cargar_ambiente(
            AMBIENTE_URL="https://abc.supabase.co/functions/v1/ingesta",
            AMBIENTE_DEVICE_ID="cuna-ambiente-01", AMBIENTE_TOKEN=TOKEN)
        self.addCleanup(restaurar)

    def test_no_envia_mientras_la_remota_esta_ocupada_y_envia_al_quedar_libre(self):
        ocupaciones = [True, False]
        eventos = []
        amb = self.ambiente

        class Remota:
            def ocupado(self):
                return ocupaciones.pop(0)

            def paso(self, red_lista):
                eventos.append("paso")
                if not ocupaciones:
                    envio._activo = False       # termina el bucle tras la segunda vuelta

            def detener(self):
                pass

            def cerrar_red(self):
                pass

        envio = amb.EnvioAmbiente("abc.supabase.co", "cuna-ambiente-01", TOKEN, object(),
                                  types.SimpleNamespace(settime=lambda: None), Remota())
        envio._reloj_listo = True
        envio._pendiente = (b"{}", 0)
        envio._enviar = lambda cuerpo, medido_ms, **resto: eventos.append("enviar")
        envio.ejecutar()
        self.assertEqual(eventos, ["paso", "enviar", "paso"])


if __name__ == "__main__":
    unittest.main()
