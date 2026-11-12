import struct
import unittest

import _ruta
import audio
from audio import ReproductorAudio


class FakeI2S:
    """I2S no bloqueante: write() retorna ya y copia al buffer interno cuando
    hay lugar; el irq avisa al terminar la copia. Un write mientras otro sigue
    en vuelo se cuenta en `superpuestas` (en hardware corrompe el descriptor)."""

    def __init__(self, capacidad=6400):
        self.capacidad = capacidad
        self.ocupado = 0
        self.flujo = bytearray()
        self.cb = None
        self.irq_llamadas = []
        self.deinit_llamado = 0
        self.falla_write = False
        self.superpuestas = 0
        self.en_vuelo = None        # parte aun sin copiar
        self.aviso = False

    def irq(self, cb):
        self.irq_llamadas.append(cb)
        self.cb = cb

    def write(self, buf):
        if self.falla_write:
            raise OSError("dma")
        if self.en_vuelo is not None:
            self.superpuestas += 1
        self.en_vuelo = bytes(buf)
        self._copiar()

    def _copiar(self):
        n = min(len(self.en_vuelo), self.capacidad - self.ocupado)
        self.ocupado += n
        self.flujo.extend(self.en_vuelo[:n])
        self.en_vuelo = self.en_vuelo[n:]
        if not self.en_vuelo:
            self.en_vuelo = None
            self.aviso = True

    def deinit(self):
        self.deinit_llamado += 1

    def consumir(self, n):
        """El DMA reproduce n bytes; si se copio un bloque, avisa por irq."""
        self.ocupado = max(0, self.ocupado - n)
        if self.en_vuelo is not None:
            self._copiar()
        if self.aviso:
            self.aviso = False
            if self.cb is not None:
                self.cb(self)


class Base(unittest.TestCase):
    def crear(self, i2s=None, fabrica=None, **cambios):
        datos = dict(AUDIO_DURACION_S=0.5)      # 10 bloques de 50 ms (mas que el buffer de 4)
        datos.update(cambios)
        self.cfg = _ruta.cfg_prueba(**datos)
        self.t = [0]
        self.i2s = i2s if i2s is not None else FakeI2S()
        self.ibuf_pedido = []

        def fab(ibuf):
            self.ibuf_pedido.append(ibuf)
            return self.i2s
        self.r = ReproductorAudio(fabrica or fab, self.cfg, lambda: self.t[0])

    def reproducir_todo(self, limite=60):
        """Consume bloques hasta entregar el ultimo y deja que se escriba el drenaje."""
        for _ in range(limite):
            if self.r.estado()["estado"] != "reproduciendo":
                break
            self.i2s.consumir(self.r.bloque_bytes)
        else:
            self.fail("no termino de enviar bloques")

    @staticmethod
    def muestras(datos):
        return struct.unpack("<%dh" % (len(datos) // 2), bytes(datos))

    def bloques(self):
        n = self.r.bloque_bytes
        flujo = bytes(self.i2s.flujo)
        return [flujo[i:i + n] for i in range(0, len(flujo), n)]


class Limites(Base):
    def test_catalogo_fijo_de_un_sonido(self):
        self.assertEqual(tuple(audio.CATALOGO), ("tono_suave",))

    def test_apagado_por_defecto_en_config(self):
        self.assertFalse(_ruta.config.AUDIO_HABILITADO)

    def test_formato_pcm16_mono_16khz_y_bloques_enteros(self):
        self.crear()
        self.assertEqual(self.r.tasa, 16000)
        self.assertEqual(self.r.bloque_bytes, 1600)         # 800 muestras de 16 bits
        self.assertEqual(self.r._muestras_bloque % self.r._periodo, 0)

    def test_amplitud_no_supera_el_tope(self):
        self.crear()
        self.r.iniciar("tono_suave")
        tope = int(32767 * 10 / 100)
        for bloque in self.r._bufs[:3]:
            pico = max(abs(m) for m in self.muestras(bloque))
            self.assertLessEqual(pico, tope)
        self.assertGreater(max(abs(m) for m in self.muestras(self.r._bufs[1])), tope * 0.9)

    def test_volumen_excesivo_se_recorta_al_maximo(self):
        self.crear(AUDIO_VOLUMEN_PCT=100)
        self.assertEqual(self.r.volumen_pct, 25)
        self.r.iniciar("tono_suave")
        pico = max(abs(m) for m in self.muestras(self.r._bufs[1]))
        self.assertLessEqual(pico, int(32767 * 25 / 100))

    def test_volumen_invalido_se_rechaza(self):
        for pct in (-1, None, float("nan"), "10", True):
            with self.assertRaises(ValueError, msg=pct):
                self.crear(AUDIO_VOLUMEN_PCT=pct)

    def test_volumen_cero_es_silencio(self):
        self.crear(AUDIO_VOLUMEN_PCT=0)
        self.r.iniciar("tono_suave")
        self.assertEqual(set(self.i2s.flujo), {0})

    def test_duracion_se_recorta_y_valida(self):
        self.crear(AUDIO_DURACION_S=999)
        self.assertEqual(self.r.duracion_s, 30)
        self.assertEqual(self.r._total, 600)
        for dur in (0, -1, 0.05, None, float("nan")):
            with self.assertRaises(ValueError, msg=dur):
                self.crear(AUDIO_DURACION_S=dur)

    def test_frecuencia_incompatible_con_bloques_se_rechaza(self):
        with self.assertRaises(ValueError):
            self.crear(AUDIO_FRECUENCIA_HZ=440)             # 16000 no es multiplo

    def test_sonido_desconocido_y_doble_inicio(self):
        self.crear()
        with self.assertRaises(ValueError) as e:
            self.r.iniciar("rock")
        self.assertEqual(str(e.exception), "audio_desconocido")
        self.assertEqual(self.r.estado()["estado"], "inactivo")
        self.r.iniciar("tono_suave")
        with self.assertRaises(ValueError) as e:
            self.r.iniciar("tono_suave")
        self.assertEqual(str(e.exception), "audio_en_curso")


class Reproduccion(Base):
    def test_no_toca_el_i2s_hasta_reproducir(self):
        self.crear()
        self.assertEqual(self.ibuf_pedido, [])
        self.assertEqual(self.r.estado()["estado"], "inactivo")

    def test_iniciar_no_bloquea_registra_irq_y_llena_el_buffer(self):
        self.crear()
        res = self.r.iniciar("tono_suave")
        self.assertEqual(res["sound"], "tono_suave")
        self.assertEqual(self.r.estado()["estado"], "reproduciendo")
        self.assertEqual(self.ibuf_pedido, [self.r.ibuf_bytes])
        self.assertEqual(len(self.i2s.irq_llamadas), 1)
        self.assertEqual(self.i2s.cb, self.r._cb)            # referencia propia al callback
        self.assertEqual(len(self.i2s.flujo), 1600)          # un solo write en vuelo
        self.assertEqual(self.muestras(self.i2s.flujo)[0], 0)   # sube desde silencio

    def test_secuencia_completa_con_rampas_y_drenaje(self):
        self.crear()
        self.r.iniciar("tono_suave")
        self.reproducir_todo()
        self.assertEqual(self.r.estado()["estado"], "drenando")
        self.assertEqual(self.i2s.deinit_llamado, 0)         # aun no: falta vaciar el ultimo bloque
        bloques = self.bloques()
        sonoros = [b for b in bloques if any(b)]
        self.assertEqual(len(sonoros), 10)                   # 500 ms = 10 bloques
        self.assertEqual(self.muestras(sonoros[0])[0], 0)    # sube desde silencio
        self.assertEqual(self.muestras(sonoros[-1])[-1], 0)  # termina en silencio (rampa)
        self.assertEqual(bloques, sonoros)                   # solo sonido, sin relleno
        self.assertEqual(self.i2s.superpuestas, 0)

    def test_cierra_al_cumplirse_el_tiempo_de_drenaje(self):
        self.crear()
        self.r.iniciar("tono_suave")
        self.t[0] = 100
        self.reproducir_todo()
        fin = self.r._fin_drenaje
        self.assertEqual(fin, 100 + 200 + 50 + 100)          # buffer 200 ms + bloque + margen
        self.assertEqual(self.r.actualizar(fin - 1), "drenando")
        self.assertEqual(self.i2s.deinit_llamado, 0)
        self.assertEqual(self.r.actualizar(fin), "inactivo")
        self.assertEqual(self.i2s.deinit_llamado, 1)
        self.assertIsNone(self.i2s.cb)                       # irq retirado
        self.assertIsNone(self.r._i2s)
        self.assertEqual(self.r.actualizar(fin + 50), "inactivo")

    def test_buffer_chico_no_superpone_escrituras_ni_pierde_datos(self):
        self.crear(i2s=FakeI2S(capacidad=1000))
        self.r.iniciar("tono_suave")
        for _ in range(200):
            if self.r.estado()["estado"] != "reproduciendo":
                break
            self.i2s.consumir(700)
        self.assertEqual(self.r.estado()["estado"], "drenando")
        self.assertEqual(self.i2s.superpuestas, 0)
        entrada, cuerpo, salida, _ = self.r._bufs
        esperado = bytes(entrada) + bytes(cuerpo) * 8 + bytes(salida)
        self.assertEqual(bytes(self.i2s.flujo), esperado)

    def test_aviso_de_instancia_cerrada_se_ignora(self):
        self.crear()
        self.r.iniciar("tono_suave")
        vieja = self.i2s
        self.r.detener()
        self.i2s = FakeI2S()
        self.r.iniciar("tono_suave")
        self.r._cb(vieja)                       # aviso tardio de la instancia anterior
        self.assertEqual(len(self.i2s.flujo), 1600)
        self.assertEqual(self.i2s.superpuestas, 0)

    def test_detener_corta_y_libera(self):
        self.crear()
        self.r.iniciar("tono_suave")
        escrito = len(self.i2s.flujo)
        self.assertEqual(self.r.detener()["estado"], "inactivo")
        self.assertEqual(self.i2s.deinit_llamado, 1)
        self.i2s.cb = self.r._cb                    # un aviso tardio no debe escribir nada
        self.i2s.aviso = True
        self.i2s.consumir(1600)
        self.assertEqual(len(self.i2s.flujo), escrito)
        self.assertEqual(self.r.detener()["estado"], "inactivo")    # idempotente
        self.assertEqual(self.i2s.deinit_llamado, 1)

    def test_puede_volver_a_reproducir_reutilizando_bloques(self):
        self.crear()
        self.r.iniciar("tono_suave")
        bufs = self.r._bufs
        self.r.detener()
        self.r.iniciar("tono_suave")
        self.assertIs(self.r._bufs, bufs)

    def test_estado_no_reproduce_nada(self):
        self.crear()
        self.assertEqual(self.r.estado(), {"estado": "inactivo", "sound": None,
                                           "volume_pct": 10, "error": None})


class Errores(Base):
    def test_fallo_al_crear_i2s_no_propaga_otra_cosa_que_valueerror(self):
        def mala(_ibuf):
            raise OSError("pines")
        self.crear(fabrica=mala)
        with self.assertRaises(ValueError) as e:
            self.r.iniciar("tono_suave")
        self.assertEqual(str(e.exception), "audio_i2s_error")
        estado = self.r.estado()
        self.assertEqual(estado["estado"], "error")
        self.assertEqual(estado["error"], "OSError")

    def test_recupera_tras_error(self):
        intentos = []
        buena = FakeI2S()

        def fab(_ibuf):
            intentos.append(1)
            if len(intentos) == 1:
                raise MemoryError()
            return buena
        self.crear(fabrica=fab)
        with self.assertRaises(ValueError):
            self.r.iniciar("tono_suave")
        self.r.iniciar("tono_suave")
        self.assertEqual(self.r.estado()["estado"], "reproduciendo")
        self.assertIsNone(self.r.estado()["error"])

    def test_fallo_de_write_al_iniciar(self):
        i2s = FakeI2S()
        i2s.falla_write = True
        self.crear(i2s=i2s)
        with self.assertRaises(ValueError):
            self.r.iniciar("tono_suave")
        self.assertEqual(self.r.estado()["estado"], "error")
        self.assertEqual(i2s.deinit_llamado, 1)

    def test_fallo_en_el_callback_no_propaga_y_libera(self):
        self.crear()
        self.r.iniciar("tono_suave")
        self.i2s.falla_write = True
        self.i2s.consumir(1600)                     # no debe lanzar
        self.assertEqual(self.r.estado()["estado"], "error")
        self.assertEqual(self.r.estado()["error"], "OSError")
        self.assertEqual(self.i2s.deinit_llamado, 1)

    def test_deinit_que_falla_no_rompe_el_cierre(self):
        self.crear()
        self.r.iniciar("tono_suave")

        def mal():
            raise OSError("deinit")
        self.i2s.deinit = mal
        self.assertEqual(self.r.detener()["estado"], "inactivo")

    def test_callback_que_nunca_llega_se_marca_error(self):
        self.crear()
        self.r.iniciar("tono_suave")
        limite = 200 + 1000                          # buffer interno + margen
        self.assertEqual(self.r.actualizar(limite), "reproduciendo")
        self.assertEqual(self.r.actualizar(limite + 1), "error")
        self.assertEqual(self.r.estado()["error"], "sin_callback")
        self.assertEqual(self.i2s.deinit_llamado, 1)

    def test_detener_desde_error_vuelve_a_inactivo(self):
        def mala(_ibuf):
            raise OSError()
        self.crear(fabrica=mala)
        with self.assertRaises(ValueError):
            self.r.iniciar("tono_suave")
        self.assertEqual(self.r.detener()["estado"], "inactivo")


class Pines(unittest.TestCase):
    def test_pines_propuestos_validos(self):
        audio.validar_pines(_ruta.config)
        self.assertEqual((_ruta.config.PIN_I2S_BCLK, _ruta.config.PIN_I2S_WS,
                          _ruta.config.PIN_I2S_DIN), (6, 7, 8))

    def test_rechaza_ws_no_consecutivo_y_pines_wifi(self):
        with self.assertRaises(ValueError):
            audio.validar_pines(_ruta.cfg_prueba(PIN_I2S_WS=9))
        with self.assertRaises(ValueError):
            audio.validar_pines(_ruta.cfg_prueba(PIN_I2S_BCLK=24, PIN_I2S_WS=25))
        with self.assertRaises(ValueError):
            audio.validar_pines(_ruta.cfg_prueba(PIN_I2S_DIN=29))


if __name__ == "__main__":
    unittest.main()
