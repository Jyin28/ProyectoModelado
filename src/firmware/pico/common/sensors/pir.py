"""pir.py - Estabilizacion del PIR HC-SR501 (logica pura, sin hardware).

Igual que el codigo funcional: tras encender, el sensor necesita un tiempo para
estabilizarse (60 s) y despues hay que verlo en reposo (salida en 0) durante un
rato seguido (2 s) antes de confiar en sus lecturas. Mientras tanto no informa
movimiento.

    pir = EstabilizadorPIR(leer, reloj_ms, diferencia_ms)
    pir.actualizar()   -> True si hay movimiento (False mientras se estabiliza)
    pir.listo          -> True cuando ya termino de estabilizarse
"""

ESTABILIZANDO = "estabilizando"
ESPERANDO_REPOSO = "esperando_reposo"
LISTO = "listo"


class EstabilizadorPIR:
    def __init__(self, leer, reloj_ms, diferencia_ms,
                 estabilizacion_s=60, reposo_s=2, avisar=print):
        self._leer = leer
        self._reloj = reloj_ms
        self._dif = diferencia_ms
        self._estabilizacion_ms = estabilizacion_s * 1000
        self._reposo_ms = reposo_s * 1000
        self._avisar = avisar
        self._inicio = reloj_ms()
        self._desde_reposo = None
        self.estado = ESTABILIZANDO
        self._avisar("PIR: esperando %d segundos para estabilizarse..." % estabilizacion_s)

    @property
    def listo(self):
        return self.estado == LISTO

    def actualizar(self):
        ahora = self._reloj()
        valor = 1 if self._leer() else 0
        if self.estado == ESTABILIZANDO:
            if self._dif(ahora, self._inicio) >= self._estabilizacion_ms:
                self.estado = ESPERANDO_REPOSO
                self._desde_reposo = None
                self._avisar("PIR: lectura inicial = %d" % valor)
                self._avisar("PIR: esperando 2 segundos seguidos en reposo...")
            return False
        if self.estado == ESPERANDO_REPOSO:
            if valor:
                self._desde_reposo = None
            elif self._desde_reposo is None:
                self._desde_reposo = ahora
            elif self._dif(ahora, self._desde_reposo) >= self._reposo_ms:
                self.estado = LISTO
                self._avisar("PIR listo. Ahora pasa la mano frente al sensor.")
            return False
        return valor == 1
