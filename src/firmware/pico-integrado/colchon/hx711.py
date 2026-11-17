"""hx711.py - Lectura NO bloqueante del HX711 (canal A, ganancia 128).

listo()  consulta la senal de "dato listo" (DOUT en 0) y vuelve enseguida.
leer()   si no esta listo devuelve None sin esperar. Si lo esta, hace la
         rafaga de 25 pulsos con las interrupciones deshabilitadas (unas
         decenas de microsegundos: un SCK en alto mas de ~60 us apagaria el
         HX711) y las restaura siempre.

Devuelve un entero con signo de 24 bits, o None si la lectura no sirve
(no listo o saturado: 0x7FFFFF / 0x800000).
"""
try:
    from machine import disable_irq, enable_irq
except ImportError:             # CPython (pruebas de escritorio)
    def disable_irq():
        return 0

    def enable_irq(estado):
        pass

_SATURADO_MAX = 0x7FFFFF
_SATURADO_MIN = -0x800000


class Hx711:
    def __init__(self, dt, sck, pulsos_extra=1):
        """dt/sck: objetos con .value(). pulsos_extra=1 -> canal A, ganancia 128."""
        if pulsos_extra not in (1, 2, 3):
            raise ValueError("pulsos_extra_invalido")
        self._dt = dt
        self._sck = sck
        self._extra = pulsos_extra
        self._sck.value(0)

    def listo(self):
        return self._dt.value() == 0

    def leer(self):
        if not self.listo():
            return None
        dt = self._dt
        sck = self._sck
        valor = 0
        estado = disable_irq()
        try:
            for _ in range(24):
                sck.value(1)
                valor = (valor << 1) | (dt.value() & 1)
                sck.value(0)
            for _ in range(self._extra):
                sck.value(1)
                sck.value(0)
        finally:
            enable_irq(estado)
        if valor & 0x800000:
            valor -= 0x1000000
        if valor == _SATURADO_MAX or valor == _SATURADO_MIN:
            return None
        return valor
