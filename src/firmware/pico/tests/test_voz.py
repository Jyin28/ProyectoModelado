"""Voz del cuidador en vivo: validacion, cola y sesion con una salida I2S simulada.

No usa hardware, red ni microfono; la voz real sigue sin probarse.
"""
import base64
import struct
import unittest

import _ruta
import voz

CFG = _ruta.cfg_prueba(VOZ_HABILITADA=True)


def pcm(n=160, valor=1000):
    return struct.pack("<%dh" % n, *([valor] * n))


def mensaje(seq, n=160, valor=1000):
    return {"seq": seq, "pcm": base64.b64encode(pcm(n, valor)).decode()}


class FalsoI2S:
    def __init__(self):
        self.escrituras = []
        self.callback = None
        self.cerrado = False

    def irq(self, cb):
        self.callback = cb

    def write(self, buf):
        self.escrituras.append(bytes(buf))

    def deinit(self):
        self.cerrado = True


class FalsoReproductor:
    def __init__(self, estado="inactivo"):
        self._estado = estado

    def estado(self):
        return {"estado": self._estado}


class DecodificarTests(unittest.TestCase):
    def test_acepta_un_fragmento_valido(self):
        seq, datos = voz.decodificar(mensaje(3))
        self.assertEqual((seq, len(datos)), (3, 320))

    def test_rechaza_lo_que_no_cumple_el_contrato(self):
        buenos = mensaje(0)
        casos = [
            None, [], "x", {}, {"seq": 0}, {"pcm": buenos["pcm"]},
            {"seq": True, "pcm": buenos["pcm"]}, {"seq": -1, "pcm": buenos["pcm"]},
            {"seq": 1.5, "pcm": buenos["pcm"]}, {"seq": "1", "pcm": buenos["pcm"]},
            {"seq": 0, "pcm": 5}, {"seq": 0, "pcm": ""}, {"seq": 0, "pcm": "no es base64!!"},
            mensaje(0, n=159), mensaje(0, n=801),
            {"seq": 0, "pcm": "A" * 3000},
        ]
        for caso in casos:
            self.assertIsNone(voz.decodificar(caso), repr(caso)[:60])

    def test_tamanos_limite(self):
        self.assertIsNotNone(voz.decodificar(mensaje(0, n=160)))
        self.assertIsNotNone(voz.decodificar(mensaje(0, n=800)))

    def test_ampliar_duplica_la_tasa_y_aplica_volumen(self):
        salida = voz.ampliar(pcm(160, 1000), 10)
        self.assertEqual(len(salida), 640)
        muestras = struct.unpack("<320h", salida)
        self.assertEqual(set(muestras), {100})


class SesionTests(unittest.TestCase):
    def setUp(self):
        self.reloj = [1000]
        self.i2s = []
        self.v = voz.Voz(self._fabrica, CFG, reloj=lambda: self.reloj[0])

    def _fabrica(self, ibuf):
        falso = FalsoI2S()
        falso.ibuf = ibuf
        self.i2s.append(falso)
        return falso

    def test_sin_fragmentos_no_toca_la_salida(self):
        self.assertEqual(self.v.actualizar(1000), voz.INACTIVA)
        self.assertEqual(self.i2s, [])
        self.assertFalse(self.v.activa())

    def test_el_primer_fragmento_abre_la_salida_y_se_escribe_uno_a_la_vez(self):
        self.assertTrue(self.v.recibir(mensaje(0)))
        self.assertTrue(self.v.recibir(mensaje(1)))
        self.v.actualizar(1000)
        self.assertTrue(self.v.activa())
        salida = self.i2s[0]
        self.assertEqual(len(salida.escrituras), 1)
        self.assertEqual(len(salida.escrituras[0]), 640)
        self.v.actualizar(1010)
        self.assertEqual(len(salida.escrituras), 1, "no se escribe otro hasta el aviso del I2S")
        salida.callback(salida)
        self.v.actualizar(1020)
        self.assertEqual(len(salida.escrituras), 2)

    def test_un_aviso_de_otra_salida_se_ignora(self):
        self.v.recibir(mensaje(0))
        self.v.recibir(mensaje(1))
        self.v.actualizar(1000)
        salida = self.i2s[0]
        salida.callback(object())
        self.v.actualizar(1010)
        self.assertEqual(len(salida.escrituras), 1)

    def test_fragmentos_repetidos_o_atrasados_se_descartan(self):
        self.assertTrue(self.v.recibir(mensaje(5)))
        self.assertFalse(self.v.recibir(mensaje(5)))
        self.assertFalse(self.v.recibir(mensaje(4)))
        self.assertTrue(self.v.recibir(mensaje(6)))

    def test_la_cola_descarta_el_mas_antiguo(self):
        for seq in range(6):
            self.v.recibir(mensaje(seq, valor=100 * (seq + 1)))
        self.v.actualizar(1000)
        primero = struct.unpack("<2h", self.i2s[0].escrituras[0][:4])[0]
        # Quedaron los 4 mas recientes (valores 300 a 600); el primero es 300.
        self.assertEqual(primero, 300 * CFG.AUDIO_VOLUMEN_PCT // 100)

    def test_sin_datos_cierra_la_sesion_y_libera_la_salida(self):
        self.v.recibir(mensaje(0))
        self.v.actualizar(1000)
        salida = self.i2s[0]
        self.v.actualizar(1000 + CFG.VOZ_SIN_DATOS_MS - 1)
        self.assertTrue(self.v.activa())
        self.v.actualizar(1000 + CFG.VOZ_SIN_DATOS_MS + 1)
        self.assertFalse(self.v.activa())
        self.assertTrue(salida.cerrado)

    def test_finalizar_cierra_y_permite_otra_sesion(self):
        self.v.recibir(mensaje(0))
        self.v.actualizar(1000)
        self.v.finalizar()
        self.v.actualizar(1010)
        self.assertFalse(self.v.activa())
        self.assertTrue(self.i2s[0].cerrado)
        self.assertTrue(self.v.recibir(mensaje(0)), "la secuencia de una sesion nueva empieza otra vez")
        self.v.actualizar(1020)
        self.assertEqual(len(self.i2s), 2)

    def test_con_audio_local_sonando_la_voz_se_rechaza(self):
        v = voz.Voz(self._fabrica, CFG, FalsoReproductor("reproduciendo"), lambda: 1000)
        v.recibir(mensaje(0))
        self.assertEqual(v.actualizar(1000), voz.ERROR)
        self.assertEqual(v.estado()["error"], "audio_en_curso")
        self.assertEqual(self.i2s, [])
        self.assertFalse(v.recibir(mensaje(1)))
        v.finalizar()
        self.assertEqual(v.actualizar(1010), voz.INACTIVA)

    def test_un_fallo_de_la_salida_deja_error_sin_lanzar(self):
        def fallar(ibuf):
            raise OSError("sin i2s")
        v = voz.Voz(fallar, CFG, reloj=lambda: 1000)
        v.recibir(mensaje(0))
        self.assertEqual(v.actualizar(1000), voz.ERROR)
        self.assertEqual(v.estado()["error"], "OSError")
        self.assertFalse(v.activa())

    def test_un_fallo_al_escribir_cierra_la_salida(self):
        self.v.recibir(mensaje(0))
        self.v.actualizar(1000)
        salida = self.i2s[0]

        def romper(buf):
            raise OSError("escritura")
        salida.write = romper
        self.v.recibir(mensaje(1))
        salida.callback(salida)
        self.assertEqual(self.v.actualizar(1010), voz.ERROR)
        self.assertTrue(salida.cerrado)

    def test_configuracion_invalida(self):
        for cambios in ({"VOZ_BUFER_FRAGMENTOS": 0}, {"VOZ_SIN_DATOS_MS": 10},
                        {"VOZ_TASA_ENTRADA_HZ": 11025}, {"AUDIO_VOLUMEN_PCT": 0}):
            with self.assertRaises(ValueError, msg=str(cambios)):
                voz.Voz(self._fabrica, _ruta.cfg_prueba(**cambios))

    def test_el_volumen_respeta_el_tope_del_audio(self):
        v = voz.Voz(self._fabrica, _ruta.cfg_prueba(AUDIO_VOLUMEN_PCT=90, AUDIO_VOLUMEN_MAX_PCT=25),
                    reloj=lambda: 1000)
        v.recibir(mensaje(0, valor=1000))
        v.actualizar(1000)
        self.assertEqual(struct.unpack("<h", self.i2s[0].escrituras[0][:2])[0], 250)

    def test_la_voz_esta_habilitada_y_el_audio_tambien(self):
        self.assertTrue(_ruta.config.VOZ_HABILITADA)
        self.assertTrue(_ruta.config.AUDIO_HABILITADO)    # sin audio la voz no se crea


if __name__ == "__main__":
    unittest.main()
