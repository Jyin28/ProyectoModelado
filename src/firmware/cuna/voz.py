"""voz.py - Voz del cuidador en vivo por la salida I2S de la cuna.

SIN PROBAR EN HARDWARE. Contrato: src/shared/contracts/voz.md.

La web envia fragmentos de PCM de 16 bits, mono, 8000 Hz, por un canal privado
de Realtime. Aqui se validan, se llevan a 16 kHz y se reproducen. Nada se
graba ni se guarda: solo hay una cola corta en RAM (VOZ_BUFER_FRAGMENTOS) y,
si se llena, se descarta el fragmento mas antiguo.

Reparto de hilos: recibir() y finalizar() corren en el worker de red y solo
tocan la cola (con candado); actualizar() corre en el ciclo principal y es el
unico que abre, escribe y cierra la salida I2S. Un fallo del I2S deja la voz en
error sin propagar excepciones: sensores y luces siguen.

Una sola sesion a la vez, y nunca junto con el audio local: si el reproductor
esta sonando, la voz se rechaza; mientras hay voz, comandos.audio_play responde
voz_en_curso.
"""
import binascii
import struct
import _thread
import time

INACTIVA = "inactiva"
ACTIVA = "activa"
ERROR = "error"

_MIN_BYTES = 320            # 20 ms a 8 kHz
_MAX_BYTES = 1600           # 100 ms a 8 kHz
_MAX_BASE64 = 2200          # 1600 bytes en base64 son 2136 caracteres
_PERIODO_TICKS = 1 << 30


def _dif_ms(a, b):
    d = (a - b) & (_PERIODO_TICKS - 1)
    if d >= _PERIODO_TICKS // 2:
        d -= _PERIODO_TICKS
    return d


def decodificar(mensaje):
    """Mensaje 'voz' -> (seq, pcm) o None si no cumple el contrato."""
    if not isinstance(mensaje, dict):
        return None
    seq = mensaje.get("seq")
    texto = mensaje.get("pcm")
    if isinstance(seq, bool) or not isinstance(seq, int) or seq < 0:
        return None
    if not isinstance(texto, str) or not texto or len(texto) > _MAX_BASE64:
        return None
    try:
        pcm = binascii.a2b_base64(texto)
    except (ValueError, binascii.Error):
        return None
    if len(pcm) % 2 != 0 or not _MIN_BYTES <= len(pcm) <= _MAX_BYTES:
        return None
    return seq, pcm


def ampliar(pcm, volumen_pct):
    """PCM 8 kHz -> 16 kHz (cada muestra se repite) con el volumen aplicado."""
    cantidad = len(pcm) // 2
    muestras = struct.unpack("<%dh" % cantidad, pcm)
    salida = bytearray(4 * cantidad)
    for i in range(cantidad):
        valor = muestras[i] * volumen_pct // 100
        struct.pack_into("<hh", salida, 4 * i, valor, valor)
    return bytes(salida)


class Voz:
    def __init__(self, fabrica, cfg, reproductor=None, reloj=None):
        """fabrica(ibuf_bytes) -> objeto I2S; cfg: config.py; reproductor: audio local."""
        self._fabrica = fabrica
        self._reproductor = reproductor
        self._reloj = reloj if reloj is not None else time.ticks_ms
        self._maximo = cfg.VOZ_BUFER_FRAGMENTOS
        self._sin_datos_ms = cfg.VOZ_SIN_DATOS_MS
        self._volumen_pct = min(cfg.AUDIO_VOLUMEN_PCT, cfg.AUDIO_VOLUMEN_MAX_PCT)
        self._ibuf = self._maximo * 2 * (_MAX_BYTES * 2)
        if (self._maximo < 1 or self._sin_datos_ms < 100 or self._volumen_pct <= 0
                or cfg.VOZ_TASA_ENTRADA_HZ * 2 != cfg.AUDIO_TASA_HZ):
            raise ValueError("voz_config_invalida")
        self._lock = _thread.allocate_lock()
        self._cola = []
        self._ultimo_seq = -1
        self._ultimo_rx = 0
        self._cerrar = False
        self._estado = INACTIVA
        self._ultimo_error = None
        self._i2s = None
        self._en_vuelo = None
        self._cb = self._al_vaciar

    # -- hilo de red ---------------------------------------------------------

    def recibir(self, mensaje):
        """Valida un fragmento y lo encola. True si se acepto."""
        dato = decodificar(mensaje)
        if dato is None:
            return False
        seq, pcm = dato
        with self._lock:
            if self._cerrar or seq <= self._ultimo_seq:
                return False                 # repetido, atrasado o sesion cerrandose
            if self._estado == ERROR:
                return False
            self._ultimo_seq = seq
            self._ultimo_rx = self._reloj()
            self._cola.append(pcm)
            while len(self._cola) > self._maximo:
                self._cola.pop(0)            # se descarta el mas antiguo
        return True

    def finalizar(self):
        """Pide cerrar la sesion (voz_fin o conexion perdida)."""
        with self._lock:
            self._cerrar = True
            self._cola = []

    # -- ciclo principal -----------------------------------------------------

    def activa(self):
        return self._estado == ACTIVA

    def estado(self):
        return {"estado": self._estado, "error": self._ultimo_error}

    def _al_vaciar(self, origen):
        if origen is self._i2s:
            self._en_vuelo = None

    def _cerrar_i2s(self):
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

    def _terminar(self, estado, error=None):
        self._cerrar_i2s()
        with self._lock:
            self._cola = []
            self._cerrar = False
            self._ultimo_seq = -1
        self._estado = estado
        self._ultimo_error = error

    def actualizar(self, ahora_ms):
        """Abre, escribe y cierra la salida. Nunca lanza."""
        try:
            self._actualizar(ahora_ms)
        except Exception as error:
            self._terminar(ERROR, type(error).__name__)
        return self._estado

    def _actualizar(self, ahora_ms):
        with self._lock:
            cerrar = self._cerrar
            hay_cola = bool(self._cola)
            ultimo_rx = self._ultimo_rx
        if cerrar:
            self._terminar(INACTIVA)
            return
        if self._estado == ERROR:
            # Un error se limpia solo cuando la web cierra la sesion (voz_fin).
            return
        if self._estado == INACTIVA:
            if not hay_cola:
                return
            if self._reproductor is not None and self._reproductor.estado()["estado"] in (
                    "reproduciendo", "drenando"):
                self._terminar(ERROR, "audio_en_curso")
                return
            self._i2s = self._fabrica(self._ibuf)
            self._i2s.irq(self._cb)
            self._en_vuelo = None
            self._estado = ACTIVA
            self._ultimo_error = None
        if _dif_ms(ahora_ms, ultimo_rx) > self._sin_datos_ms:
            self._terminar(INACTIVA)         # la web dejo de enviar
            return
        if self._en_vuelo is None:
            with self._lock:
                pcm = self._cola.pop(0) if self._cola else None
            if pcm is not None:
                bloque = ampliar(pcm, self._volumen_pct)
                self._en_vuelo = bloque
                self._i2s.write(bloque)


def iniciar(cfg=None, reproductor=None):
    """Crea la voz (sin tocar ningun pin hasta que llegue el primer fragmento)."""
    if cfg is None:
        import config as cfg
    import audio
    audio.validar_pines(cfg)
    return Voz(lambda ibuf: audio._crear_i2s(cfg, ibuf), cfg, reproductor)
