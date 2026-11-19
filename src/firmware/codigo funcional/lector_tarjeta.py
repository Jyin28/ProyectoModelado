"""Lectura de UID: una emisión por acercamiento físico, sin datos bancarios."""
from time import ticks_ms, ticks_diff


class LectorTarjeta:
    def __init__(self, controlador):
        self.controlador = controlador
        self.ultimo_uid = None
        self.ausente_desde = None

    def leer(self):
        uid = self.controlador.read_uid()
        ahora = ticks_ms()
        if uid is None:
            if self.ausente_desde is None:
                self.ausente_desde = ahora
            elif ticks_diff(ahora, self.ausente_desde) >= 300:
                self.ultimo_uid = None
            return None
        self.ausente_desde = None
        texto = "".join("{:02X}".format(value) for value in uid)
        if texto == self.ultimo_uid:
            return None
        self.ultimo_uid = texto
        return texto
