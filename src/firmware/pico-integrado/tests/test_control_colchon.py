import unittest

import _ruta
import control_colchon
from control_colchon import ControlColchon

# Calibracion de los ejemplos: tara 10000 cuentas y 420 cuentas/g.
TARA = 10000
CUENTAS_1000_G = 430000
CUENTAS_890_G = 383800      # (383800 - 10000) / 420 = 890 g
CUENTAS_900_G = 388000      # 900 g
CUENTAS_500_G = 220000      # 500 g


class FakeSensor:
    def __init__(self, valor=TARA):
        self.valor = valor
        self.esta_listo = True
        self.llamadas_leer = 0
        self.falla = False

    def listo(self):
        return self.esta_listo

    def leer(self):
        self.llamadas_leer += 1
        if self.falla:
            raise OSError("hx711")
        return self.valor


class FakePin:
    def __init__(self, nivel=1):
        self.nivel = nivel
        self.escrituras = []

    def value(self, v=None):
        if v is None:
            return self.nivel
        self.nivel = v
        self.escrituras.append(v)


class Base(unittest.TestCase):
    def crear(self, **cambios):
        datos = dict(COLCHON_REQUIERE_WIFI=False, COLCHON_MUESTRAS_CAPTURA=3)
        datos.update(cambios)
        self.cfg = _ruta.cfg_prueba(**datos)
        self.sensor = FakeSensor()
        self.buzzer = FakePin(0)
        self.boton = FakePin(1)             # 1 = suelto (pull-up)
        self.c = ControlColchon(self.sensor, self.buzzer, self.boton, self.cfg)
        self.t = 0
        self.wifi = True

    def avanzar(self, ms=0):
        self.t += ms
        return self.c.actualizar(self.t, self.wifi)

    def completar(self):
        for _ in range(50):
            if not self.c.captura_activa():
                return self.c.ultimo_resultado
            self.avanzar(10)
        self.fail("la captura no termino")

    def calibrar(self):
        self.sensor.valor = TARA
        self.c.tara(self.t)
        self.assertTrue(self.completar()["ok"])
        self.sensor.valor = CUENTAS_1000_G
        self.c.calibrar(1000, self.t)
        self.assertTrue(self.completar()["ok"])

    def armar_en(self, cuentas=CUENTAS_1000_G, duracion=None):
        self.sensor.valor = cuentas
        self.c.armar(duracion, self.t)
        return self.completar()

    def segundos(self, n, cuentas):
        self.sensor.valor = cuentas
        for _ in range(n):
            self.avanzar(1000)


class Arranque(Base):
    def test_arranca_apagado_e_inactivo(self):
        self.crear()
        self.assertEqual(self.buzzer.nivel, 0)
        self.assertEqual(self.c.estado(0)["estado"], "inactivo")
        self.assertEqual(self.sensor.llamadas_leer, 0)
        self.avanzar(5000)
        self.assertEqual(self.sensor.llamadas_leer, 0)      # inactivo: no muestrea

    def test_armar_exige_calibracion_explicita(self):
        self.crear()
        with self.assertRaises(ValueError) as e:
            self.c.armar(None, 0)
        self.assertEqual(str(e.exception), "sin_calibracion")
        self.c.tara(0)
        self.completar()
        with self.assertRaises(ValueError):                 # tara sola no basta
            self.c.armar(None, self.t)

    def test_calibrar_exige_tara_y_peso_valido(self):
        self.crear()
        with self.assertRaises(ValueError) as e:
            self.c.calibrar(1000, 0)
        self.assertEqual(str(e.exception), "falta_tara")
        self.sensor.valor = TARA
        self.c.tara(0)
        self.completar()
        for peso in (0, -3, None, True):
            with self.assertRaises(ValueError):
                self.c.calibrar(peso, self.t)

    def test_referencia_valida_positiva_tras_calibrar(self):
        self.crear()
        self.calibrar()
        res = self.armar_en(CUENTAS_1000_G, 300)
        self.assertTrue(res["ok"])
        self.assertEqual(res["referencia_g"], 1000.0)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")

    def test_referencia_no_positiva_no_arma(self):
        self.crear()
        self.calibrar()
        res = self.armar_en(5000)           # por debajo de la tara -> gramos negativos
        self.assertEqual(res, {"ok": False, "accion": "armar", "error": "referencia_invalida"})
        self.assertEqual(self.c.estado(self.t)["estado"], "inactivo")

    def test_duracion_invalida_no_arma(self):
        self.crear()
        self.calibrar()
        for dur in (0, -1, float("nan"), 10 ** 9):
            with self.assertRaises(ValueError, msg=dur):
                self.c.armar(dur, self.t)
        self.assertFalse(self.c.captura_activa())

    def test_lectura_invalida_en_captura_cancela(self):
        self.crear()
        self.sensor.falla = True
        self.c.tara(0)
        res = self.completar()
        self.assertEqual(res["error"], "lectura_invalida")
        self.assertFalse(self.c.estado(0)["calibrado"])

    def test_captura_sin_respuesta_por_timeout(self):
        self.crear()
        self.sensor.esta_listo = False
        self.c.tara(0)
        self.avanzar(9999)
        self.assertTrue(self.c.captura_activa())
        self.avanzar(1)
        self.assertEqual(self.c.ultimo_resultado["error"], "captura_sin_respuesta")

    def test_no_se_mide_durante_monitoreo(self):
        self.crear()
        self.calibrar()
        self.armar_en()
        for accion in (lambda: self.c.tara(self.t), lambda: self.c.calibrar(500, self.t),
                       lambda: self.c.leer_peso(self.t), lambda: self.c.armar(None, self.t)):
            with self.assertRaises(ValueError):
                accion()


class Monitoreo(Base):
    def activo(self, **cambios):
        self.crear(**cambios)
        self.calibrar()
        self.assertTrue(self.armar_en()["ok"])

    def test_tres_lecturas_de_890_activan_buzzer(self):
        self.activo()
        self.segundos(2, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")
        self.assertEqual(self.buzzer.nivel, 0)
        self.segundos(1, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "alarma")
        self.assertEqual(self.buzzer.nivel, 1)

    def test_tres_lecturas_de_900_no_activan(self):
        self.activo()
        self.segundos(5, CUENTAS_900_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")
        self.assertEqual(self.buzzer.nivel, 0)

    def test_890_luego_1000_no_completa_el_filtro(self):
        self.activo()
        self.segundos(1, CUENTAS_890_G)
        self.segundos(1, CUENTAS_1000_G)
        self.segundos(1, CUENTAS_890_G)
        self.segundos(1, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")

    def test_muestrea_cada_segundo_no_antes(self):
        self.activo()
        base = self.sensor.llamadas_leer
        self.sensor.valor = CUENTAS_1000_G
        for _ in range(9):
            self.avanzar(100)
        self.assertEqual(self.sensor.llamadas_leer, base)
        self.avanzar(100)
        self.assertEqual(self.sensor.llamadas_leer, base + 1)

    def test_hx711_no_listo_salta_y_luego_cuenta_como_invalida(self):
        self.activo()
        self.segundos(2, CUENTAS_890_G)             # 2 lecturas fuera de tolerancia
        lecturas = self.sensor.llamadas_leer
        self.sensor.esta_listo = False
        self.avanzar(1000)                          # toca leer, no esta listo: salta
        self.avanzar(1000)
        self.assertEqual(self.sensor.llamadas_leer, lecturas)
        self.assertEqual(self.c.estado(self.t)["consecutivas"], 2)   # saltar no rompe
        self.avanzar(1000)                          # 2000 ms sin "listo": invalida
        self.assertEqual(self.c.estado(self.t)["consecutivas"], 0)
        self.assertEqual(self.c.estado(self.t)["lecturas_invalidas"], 1)
        self.sensor.esta_listo = True
        self.segundos(1, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["consecutivas"], 1)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")

    def test_error_de_lectura_rompe_el_filtro(self):
        self.activo()
        self.segundos(2, CUENTAS_890_G)
        self.sensor.falla = True
        self.avanzar(1000)
        self.sensor.falla = False
        self.segundos(1, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")

    def test_duracion_del_monitoreo_lo_detiene(self):
        self.crear()
        self.calibrar()
        self.armar_en(duracion=5)
        self.sensor.valor = CUENTAS_1000_G
        self.avanzar(4000)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")
        self.avanzar(1000)
        estado = self.c.estado(self.t)
        self.assertEqual(estado["estado"], "detenido")
        self.assertEqual(estado["motivo_parada"], "duracion")


class Alarma(Base):
    def alarma(self, **cambios):
        self.crear(**cambios)
        self.calibrar()
        self.armar_en()
        self.segundos(3, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "alarma")
        self.assertEqual(self.buzzer.nivel, 1)

    def pulsar(self, ms=100):
        self.boton.nivel = 0
        self.avanzar(0)
        self.avanzar(ms)
        self.boton.nivel = 1
        self.avanzar(0)

    def test_boton_apaga_y_deja_detenido(self):
        self.alarma()
        self.pulsar()
        estado = self.c.estado(self.t)
        self.assertEqual(estado["estado"], "detenido")
        self.assertEqual(estado["motivo_parada"], "boton")
        self.assertEqual(self.buzzer.nivel, 0)
        self.segundos(5, CUENTAS_1000_G)            # no se reanuda solo
        self.assertEqual(self.c.estado(self.t)["estado"], "detenido")

    def test_rebote_corto_del_boton_no_detiene(self):
        self.alarma()
        self.boton.nivel = 0
        self.avanzar(0)
        self.avanzar(20)
        self.boton.nivel = 1
        self.avanzar(20)
        self.assertEqual(self.c.estado(self.t)["estado"], "alarma")

    def test_boton_con_monitoreo_activo_solo_detiene(self):
        self.crear()
        self.calibrar()
        self.armar_en()
        self.pulsar()
        self.assertEqual(self.c.estado(self.t)["estado"], "detenido")

    def test_boton_sin_monitoreo_no_arma_ni_cambia_nada(self):
        self.crear()
        self.pulsar()
        self.assertEqual(self.c.estado(self.t)["estado"], "inactivo")
        self.assertEqual(self.c.pulsaciones, 1)

    def test_timeout_de_alarma_60_s(self):
        self.alarma()
        self.avanzar(59999)
        self.assertEqual(self.buzzer.nivel, 1)
        self.avanzar(1)
        estado = self.c.estado(self.t)
        self.assertEqual(estado["estado"], "detenido")
        self.assertEqual(estado["motivo_parada"], "timeout_alarma")
        self.assertEqual(self.buzzer.nivel, 0)

    def test_timeout_configurable(self):
        self.alarma(COLCHON_ALARMA_MAX_S=5)
        self.avanzar(5000)
        self.assertEqual(self.buzzer.nivel, 0)

    def test_comando_detener_apaga(self):
        self.alarma()
        res = self.c.detener(self.t)
        self.assertEqual(res, {"detenido": True, "estado": "detenido"})
        self.assertEqual(self.buzzer.nivel, 0)

    def test_rearmar_exige_detenido_y_toma_referencia_nueva(self):
        self.alarma()
        with self.assertRaises(ValueError) as e:
            self.c.rearmar(None, self.t)
        self.assertEqual(str(e.exception), "no_detenido")
        self.pulsar()
        self.sensor.valor = CUENTAS_500_G
        self.c.rearmar(None, self.t)
        self.assertTrue(self.completar()["ok"])
        estado = self.c.estado(self.t)
        self.assertEqual(estado["estado"], "activo")
        self.assertEqual(estado["referencia_g"], 500.0)
        self.assertEqual(estado["consecutivas"], 0)
        self.assertEqual(self.buzzer.nivel, 0)
        self.segundos(4, CUENTAS_500_G)             # 500 g es lo normal ahora
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")

    def test_rearmar_conserva_duracion_anterior(self):
        self.crear()
        self.calibrar()
        self.armar_en(duracion=7)
        self.c.detener(self.t)
        self.c.rearmar(None, self.t)
        self.completar()
        self.assertEqual(self.c.estado(self.t)["duracion_s"], 7)

    def test_buzzer_de_prueba_se_apaga_solo_y_con_detener(self):
        self.crear()
        self.c.buzzer_prueba(True, self.t)
        self.assertEqual(self.buzzer.nivel, 1)
        self.avanzar(59999)
        self.assertEqual(self.buzzer.nivel, 1)
        self.avanzar(1)
        self.assertEqual(self.buzzer.nivel, 0)
        self.c.buzzer_prueba(True, self.t)
        self.c.detener(self.t)
        self.assertEqual(self.buzzer.nivel, 0)
        self.c.buzzer_prueba(True, self.t)
        self.pulsar()
        self.assertEqual(self.buzzer.nivel, 0)

    def test_apagar_deja_todo_seguro(self):
        self.alarma()
        self.c.apagar()
        self.assertEqual(self.buzzer.nivel, 0)
        self.assertEqual(self.c.monitor.estado, "detenido")


class PerdidaDeWifi(Base):
    def test_sin_wifi_con_monitoreo_activo_detiene_y_exige_rearme(self):
        self.crear(COLCHON_REQUIERE_WIFI=True)
        self.avanzar(0)                              # wifi ok
        self.calibrar()
        self.assertTrue(self.armar_en()["ok"])
        self.wifi = False
        self.avanzar(10)
        estado = self.c.estado(self.t)
        self.assertEqual(estado["estado"], "detenido")
        self.assertEqual(estado["motivo_parada"], "wifi_perdido")
        self.wifi = True
        self.segundos(4, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "detenido")   # no se reanuda
        self.assertEqual(self.buzzer.nivel, 0)

    def test_no_se_arma_sin_wifi(self):
        self.crear(COLCHON_REQUIERE_WIFI=True)
        self.wifi = True
        self.avanzar(0)
        self.calibrar()
        self.wifi = False
        self.avanzar(10)
        with self.assertRaises(ValueError) as e:
            self.c.armar(None, self.t)
        self.assertEqual(str(e.exception), "sin_wifi")

    def test_wifi_que_cae_durante_la_captura_no_arma(self):
        self.crear(COLCHON_REQUIERE_WIFI=True)
        self.avanzar(0)
        self.calibrar()
        self.sensor.valor = CUENTAS_1000_G
        self.c.armar(None, self.t)
        self.wifi = False
        res = self.completar()
        self.assertEqual(res["error"], "sin_wifi")
        self.assertEqual(self.c.estado(self.t)["estado"], "inactivo")

    def test_alarma_en_curso_se_apaga_y_exige_rearme_sin_wifi(self):
        self.crear(COLCHON_REQUIERE_WIFI=True)
        self.avanzar(0)
        self.calibrar()
        self.armar_en()
        self.segundos(3, CUENTAS_890_G)
        self.assertEqual(self.buzzer.nivel, 1)
        self.wifi = False
        self.avanzar(100)
        estado = self.c.estado(self.t)
        self.assertEqual(estado["estado"], "detenido")
        self.assertEqual(estado["motivo_parada"], "wifi_perdido")
        self.assertEqual(self.buzzer.nivel, 0)
        self.wifi = True
        self.segundos(4, CUENTAS_890_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "detenido")

    def test_prueba_controlada_sin_exigir_wifi(self):
        self.crear(COLCHON_REQUIERE_WIFI=False)
        self.wifi = False
        self.calibrar()
        self.assertTrue(self.armar_en()["ok"])
        self.segundos(5, CUENTAS_1000_G)
        self.assertEqual(self.c.estado(self.t)["estado"], "activo")


class ConfigCopiada(unittest.TestCase):
    def test_copiar_config_aplica_cambios_sin_tocar_el_original(self):
        import config
        cfg = control_colchon.copiar_config(config, COLCHON_REQUIERE_WIFI=False)
        self.assertFalse(cfg.COLCHON_REQUIERE_WIFI)
        self.assertTrue(config.COLCHON_REQUIERE_WIFI)
        self.assertEqual(cfg.PIN_BUZZER, config.PIN_BUZZER)


if __name__ == "__main__":
    unittest.main()
