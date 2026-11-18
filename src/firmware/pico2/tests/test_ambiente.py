"""Formato del lote de ambiente y lectura de la configuracion de Supabase."""
import json
import re
import sys
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


if __name__ == "__main__":
    unittest.main()
