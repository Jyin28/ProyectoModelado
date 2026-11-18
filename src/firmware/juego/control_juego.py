"""control_juego.py - Une las reglas del juego con los botones, los LED y el buzzer.

Todo es no bloqueante: actualizar() se llama en cada vuelta del ciclo principal.
No usa red. SIN PROBAR EN HARDWARE.

  - Una pulsacion por accion fisica: se cuenta el flanco de un boton estable, no
    el tiempo que se mantiene pulsado (CA-19.2, CA-19.3).
  - Solo el LED del objetivo esta encendido.
  - Solo un acierto suena (tono corto); un error no suena.
  - Apagar o volver a encender sin otro boton: mantener pulsados a la vez los dos
    botones de JUEGO_COMBO_ONOFF durante JUEGO_COMBO_MS. Mientras ese par esta
    sostenido, no cuenta como pulsaciones del juego.
"""
import logica_juego
from entrada import EntradaEstable, diferencia_ms


class ControlJuego:
    def __init__(self, botones, leds, buzzer, cfg, aleatorio):
        """botones: pines con value(); leds: pines con value(v); buzzer: value(v)."""
        if len(botones) != logica_juego.NUM_BOTONES or len(leds) != logica_juego.NUM_BOTONES:
            raise ValueError("se_necesitan_cinco_botones_y_cinco_leds")
        self._botones = botones
        self._leds = leds
        self._buzzer = buzzer
        self._activo_bajo = bool(cfg.JUEGO_BOTON_ACTIVO_BAJO)
        self._entradas = [EntradaEstable(cfg.JUEGO_ANTIRREBOTE_MS) for _ in botones]
        self._recompensa_ms = cfg.JUEGO_RECOMPENSA_MS
        self._combo = tuple(cfg.JUEGO_COMBO_ONOFF)
        self._combo_ms = cfg.JUEGO_COMBO_MS
        self._combo_desde = None
        self._combo_usado = False       # el combo ya cambio el estado: espera a soltarse
        self._suena_hasta = None
        self._inicio_encendido = bool(cfg.JUEGO_INICIA_ENCENDIDO)
        self.juego = logica_juego.Juego(aleatorio, len(botones))
        self.pulsaciones = 0            # pulsaciones fisicas contadas (para pruebas)
        self._apagar_salidas()
        if self._inicio_encendido:
            self.juego.encender()
            self._mostrar_objetivo()

    # ---------------- consultas ----------------

    def estado(self):
        return {"encendido": self.juego.encendido, "objetivo": self.juego.objetivo,
                "aciertos": self.juego.aciertos, "errores": self.juego.errores,
                "suena": self._suena_hasta is not None}

    # ---------------- salidas ----------------

    def _mostrar_objetivo(self):
        for i, led in enumerate(self._leds):
            led.value(1 if i == self.juego.objetivo else 0)

    def _apagar_salidas(self):
        for led in self._leds:
            led.value(0)
        self._buzzer.value(0)
        self._suena_hasta = None

    def _sonar(self, ahora_ms):
        self._buzzer.value(1)
        self._suena_hasta = (ahora_ms + self._recompensa_ms) & ((1 << 30) - 1)

    # ---------------- ciclo ----------------

    def _pulsado(self, indice):
        valor = self._botones[indice].value()
        return (valor == 0) if self._activo_bajo else (valor == 1)

    def actualizar(self, ahora_ms):
        # 1. Fin de la recompensa.
        if self._suena_hasta is not None and diferencia_ms(ahora_ms, self._suena_hasta) >= 0:
            self._buzzer.value(0)
            self._suena_hasta = None

        # 2. Leer los botones (con antirrebote) y detectar flancos de pulsacion.
        flancos = []
        for i, entrada in enumerate(self._entradas):
            if entrada.actualizar(self._pulsado(i), ahora_ms):
                flancos.append(i)

        # 3. Combo de encendido y apagado.
        a, b = self._combo
        ambos = self._entradas[a].valor and self._entradas[b].valor
        if ambos:
            if self._combo_desde is None:
                self._combo_desde = ahora_ms
            elif not self._combo_usado and diferencia_ms(ahora_ms, self._combo_desde) >= self._combo_ms:
                self._combo_usado = True
                self._alternar()
        else:
            self._combo_desde = None
            self._combo_usado = False

        # 4. Pulsaciones del juego. Un boton del combo pulsado mientras el otro ya
        #    esta sostenido es parte del combo, no una jugada.
        for i in flancos:
            if i in self._combo and ambos:
                continue
            self.pulsaciones += 1
            resultado = self.juego.pulsar(i)
            if resultado is None:
                continue
            if resultado:
                self._sonar(ahora_ms)
            self._mostrar_objetivo()

    def _alternar(self):
        if self.juego.encendido:
            self.juego.apagar()
            self._apagar_salidas()
        else:
            self.juego.encender()
            self._mostrar_objetivo()

    def apagar(self):
        """Fin del programa: deja LED y buzzer en bajo."""
        self.juego.apagar()
        self._apagar_salidas()


def _aleatorio_de_la_pico():
    """Generador con semilla de os.urandom (solo en la Pico)."""
    import os
    import random
    random.seed(int.from_bytes(os.urandom(4), "little"))
    return lambda n: random.randrange(n)


def iniciar(cfg=None):
    """Crea el control con los pines de config.py. Solo se llama si JUEGO_HABILITADO
    es True y el modulo conectado es el juego."""
    import config
    import setup_juego
    cfg = cfg or config
    botones, leds, buzzer = setup_juego.crear_hardware(cfg)
    return ControlJuego(botones, leds, buzzer, cfg, _aleatorio_de_la_pico())
