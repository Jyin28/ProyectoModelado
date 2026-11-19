"""entrada.py - Entrada digital con antirrebote (logica pura, sin hardware).

La usan la habitacion (reed y PIR) y el juego (botones). time.ticks_diff se
imita aqui para poder probarla en CPython.
"""

PERIODO_TICKS = 1 << 30


def diferencia_ms(a, b):
    """a - b con vuelta de contador (equivale a time.ticks_diff)."""
    d = (a - b) & (PERIODO_TICKS - 1)
    if d >= PERIODO_TICKS // 2:
        d -= PERIODO_TICKS
    return d


class EntradaEstable:
    """Filtra rebotes: el valor cambia solo si se mantiene 'estable_ms'.

    actualizar(leido, ahora_ms) devuelve True una sola vez cuando el estado
    estable pasa de False a True (flanco de subida). 'valor' es el estado estable
    actual y 'desde_ms' el instante en que paso a True (None si esta en False).
    """

    def __init__(self, estable_ms):
        self._estable_ms = estable_ms
        self.valor = False
        self.desde_ms = None
        self._candidato = False
        self._desde = None

    def actualizar(self, leido, ahora_ms):
        leido = bool(leido)
        if leido == self.valor:
            self._candidato = leido
            self._desde = None
            return False
        if leido != self._candidato or self._desde is None:
            self._candidato = leido
            self._desde = ahora_ms
            return False
        if diferencia_ms(ahora_ms, self._desde) >= self._estable_ms:
            self.valor = leido
            self.desde_ms = ahora_ms if leido else None
            self._desde = None
            return leido
        return False
