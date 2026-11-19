"""Botón con antirrebote y dos displays de cátodo común, uno por dado."""
from machine import Pin
from time import ticks_ms, ticks_diff
import random

DIGITOS = ("abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg")


class DadosElectronicos:
    def __init__(self):
        self.display1 = [Pin(gpio, Pin.OUT, value=0) for gpio in (13, 12, 18, 17, 16, 14, 15)]
        self.display2 = [Pin(gpio, Pin.OUT, value=0) for gpio in (9, 8, 22, 21, 20, 10, 11)]
        self.boton = Pin(0, Pin.IN, Pin.PULL_UP)
        self.lectura_anterior = self.boton.value()
        self.estado_estable = self.lectura_anterior
        self.ultimo_cambio = ticks_ms()
        self.mostrar(0, 0)

    @staticmethod
    def _mostrar(display, numero):
        for segmento, pin in zip("abcdefg", display):
            pin.value(1 if segmento in DIGITOS[numero] else 0)

    def mostrar(self, dado1, dado2):
        self._mostrar(self.display1, dado1)
        self._mostrar(self.display2, dado2)

    def leer_tirada(self):
        actual = self.boton.value()
        ahora = ticks_ms()
        if actual != self.lectura_anterior:
            self.ultimo_cambio = ahora
            self.lectura_anterior = actual
        if actual == self.estado_estable or ticks_diff(ahora, self.ultimo_cambio) < 40:
            return None
        self.estado_estable = actual
        if actual != 0:
            return None
        dado1, dado2 = random.randint(1, 6), random.randint(1, 6)
        self.mostrar(dado1, dado2)
        return dado1, dado2
