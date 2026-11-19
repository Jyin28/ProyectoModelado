"""rampa.py - Transiciones suaves de brillo (logica pura, sin hardware).

Cada LED tiene un nivel actual y un objetivo (0 a MAXIMO). paso() acerca el
nivel al objetivo segun el tiempo transcurrido, de modo que pasar de apagado a
encendido tarde rampa_ms y nunca haya un salto brusco.
"""

MAXIMO = 65535
_PERIODO_TICKS = 1 << 30


def _dif_ms(a, b):
    d = (a - b) & (_PERIODO_TICKS - 1)
    if d >= _PERIODO_TICKS // 2:
        d -= _PERIODO_TICKS
    return d


class Rampa:
    def __init__(self, cantidad, rampa_ms, maximo=MAXIMO):
        if cantidad < 1 or rampa_ms < 1 or maximo < 1:
            raise ValueError("rampa_invalida")
        self._rampa_ms = rampa_ms
        self._maximo = maximo
        self._nivel = [0] * cantidad
        self._objetivo = [0] * cantidad
        self._ultimo = None

    def objetivo(self, indice, encendido):
        if indice < 0 or indice >= len(self._nivel):
            raise ValueError("indice_invalido")
        self._objetivo[indice] = self._maximo if encendido else 0

    def todos(self, encendido):
        for i in range(len(self._nivel)):
            self.objetivo(i, encendido)

    def apagar(self):
        """Todo a cero de inmediato (niveles y objetivos), sin rampa."""
        for i in range(len(self._nivel)):
            self._nivel[i] = 0
            self._objetivo[i] = 0

    def niveles(self):
        return tuple(self._nivel)

    def objetivos(self):
        return tuple(self._objetivo)

    def paso(self, ahora_ms):
        """Avanza los niveles. Devuelve la lista de (indice, nivel) que cambiaron."""
        if self._ultimo is None:
            self._ultimo = ahora_ms
            return []
        transcurrido = _dif_ms(ahora_ms, self._ultimo)
        self._ultimo = ahora_ms
        if transcurrido <= 0:
            return []
        # Se redondea hacia arriba para llegar al objetivo en rampa_ms sin quedar a medio paso.
        avance = max(1, (self._maximo * transcurrido + self._rampa_ms - 1) // self._rampa_ms)
        cambios = []
        for i in range(len(self._nivel)):
            actual = self._nivel[i]
            meta = self._objetivo[i]
            if actual == meta:
                continue
            if actual < meta:
                nuevo = min(meta, actual + avance)
            else:
                nuevo = max(meta, actual - avance)
            self._nivel[i] = nuevo
            cambios.append((i, nuevo))
        return cambios
