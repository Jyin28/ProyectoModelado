"""Formato del lote de ambiente y lectura de la configuracion de Supabase."""
import json
import os
import re
import sys
import tempfile
import types
import unittest

import _ruta

config = _ruta.config
TOKEN = "a" * 64
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


def cargar_ambiente(**ajustes):
    """Importa ambiente.py con wifi y secrets simulados."""
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


class AmbienteTests(unittest.TestCase):
    def setUp(self):
        self.ambiente, restaurar = cargar_ambiente(
            INGESTA_URL="https://abc.supabase.co/functions/v1/ingesta",
            DEVICE_TOKEN=TOKEN)
        self.addCleanup(restaurar)

    def test_host_sale_de_ingesta_url(self):
        self.assertEqual(self.ambiente._leer_host(), "abc.supabase.co")

    def test_url_invalida_o_ausente_no_da_host(self):
        for url in ("", "http://abc.supabase.co/functions/v1/ingesta",
                    "https://abc.supabase.co/otra/ruta", "https:///functions/v1/ingesta"):
            sys.modules["secrets"].INGESTA_URL = url
            self.assertIsNone(self.ambiente._leer_host(), url)

    def test_credencial_usa_device_id_y_device_token(self):
        self.assertEqual(self.ambiente._credencial_ambiente(), (config.DEVICE_ID, TOKEN))

    def test_token_invalido_o_ausente_desactiva_el_envio(self):
        for token in ("", "corto", "z" * 64, "a" * 63):
            sys.modules["secrets"].DEVICE_TOKEN = token
            self.assertIsNone(self.ambiente._credencial_ambiente(), token)

    def test_lote_tiene_el_formato_de_la_ingesta(self):
        envio = self.ambiente.EnvioAmbiente(
            "abc.supabase.co", config.DEVICE_ID, TOKEN, None, None)
        envio._reloj_listo = True
        envio.registrar(23.5, 55.0, 1000)
        cuerpo, medido_ms = envio._pendiente
        self.assertEqual(medido_ms, 1000)
        lote = json.loads(cuerpo)
        self.assertEqual(set(lote), {"device_id", "events"})
        self.assertEqual(lote["device_id"], config.DEVICE_ID)
        self.assertEqual(len(lote["events"]), 1)
        evento = lote["events"][0]
        self.assertEqual(set(evento), {"event_id", "type", "at", "data"})
        self.assertRegex(evento["event_id"], UUID)
        self.assertEqual(evento["type"], "ambiente")
        self.assertRegex(evento["at"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        self.assertEqual(evento["data"], {"temperatura_c": 23.5, "humedad_pct": 55.0})

    def test_sin_hora_confiable_o_con_valores_invalidos_no_se_encola(self):
        envio = self.ambiente.EnvioAmbiente(
            "abc.supabase.co", config.DEVICE_ID, TOKEN, None, None)
        envio.registrar(23.5, 55.0, 1000)           # reloj sin sincronizar
        self.assertIsNone(envio._pendiente)
        envio._reloj_listo = True
        envio.registrar(float("nan"), 55.0, 1000)
        envio.registrar(23.5, 101, 1000)
        self.assertIsNone(envio._pendiente)


class MovimientoTests(unittest.TestCase):
    MOV = ("cuna-movimiento-01", "b" * 64)

    def setUp(self):
        self.ambiente, restaurar = cargar_ambiente(
            INGESTA_URL="https://abc.supabase.co/functions/v1/ingesta",
            DEVICE_TOKEN=TOKEN,
            MOVIMIENTO_DEVICE_ID=self.MOV[0], MOVIMIENTO_TOKEN=self.MOV[1])
        self.addCleanup(restaurar)
        self._habilitado = config.MONITOREO_MOVIMIENTO_HABILITADO
        self.addCleanup(setattr, config, "MONITOREO_MOVIMIENTO_HABILITADO", self._habilitado)
        config.MONITOREO_MOVIMIENTO_HABILITADO = True

    def envio(self, movimiento=MOV, host="abc.supabase.co"):
        envio = self.ambiente.EnvioAmbiente(host, config.DEVICE_ID, TOKEN, None, None,
                                            None, movimiento)
        envio._reloj_listo = True
        return envio

    def test_lote_de_movimiento_con_su_propio_dispositivo(self):
        envio = self.envio()
        envio.registrar_movimiento(500)
        cuerpo, detectado_ms = envio._pendiente_movimiento
        self.assertEqual(detectado_ms, 500)
        lote = json.loads(cuerpo)
        self.assertEqual(lote["device_id"], "cuna-movimiento-01")
        self.assertEqual(len(lote["events"]), 1)
        evento = lote["events"][0]
        self.assertEqual(set(evento), {"event_id", "type", "at", "data"})
        self.assertEqual(evento["type"], "movimiento")
        self.assertEqual(evento["data"], {})
        self.assertRegex(evento["event_id"], UUID)
        self.assertRegex(evento["at"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        self.assertIsNone(envio._pendiente)           # no toca el ambiente

    def test_solo_un_evento_pendiente_y_nunca_sin_hora(self):
        envio = self.envio()
        envio.registrar_movimiento(1)
        primero = envio._pendiente_movimiento
        envio.registrar_movimiento(2)
        self.assertIs(envio._pendiente_movimiento, primero)
        sin_hora = self.envio()
        sin_hora._reloj_listo = False
        sin_hora.registrar_movimiento(1)
        self.assertIsNone(sin_hora._pendiente_movimiento)

    def test_sin_credencial_o_sin_host_no_registra(self):
        for envio in (self.envio(movimiento=None), self.envio(host=None)):
            envio.registrar_movimiento(1)
            self.assertIsNone(envio._pendiente_movimiento)

    def test_credencial_valida(self):
        self.assertEqual(self.ambiente._credencial_movimiento(), self.MOV)

    def test_credencial_invalida_o_deshabilitada(self):
        for dispositivo in ("", "cuna-ambiente-01", "cuna-movimiento-1", "cuna-movimiento-ab"):
            sys.modules["secrets"].MOVIMIENTO_DEVICE_ID = dispositivo
            self.assertIsNone(self.ambiente._credencial_movimiento(), dispositivo)
        sys.modules["secrets"].MOVIMIENTO_DEVICE_ID = self.MOV[0]
        for token in ("", "corto", "z" * 64):
            sys.modules["secrets"].MOVIMIENTO_TOKEN = token
            self.assertIsNone(self.ambiente._credencial_movimiento(), token)
        sys.modules["secrets"].MOVIMIENTO_TOKEN = self.MOV[1]
        config.MONITOREO_MOVIMIENTO_HABILITADO = False
        self.assertIsNone(self.ambiente._credencial_movimiento())

    def test_detener_descarta_el_evento_pendiente(self):
        envio = self.envio()
        envio.registrar_movimiento(1)
        envio.detener()
        self.assertIsNone(envio._pendiente_movimiento)


class IniciarTests(unittest.TestCase):
    """iniciar() con ssl, ntptime e hilos simulados: carga el certificado como cadata."""

    def setUp(self):
        self.ambiente, restaurar = cargar_ambiente(
            INGESTA_URL="https://abc.supabase.co/functions/v1/ingesta",
            DEVICE_TOKEN=TOKEN)
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
        self.assertEqual(self.contextos[0].llamadas,
                         [(None, b"certificado-der-falso")])

    def test_certificado_ausente_no_arranca_el_envio(self):
        self.ambiente._CA = self.archivo.name + ".no-existe"
        self.assertIsNone(self.ambiente.iniciar())
        self.assertEqual(self.contextos[0].llamadas, [])


if __name__ == "__main__":
    unittest.main()
