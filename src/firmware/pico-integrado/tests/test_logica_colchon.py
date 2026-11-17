import unittest

import _ruta  # noqa: F401
from logica_colchon import (ACTIVO, ALARMA, DETENIDO, INACTIVO, PERIODO_TICKS,
                            Antirrebote, Calibracion, Monitor, diferencia_ms)


def monitor(**kw):
    datos = dict(tolerancia_pct=10, lecturas_requeridas=3, alarma_max_s=60,
                 duracion_max_s=86400)
    datos.update(kw)
    return Monitor(**datos)


def armado(referencia=1000, duracion_s=300, t0=0, **kw):
    m = monitor(**kw)
    m.armar(referencia, duracion_s, t0)
    return m


def alimentar(m, lecturas, t0=0, paso=1000):
    t = t0
    for g in lecturas:
        t += paso
        m.registrar_lectura(g, t)
    return t


class FiltroDeAlarma(unittest.TestCase):
    def test_tres_lecturas_de_890_disparan(self):
        m = armado()
        alimentar(m, [890, 890, 890])
        self.assertEqual(m.estado, ALARMA)
        self.assertTrue(m.buzzer_activo)

    def test_dos_lecturas_no_bastan(self):
        m = armado()
        alimentar(m, [890, 890])
        self.assertEqual(m.estado, ACTIVO)

    def test_tres_de_900_no_disparan_frontera_estricta(self):
        m = armado()
        alimentar(m, [900, 900, 900])
        self.assertEqual(m.estado, ACTIVO)
        self.assertEqual(m.consecutivas, 0)

    def test_justo_bajo_la_frontera_si_cuenta(self):
        m = armado()
        alimentar(m, [899.9, 899.9, 899.9])
        self.assertEqual(m.estado, ALARMA)

    def test_890_luego_1000_rompe_el_filtro(self):
        m = armado()
        alimentar(m, [890, 1000, 890, 890])
        self.assertEqual(m.estado, ACTIVO)
        self.assertEqual(m.consecutivas, 2)

    def test_890_890_1000_890_no_dispara(self):
        m = armado()
        alimentar(m, [890, 890, 1000, 890])
        self.assertEqual(m.estado, ACTIVO)

    def test_lectura_invalida_rompe_el_filtro(self):
        for invalida in (None, float("nan"), float("inf"), "x", True):
            m = armado()
            alimentar(m, [890, 890, invalida, 890])
            self.assertEqual(m.estado, ACTIVO, invalida)
            self.assertEqual(m.consecutivas, 1, invalida)
            self.assertEqual(m.invalidas, 1, invalida)

    def test_lectura_negativa_valida_cuenta_como_perdida(self):
        m = armado()
        alimentar(m, [-5, -5, -5])
        self.assertEqual(m.estado, ALARMA)

    def test_otras_tolerancias_y_lecturas(self):
        m = armado(referencia=2000, tolerancia_pct=5, lecturas_requeridas=2)
        alimentar(m, [1899, 1899])          # perdida 5.05 % > 5 %
        self.assertEqual(m.estado, ALARMA)
        m = armado(referencia=2000, tolerancia_pct=5, lecturas_requeridas=2)
        alimentar(m, [1900, 1900])          # exactamente 5 %
        self.assertEqual(m.estado, ACTIVO)

    def test_sin_monitoreo_no_hay_alarma(self):
        m = monitor()
        alimentar(m, [0, 0, 0, 0])
        self.assertEqual(m.estado, INACTIVO)
        m = armado()
        m.detener("comando")
        alimentar(m, [0, 0, 0, 0])
        self.assertEqual(m.estado, DETENIDO)

    def test_parametros_del_monitor_invalidos(self):
        for kw in ({"tolerancia_pct": 0}, {"tolerancia_pct": 100},
                   {"tolerancia_pct": float("nan")}, {"lecturas_requeridas": 0},
                   {"alarma_max_s": 0}, {"duracion_max_s": -1}):
            with self.assertRaises(ValueError, msg=kw):
                monitor(**kw)


class Armado(unittest.TestCase):
    def test_referencia_y_duracion_invalidas_impiden_armar(self):
        for ref in (None, 0, -1, float("nan"), float("inf"), True, "1000"):
            m = monitor()
            with self.assertRaises(ValueError, msg=ref):
                m.armar(ref, 300, 0)
            self.assertEqual(m.estado, INACTIVO)
        for dur in (None, 0, -5, float("nan"), True, 86401):
            m = monitor()
            with self.assertRaises(ValueError, msg=dur):
                m.armar(1000, dur, 0)
            self.assertEqual(m.estado, INACTIVO)

    def test_no_se_arma_dos_veces(self):
        m = armado()
        with self.assertRaises(ValueError):
            m.armar(1000, 300, 0)
        alimentar(m, [0, 0, 0])
        with self.assertRaises(ValueError):     # en alarma tampoco
            m.armar(1000, 300, 0)


class Temporizadores(unittest.TestCase):
    def test_duracion_del_monitoreo(self):
        m = armado(duracion_s=10, t0=500)
        self.assertEqual(m.actualizar(500 + 9999), ACTIVO)
        self.assertEqual(m.actualizar(500 + 10000), DETENIDO)
        self.assertEqual(m.motivo_parada, "duracion")

    def test_lectura_tras_vencer_no_dispara(self):
        m = armado(duracion_s=2)
        m.registrar_lectura(0, 1000)
        m.registrar_lectura(0, 2000)    # vence aqui, no cuenta
        m.registrar_lectura(0, 3000)
        self.assertEqual(m.estado, DETENIDO)

    def test_alarma_se_apaga_a_los_60_s_y_queda_detenido(self):
        m = armado()
        t = alimentar(m, [890, 890, 890])
        self.assertEqual(m.actualizar(t + 59999), ALARMA)
        self.assertEqual(m.actualizar(t + 60000), DETENIDO)
        self.assertFalse(m.buzzer_activo)
        self.assertEqual(m.motivo_parada, "timeout_alarma")

    def test_timeout_de_alarma_configurable(self):
        m = armado(alarma_max_s=5)
        t = alimentar(m, [890, 890, 890])
        self.assertEqual(m.actualizar(t + 4999), ALARMA)
        self.assertEqual(m.actualizar(t + 5000), DETENIDO)

    def test_vuelta_del_contador_de_ticks(self):
        self.assertEqual(diferencia_ms(5, PERIODO_TICKS - 5), 10)
        self.assertEqual(diferencia_ms(PERIODO_TICKS - 5, 5), -10)
        m = armado(duracion_s=1, t0=PERIODO_TICKS - 400)
        self.assertEqual(m.actualizar(599), ACTIVO)     # pasaron 999 ms
        self.assertEqual(m.actualizar(600), DETENIDO)


class DetenerYRearmar(unittest.TestCase):
    def test_detener_apaga_y_deja_detenido(self):
        m = armado()
        alimentar(m, [890, 890, 890])
        self.assertTrue(m.detener("boton"))
        self.assertEqual(m.estado, DETENIDO)
        self.assertFalse(m.buzzer_activo)

    def test_detener_sin_monitoreo_no_hace_nada(self):
        m = monitor()
        self.assertFalse(m.detener("boton"))
        self.assertEqual(m.estado, INACTIVO)

    def test_detenido_no_se_reanuda_solo(self):
        m = armado()
        m.detener("boton")
        alimentar(m, [1000, 1000, 1000])
        self.assertEqual(m.estado, DETENIDO)

    def test_rearme_explicito_toma_referencia_nueva(self):
        m = armado(referencia=1000)
        alimentar(m, [890, 890, 890])
        m.detener("boton")
        m.armar(500, 60, 10000)
        self.assertEqual(m.estado, ACTIVO)
        self.assertEqual(m.referencia_g, 500)
        self.assertEqual(m.consecutivas, 0)
        self.assertIsNone(m.motivo_parada)
        alimentar(m, [450, 450], t0=10000)   # frente a 1000 g habria sido alarma
        self.assertEqual(m.estado, ACTIVO)


class BotonAntirrebote(unittest.TestCase):
    def test_pulsacion_estable_se_detecta_una_vez(self):
        a = Antirrebote(50)
        self.assertFalse(a.actualizar(True, 0))
        self.assertFalse(a.actualizar(True, 49))
        self.assertTrue(a.actualizar(True, 50))
        self.assertFalse(a.actualizar(True, 100))    # mantener no repite

    def test_rebote_no_cuenta(self):
        a = Antirrebote(50)
        resultados = [a.actualizar(True, 0), a.actualizar(False, 10),
                      a.actualizar(True, 20), a.actualizar(True, 60)]
        self.assertEqual(resultados, [False] * 4)
        self.assertTrue(a.actualizar(True, 70))

    def test_pulso_corto_se_ignora(self):
        a = Antirrebote(50)
        self.assertFalse(a.actualizar(True, 0))
        self.assertFalse(a.actualizar(False, 20))
        self.assertFalse(a.actualizar(False, 100))

    def test_segunda_pulsacion_tras_soltar(self):
        a = Antirrebote(50)
        a.actualizar(True, 0)
        self.assertTrue(a.actualizar(True, 50))
        a.actualizar(False, 100)
        self.assertFalse(a.actualizar(False, 150))   # soltar no es pulsacion
        a.actualizar(True, 200)
        self.assertTrue(a.actualizar(True, 250))


class CalibracionTests(unittest.TestCase):
    def test_sin_calibrar_no_hay_gramos(self):
        c = Calibracion()
        self.assertFalse(c.calibrada)
        self.assertIsNone(c.a_gramos(12345))
        c.fijar_tara(1000)
        self.assertIsNone(c.a_gramos(12345))      # tara sola no basta: no hay factor

    def test_tara_y_pesa_conocida(self):
        c = Calibracion()
        c.fijar_tara(10000)
        c.calibrar(430000, 1000, 100)
        self.assertTrue(c.calibrada)
        self.assertEqual(c.factor, 420.0)
        self.assertEqual(c.a_gramos(430000), 1000.0)
        self.assertEqual(c.a_gramos(10000), 0.0)
        self.assertIsNone(c.a_gramos(None))

    def test_cableado_invertido_da_gramos_positivos(self):
        c = Calibracion()
        c.fijar_tara(10000)
        c.calibrar(-410000, 1000, 100)
        self.assertEqual(c.a_gramos(-410000), 1000.0)

    def test_errores_de_calibracion(self):
        c = Calibracion()
        with self.assertRaises(ValueError):
            c.calibrar(5000, 100, 10)             # falta tara
        c.fijar_tara(1000)
        for peso in (0, -1, None, float("nan"), True):
            with self.assertRaises(ValueError, msg=peso):
                c.calibrar(5000, peso, 10)
        with self.assertRaises(ValueError):
            c.calibrar(1050, 100, 100)            # sin variacion suficiente
        with self.assertRaises(ValueError):
            c.calibrar(None, 100, 10)
        with self.assertRaises(ValueError):
            c.fijar_tara(float("nan"))
        self.assertFalse(c.calibrada)


if __name__ == "__main__":
    unittest.main()
