"""Comandos nuevos de la fase 5: monitoreo de movimiento remoto y voz frente al audio local."""
import unittest

import _ruta
import test_config_y_comandos as base

config = _ruta.config


class FalsaVoz:
    def __init__(self, activa):
        self._activa = activa

    def activa(self):
        return self._activa


class ComandosFase5Tests(unittest.TestCase):
    def setUp(self):
        self._modulo = config.MODULO
        self._habilitado = config.MONITOREO_MOVIMIENTO_HABILITADO
        self.cmd, self._restaurar = base.cargar_comandos()
        self.audio = base.FakeAudio()
        self.cmd.conectar_audio(self.audio)

    def tearDown(self):
        config.MODULO = self._modulo
        config.MONITOREO_MOVIMIENTO_HABILITADO = self._habilitado
        self.cmd.conectar_voz(None)
        self._restaurar()

    def ejecutar(self, modulo, comando, **params):
        config.MODULO = modulo
        return self.cmd.ejecutar({"command_id": "t", "command": comando, "params": params})

    def test_el_monitoreo_remoto_arranca_apagado(self):
        self.assertFalse(self.cmd.monitoreo_movimiento())

    def test_motion_set_enciende_y_apaga_solo_si_el_pir_esta_habilitado(self):
        config.MONITOREO_MOVIMIENTO_HABILITADO = True
        r = self.ejecutar("cuna", "motion_set", enabled=True)
        self.assertEqual((r["ok"], r["result"]), (True, {"enabled": True}))
        self.assertTrue(self.cmd.monitoreo_movimiento())
        r = self.ejecutar("cuna", "motion_set", enabled=False)
        self.assertEqual((r["ok"], r["result"]), (True, {"enabled": False}))
        self.assertFalse(self.cmd.monitoreo_movimiento())

    def test_motion_set_con_el_pir_deshabilitado_falla_y_no_cambia_nada(self):
        config.MONITOREO_MOVIMIENTO_HABILITADO = False
        r = self.ejecutar("cuna", "motion_set", enabled=True)
        self.assertEqual((r["ok"], r["error"]), (False, "movimiento_no_habilitado"))
        self.assertFalse(self.cmd.monitoreo_movimiento())

    def test_motion_set_valida_el_parametro(self):
        config.MONITOREO_MOVIMIENTO_HABILITADO = True
        for params in ({}, {"enabled": 1}, {"enabled": "true"}, {"enabled": None}):
            r = self.ejecutar("cuna", "motion_set", **params)
            self.assertEqual((r["ok"], r["error"]), (False, "parametro_invalido:enabled"), params)
        self.assertFalse(self.cmd.monitoreo_movimiento())

    def test_motion_set_solo_sirve_en_el_modulo_cuna(self):
        config.MONITOREO_MOVIMIENTO_HABILITADO = True
        for modulo in ("figuras", "colchon"):
            r = self.ejecutar(modulo, "motion_set", enabled=True)
            self.assertEqual((r["ok"], r["error"]), (False, "comando_de_otro_modulo:%s" % modulo))
        self.assertFalse(self.cmd.monitoreo_movimiento())

    def test_audio_play_se_rechaza_mientras_hay_voz(self):
        self.cmd.conectar_voz(FalsaVoz(True))
        r = self.ejecutar("cuna", "audio_play", sound="tono_suave")
        self.assertEqual((r["ok"], r["error"]), (False, "voz_en_curso"))
        self.cmd.conectar_voz(FalsaVoz(False))
        r = self.ejecutar("cuna", "audio_play", sound="tono_suave")
        self.assertTrue(r["ok"])

    def test_motion_set_pertenece_al_periferico_movimiento(self):
        self.assertEqual(self.cmd.modulo.periferico_de("motion_set"), "movimiento")


if __name__ == "__main__":
    unittest.main()
