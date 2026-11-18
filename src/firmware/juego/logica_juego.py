"""logica_juego.py - Reglas del juego de cinco botones (logica pura, sin hardware).

  - Al encender se ilumina un objetivo al azar entre los botones (CA-19.1).
  - Pulsar el objetivo es un acierto (premio); pulsar otro es un error y no
    premia (CA-19.2).
  - Despues de CADA pulsacion, acierto o error, se ilumina otro objetivo al azar,
    distinto del anterior (CA-19.3).
  - El juego sigue hasta apagarlo (CA-19.4). Apagado, no hay objetivo y las
    pulsaciones no hacen nada.

El azar se inyecta: aleatorio(n) devuelve un entero de 0 a n - 1. En la Pico es
un generador con semilla de os.urandom; en las pruebas, uno fijo.
"""

NUM_BOTONES = 5


class Juego:
    def __init__(self, aleatorio, botones=NUM_BOTONES):
        if botones < 2:
            raise ValueError("botones_insuficientes")
        self._aleatorio = aleatorio
        self._botones = botones
        self.encendido = False
        self.objetivo = None
        self.aciertos = 0
        self.errores = 0

    def _elegir_otro(self):
        """Objetivo al azar distinto del actual (o cualquiera si no hay actual)."""
        if self.objetivo is None:
            return self._aleatorio(self._botones)
        r = self._aleatorio(self._botones - 1)
        return r if r < self.objetivo else r + 1

    def encender(self):
        """Empieza (o reanuda) el juego con un objetivo nuevo. Devuelve el objetivo."""
        self.encendido = True
        self.objetivo = None
        self.objetivo = self._elegir_otro()
        return self.objetivo

    def apagar(self):
        self.encendido = False
        self.objetivo = None

    def pulsar(self, indice):
        """Registra una pulsacion. Devuelve True (acierto), False (error) o None
        si el juego esta apagado o el boton no existe."""
        if not self.encendido or not 0 <= indice < self._botones:
            return None
        acierto = indice == self.objetivo
        if acierto:
            self.aciertos += 1
        else:
            self.errores += 1
        self.objetivo = self._elegir_otro()
        return acierto
