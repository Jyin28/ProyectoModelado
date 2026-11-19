"""audio.py - Reproductor local para MAX98357A (I2S) en la Pico 2 W.

SIN PROBAR EN HARDWARE con esta estructura. No se mide ni se declara potencia
ni validacion electrica del parlante de 8 ohm / 0,5 W.

Catalogo (config.AUDIO_CATALOGO: nombre -> None o ruta de un WAV; PCM 16 bits,
mono, 16 kHz). El catalogo es de solo lectura: no hay carga de archivos desde la
app (DEC-08); las canciones se copian a la Pico y se agregan a config.py.
  - None ("tono_suave"): tono sintetizado en memoria; el periodo cabe en una
    tabla de 32 muestras y los bloques contienen periodos completos, por eso la
    fase es continua entre bloques.
  - Una ruta (por ejemplo "prueba"): un WAV (como el codigo funcional). Se lee
    del archivo bloque a bloque dentro del callback y se atenua por software al
    volumen configurado; el encabezado se valida (PCM, mono, 16 kHz, 16 bits).

Como funciona (machine.I2S no bloqueante):
  - La salida I2S solo existe mientras suena: se crea en iniciar() y se libera
    (deinit) al terminar o detener. Apagada por defecto.
  - Bloques reutilizables creados una vez: entrada (rampa de subida), cuerpo,
    salida (rampa de bajada). El callback no reserva memoria.
  - Un solo write(buf) en vuelo: el siguiente se hace en el callback .irq(),
    que MicroPython llama cuando el bloque ya se copio al buffer interno. Nunca
    se reescribe un descriptor en uso.
  - Se conservan referencias al objeto I2S, al bloque en vuelo y al callback;
    los avisos de instancias ya cerradas se ignoran.
  - Al confirmarse el ultimo bloque empieza el drenaje fisico (buffer interno
    + DMA + margen) y recien entonces se libera el I2S, sin cortar el final.
  - Watchdog: si un write no se confirma a tiempo, estado "error".
  - Cualquier fallo de I2S deja el estado "error" y NO propaga excepciones al
    ciclo principal: sensores y luces siguen.

Atenuacion digital: amplitud = AUDIO_VOLUMEN_PCT % del maximo de 16 bits,
recortada a AUDIO_VOLUMEN_MAX_PCT.
"""
import math
import struct
import time
from array import array

import rutas

INACTIVO = "inactivo"
REPRODUCIENDO = "reproduciendo"
DRENANDO = "drenando"
ERROR = "error"

BLOQUE_MS = 50              # duracion de cada bloque
BUFFER_BLOQUES = 4          # tamano del buffer interno del I2S, en bloques
MARGEN_DRENAJE_MS = 100
_PERIODO_TICKS = 1 << 30


def _dif_ms(a, b):
    d = (a - b) & (_PERIODO_TICKS - 1)
    if d >= _PERIODO_TICKS // 2:
        d -= _PERIODO_TICKS
    return d


def _reloj_pico():
    return time.ticks_ms()


def _numero(valor):
    return (isinstance(valor, (int, float)) and not isinstance(valor, bool)
            and math.isfinite(valor))


def nombre_sonido_valido(nombre):
    """Nombre que acepta el servidor para audio_play: 1 a 40 de a-z, 0-9 o _."""
    if not isinstance(nombre, str) or not 1 <= len(nombre) <= 40:
        return False
    for caracter in nombre:
        if not ("a" <= caracter <= "z" or "0" <= caracter <= "9" or caracter == "_"):
            return False
    return True


def leer_catalogo(cfg):
    """Copia validada de cfg.AUDIO_CATALOGO ({nombre: None | ruta de WAV})."""
    original = getattr(cfg, "AUDIO_CATALOGO", None)
    if not isinstance(original, dict) or not original:
        raise ValueError("audio_config_invalida")
    catalogo = {}
    for nombre, ruta in original.items():
        if not nombre_sonido_valido(nombre) or not (ruta is None or isinstance(ruta, str)):
            raise ValueError("audio_config_invalida")
        catalogo[nombre] = ruta
    return catalogo


def limitar_volumen(pct, maximo_pct):
    """Valida y recorta el volumen: negativo/no numerico es error; sobre el maximo se recorta."""
    if not _numero(pct) or pct < 0:
        raise ValueError("volumen_invalido")
    return min(pct, maximo_pct)


def limitar_duracion(segundos, maximo_s):
    if not _numero(segundos) or segundos < 2 * BLOQUE_MS / 1000:
        raise ValueError("duracion_invalida")
    return min(segundos, maximo_s)


def _leer_exacto(archivo, cantidad):
    datos = archivo.read(cantidad)
    if len(datos) != cantidad:
        raise ValueError("audio_wav_invalido")
    return datos


def leer_encabezado_wav(archivo, tasa):
    """Deja el archivo al inicio de los datos y devuelve su tamano en bytes.

    Exige PCM sin compresion, mono, 16 bits y la tasa pedida. ValueError con
    el codigo "audio_wav_invalido" si algo no cuadra.
    """
    cabecera = _leer_exacto(archivo, 12)
    if cabecera[0:4] != b"RIFF" or cabecera[8:12] != b"WAVE":
        raise ValueError("audio_wav_invalido")
    formato = None
    while True:
        identificador = archivo.read(4)
        if len(identificador) < 4:
            raise ValueError("audio_wav_invalido")      # sin bloque de datos
        tamano = struct.unpack("<I", _leer_exacto(archivo, 4))[0]
        if identificador == b"fmt ":
            if tamano < 16:
                raise ValueError("audio_wav_invalido")
            formato = struct.unpack("<HHIIHH", _leer_exacto(archivo, 16))
            resto = tamano - 16 + (tamano % 2)
            if resto:
                archivo.seek(resto, 1)
        elif identificador == b"data":
            break
        else:
            archivo.seek(tamano + (tamano % 2), 1)
    if formato is None:
        raise ValueError("audio_wav_invalido")
    codigo, canales, frecuencia, _, _, bits = formato
    if codigo != 1 or canales != 1 or frecuencia != tasa or bits != 16:
        raise ValueError("audio_wav_invalido")
    return tamano - (tamano % 2)


class ReproductorAudio:
    def __init__(self, fabrica, cfg, reloj=None, abrir=None):
        """fabrica(ibuf_bytes) -> objeto I2S (o con irq/write/deinit); cfg: config.py.

        abrir(ruta) -> archivo binario; por defecto open(ruta, "rb") (inyectable en pruebas).
        """
        self._fabrica = fabrica
        self._abrir = abrir if abrir is not None else (lambda ruta: open(rutas.buscar(ruta), "rb"))
        self._catalogo = leer_catalogo(cfg)
        self._archivo = None
        self._restante = 0
        self._wav_bufs = None
        self._total_actual = 0
        self._reloj = reloj if reloj is not None else _reloj_pico
        self.tasa = cfg.AUDIO_TASA_HZ
        self.volumen_pct = limitar_volumen(cfg.AUDIO_VOLUMEN_PCT, cfg.AUDIO_VOLUMEN_MAX_PCT)
        self.duracion_s = limitar_duracion(cfg.AUDIO_DURACION_S, cfg.AUDIO_DURACION_MAX_S)
        self._frecuencia = cfg.AUDIO_FRECUENCIA_HZ

        if not _numero(self.tasa) or self.tasa <= 0 or self._frecuencia <= 0:
            raise ValueError("audio_config_invalida")
        self._periodo = self.tasa // self._frecuencia
        self._muestras_bloque = self.tasa * BLOQUE_MS // 1000
        if (self._periodo < 4 or self.tasa % self._frecuencia != 0
                or self._muestras_bloque % self._periodo != 0):
            raise ValueError("audio_config_invalida")   # los bloques deben tener periodos completos
        self.bloque_bytes = 2 * self._muestras_bloque
        self.ibuf_bytes = BUFFER_BLOQUES * self.bloque_bytes
        self._total = max(2, (int(self.duracion_s * 1000) + BLOQUE_MS - 1) // BLOQUE_MS)
        self._drenaje_ms = (self.ibuf_bytes * 1000 // (2 * self.tasa)
                            + BLOQUE_MS + MARGEN_DRENAJE_MS)

        self._estado = INACTIVO
        self._sonido = None
        self._ultimo_error = None
        self._i2s = None
        self._en_vuelo = None
        self._enviados = 0
        self._t_envio = 0
        self._fin_drenaje = 0
        self._bufs = None
        self._cb = self._al_vaciar      # referencia propia al callback (evita crearlo en el irq)

    # ---------------- bloques ----------------

    def _preparar(self):
        """Crea los bloques una sola vez (se reutilizan en cada reproduccion)."""
        if self._bufs is not None:
            return
        n = self._muestras_bloque
        p = self._periodo
        amplitud = int(32767 * self.volumen_pct / 100)
        tabla = [int(amplitud * math.sin(2 * math.pi * k / p)) for k in range(p)]
        cuerpo = bytearray(2 * n)
        entrada = bytearray(2 * n)
        salida = bytearray(2 * n)
        for i in range(n):
            v = tabla[i % p]
            struct.pack_into("<h", cuerpo, 2 * i, v)
            struct.pack_into("<h", entrada, 2 * i, v * i // n)
            struct.pack_into("<h", salida, 2 * i, v * (n - 1 - i) // n)
        self._bufs = (entrada, cuerpo, salida)
        self._mv = (memoryview(entrada), memoryview(cuerpo), memoryview(salida))

    def _enviar(self):
        """Un unico write() en vuelo: el siguiente solo tras el callback."""
        i = self._enviados
        if self._archivo is not None:
            buf = self._siguiente_wav(i)
            if buf is None:                 # el archivo termino antes de lo anunciado
                self._enviados = self._total_actual
                self._fin_envio()
                return
        elif i == 0:
            buf = self._mv[0]
        elif i == self._total_actual - 1:
            buf = self._mv[2]
        else:
            buf = self._mv[1]
        self._enviados = i + 1
        self._en_vuelo = buf            # referencia viva hasta el callback
        self._t_envio = self._reloj()
        self._i2s.write(buf)            # no bloqueante; no se reescribe el descriptor

    def _fin_envio(self):
        """Ultimo bloque confirmado: falta que el DMA/buffer lo reproduzca."""
        self._estado = DRENANDO
        self._fin_drenaje = (self._reloj() + self._drenaje_ms) & (_PERIODO_TICKS - 1)

    def _siguiente_wav(self, indice):
        """Lee y atenua el siguiente bloque del WAV. None si no quedan datos."""
        if self._restante <= 0:
            return None
        arreglo, vista = self._wav_bufs[indice % 2]
        leidos = self._archivo.readinto(arreglo)
        if not leidos:
            return None
        leidos = min(leidos - (leidos % 2), self._restante)
        if leidos <= 0:
            return None
        self._restante -= leidos
        muestras = leidos // 2
        factor = self.volumen_pct
        for k in range(muestras):
            arreglo[k] = arreglo[k] * factor // 100
        return vista if muestras == len(arreglo) else vista[:muestras]

    def _al_vaciar(self, origen):
        """Callback del I2S (el bloque ya se copio al buffer interno). Nunca lanza."""
        if (self._estado != REPRODUCIENDO or self._i2s is None
                or origen is not self._i2s):
            return                      # instancia cerrada o aviso tardio
        try:
            self._en_vuelo = None
            if self._enviados >= self._total_actual:
                self._fin_envio()
            else:
                self._enviar()
        except Exception as error:
            self._fallar(type(error).__name__)

    # ---------------- control ----------------

    def _cerrar_archivo(self):
        archivo = self._archivo
        self._archivo = None
        self._restante = 0
        if archivo is not None:
            try:
                archivo.close()
            except Exception:
                pass

    def _cerrar_i2s(self):
        self._cerrar_archivo()
        i2s = self._i2s
        self._i2s = None
        self._en_vuelo = None
        if i2s is not None:
            try:
                i2s.irq(None)
            except Exception:
                pass
            try:
                i2s.deinit()
            except Exception:
                pass

    def _fallar(self, nombre):
        self._estado = ERROR
        self._ultimo_error = nombre
        self._cerrar_i2s()

    def iniciar(self, sonido):
        """Empieza a sonar. ValueError con codigo si no se puede (nunca bloquea)."""
        if self._estado in (REPRODUCIENDO, DRENANDO):
            raise ValueError("audio_en_curso")
        if sonido not in self._catalogo:
            raise ValueError("audio_desconocido")
        ruta = self._catalogo[sonido]
        duracion = self.duracion_s
        if ruta is not None:
            duracion = self._abrir_wav(ruta)
        else:
            self._total_actual = self._total
        try:
            if ruta is None:
                self._preparar()
            self._i2s = self._fabrica(self.ibuf_bytes)
            self._enviados = 0
            self._en_vuelo = None
            self._sonido = sonido
            self._ultimo_error = None
            self._estado = REPRODUCIENDO
            self._i2s.irq(self._cb)
            self._enviar()
        except Exception as error:      # OSError, ValueError, MemoryError, TypeError...
            self._fallar(type(error).__name__)
            raise ValueError("audio_i2s_error")
        return {"sound": sonido, "duration_s": duracion,
                "volume_pct": self.volumen_pct}

    def _abrir_wav(self, ruta):
        """Abre y valida el WAV. Devuelve su duracion en segundos (ValueError con codigo)."""
        if not ruta:
            raise ValueError("audio_archivo_no_configurado")
        try:
            archivo = self._abrir(ruta)
        except OSError:
            raise ValueError("audio_archivo_no_encontrado")
        try:
            tamano = leer_encabezado_wav(archivo, self.tasa)
            if tamano <= 0:
                raise ValueError("audio_wav_invalido")
        except Exception:
            try:
                archivo.close()
            except Exception:
                pass
            raise
        if self._wav_bufs is None:
            nuevos = []
            for _ in range(2):
                arreglo = array("h", bytes(self.bloque_bytes))
                nuevos.append((arreglo, memoryview(arreglo)))
            self._wav_bufs = tuple(nuevos)
        self._archivo = archivo
        self._restante = tamano
        self._total_actual = (tamano + self.bloque_bytes - 1) // self.bloque_bytes
        return tamano / (2 * self.tasa)

    def detener(self):
        """Corta ya y libera el I2S. Es seguro llamarlo en cualquier estado."""
        if self._estado in (REPRODUCIENDO, DRENANDO):
            self._estado = INACTIVO
            self._cerrar_i2s()
        elif self._estado == ERROR:
            self._estado = INACTIVO
        return self.estado()

    def actualizar(self, ahora_ms):
        """Cierra al terminar el drenaje y vigila que el callback siga llegando."""
        if self._estado == DRENANDO:
            if _dif_ms(ahora_ms, self._fin_drenaje) >= 0:
                self._estado = INACTIVO
                self._cerrar_i2s()
        elif self._estado == REPRODUCIENDO:
            # Watchdog: cada write debe confirmarse en poco mas que el buffer.
            limite = self.ibuf_bytes * 1000 // (2 * self.tasa) + 1000
            if _dif_ms(ahora_ms, self._t_envio) > limite:
                self._fallar("sin_callback")
        return self._estado

    def estado(self):
        return {"estado": self._estado, "sound": self._sonido,
                "volume_pct": self.volumen_pct, "error": self._ultimo_error}


def _crear_i2s(cfg, ibuf):
    from machine import I2S, Pin
    return I2S(cfg.AUDIO_ID_I2S,
               sck=Pin(cfg.PIN_I2S_BCLK), ws=Pin(cfg.PIN_I2S_WS), sd=Pin(cfg.PIN_I2S_DIN),
               mode=I2S.TX, bits=16, format=I2S.MONO, rate=cfg.AUDIO_TASA_HZ, ibuf=ibuf)


def validar_pines(cfg):
    pines = (cfg.PIN_I2S_BCLK, cfg.PIN_I2S_WS, cfg.PIN_I2S_DIN)
    for pin in pines:
        if pin in cfg.PINES_RESERVADOS_WIFI:
            raise ValueError("pin_reservado_wifi:%d" % pin)
    if cfg.PIN_I2S_WS != cfg.PIN_I2S_BCLK + 1:
        raise ValueError("ws_debe_ser_bclk_mas_1")
    if len(set(pines)) != 3:
        raise ValueError("pin_repetido")


def iniciar(cfg=None):
    """Crea el reproductor (sin tocar ningun pin hasta que se reproduzca algo)."""
    if cfg is None:
        import config as cfg
    validar_pines(cfg)
    return ReproductorAudio(lambda ibuf: _crear_i2s(cfg, ibuf), cfg)
