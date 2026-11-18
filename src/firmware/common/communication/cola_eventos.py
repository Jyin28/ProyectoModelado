"""cola_eventos.py - Cola acotada de eventos del colchon que esperan salir a Ingesta.

Logica pura (sin red ni hardware). La usa ambiente.EnvioAmbiente:
  - el ciclo principal agrega un evento cuando ocurre (agregar);
  - el hilo de red los toma en orden (pendientes), envia, y marca cada uno como
    terminado o por reintentar.

Reglas:
  - Cada evento conserva su event_id y la hora de cuando ocurrio (en
    milisegundos de time.ticks_ms()). Un reintento reenvia el mismo event_id,
    asi el servidor no lo duplica (idempotencia).
  - La cola tiene tope: si se llena, se descarta el evento mas antiguo.
  - Un evento mas viejo que VIDA_MS se descarta (ya no tiene sentido avisarlo).
  - Se envia en orden: mientras un evento espera reintento, los siguientes esperan.
  - No guarda lecturas de peso ni nada fuera de los datos del evento.
"""

PERIODO_TICKS = 1 << 30
MAXIMO = 8
VIDA_MS = 5 * 60 * 1000
ESPERA_REINTENTO_MS = 2000


def _diferencia_ms(a, b):
    """a - b con vuelta de contador (equivale a time.ticks_diff)."""
    d = (a - b) & (PERIODO_TICKS - 1)
    if d >= PERIODO_TICKS // 2:
        d -= PERIODO_TICKS
    return d


class ColaEventos:
    def __init__(self, nuevo_id, maximo=MAXIMO, vida_ms=VIDA_MS):
        self._nuevo_id = nuevo_id
        self._maximo = maximo
        self._vida_ms = vida_ms
        self._eventos = []

    def __len__(self):
        return len(self._eventos)

    def agregar(self, tipo, datos, ocurrido_ms):
        """Agrega un evento. Con la cola llena descarta el mas antiguo."""
        if len(self._eventos) >= self._maximo:
            self._eventos.pop(0)
        self._eventos.append({"event_id": self._nuevo_id(), "tipo": tipo, "datos": datos,
                              "ocurrido_ms": ocurrido_ms, "no_antes": None})

    def pendientes(self, ahora_ms):
        """Eventos listos para enviar, del mas antiguo al mas nuevo.

        Descarta los vencidos. Si el primero espera un reintento, devuelve lista
        vacia para no enviar fuera de orden. Cada elemento es (evento, edad_s).
        """
        vigentes = []
        for evento in self._eventos:
            if _diferencia_ms(ahora_ms, evento["ocurrido_ms"]) <= self._vida_ms:
                vigentes.append(evento)
        self._eventos = vigentes
        if not vigentes:
            return []
        espera = vigentes[0]["no_antes"]
        if espera is not None and _diferencia_ms(ahora_ms, espera) < 0:
            return []
        return [(e, max(0, _diferencia_ms(ahora_ms, e["ocurrido_ms"])) // 1000) for e in vigentes]

    def terminado(self, evento):
        """El evento salio (o el servidor lo rechazo sin reintento): se quita."""
        if evento in self._eventos:
            self._eventos.remove(evento)

    def reintentar(self, evento, ahora_ms):
        """El envio fallo por algo transitorio: se reintenta mas tarde."""
        evento["no_antes"] = (ahora_ms + ESPERA_REINTENTO_MS) & (PERIODO_TICKS - 1)

    def vaciar(self):
        self._eventos = []
