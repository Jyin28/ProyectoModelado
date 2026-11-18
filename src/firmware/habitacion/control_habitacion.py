"""control_habitacion.py - Sensor de puerta (reed) y PIR del cuarto.

Todo es no bloqueante: actualizar() se llama en cada vuelta del ciclo principal.
No usa red: los eventos esperan en una lista y el ciclo principal los entrega
con sacar_eventos().

Reglas:
  - Cada sensor tiene su propio monitoreo, apagado al arrancar. Solo una orden
    (room_monitor_set) o un horario del servidor lo enciende (CA-17.1).
  - Un evento por accion: la apertura de la puerta (flanco cerrado -> abierto) o
    el flanco del PIR (sin movimiento -> movimiento). Un sensor que se queda
    abierto o activo no repite (CA-17.2, CA-17.5).
  - No distingue entrada de salida (CA-17.4) y no hace sonar nada (CA-17.3).
  - Activar el monitoreo con la puerta ya abierta no genera evento: solo cuenta
    un cambio que ocurra con el monitoreo activo.
  - Nunca incluye datos de fotos: la foto la pide el servidor al guardar el evento.
SIN PROBAR EN HARDWARE.
"""

SENSORES = ("puerta", "movimiento")
# Sensor -> tipo de evento que se informa (contrato habitacion.md).
TIPOS_EVENTO = {"puerta": "puerta", "movimiento": "movimiento_habitacion"}
MAX_EVENTOS = 8


def _diferencia_ms(a, b):
    """a - b con vuelta de contador (equivale a time.ticks_diff)."""
    periodo = 1 << 30
    d = (a - b) & (periodo - 1)
    if d >= periodo // 2:
        d -= periodo
    return d


class EntradaEstable:
    """Filtra rebotes: el valor cambia solo si se mantiene 'estable_ms'.

    actualizar(valor, ahora_ms) devuelve True una sola vez cuando el estado estable
    pasa de False a True (flanco de subida).
    """

    def __init__(self, estable_ms):
        self._estable_ms = estable_ms
        self.valor = False          # estado estable actual
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
        if _diferencia_ms(ahora_ms, self._desde) >= self._estable_ms:
            self.valor = leido
            self._desde = None
            return leido
        return False


class ControlHabitacion:
    def __init__(self, pin_puerta, pin_pir, cfg):
        """pin_puerta, pin_pir: objetos con value(). cfg: valores de config.py."""
        self._pines = {"puerta": pin_puerta, "movimiento": pin_pir}
        self._puerta_abierta_alto = bool(cfg.PUERTA_ABIERTA_ES_ALTO)
        self._entradas = {s: EntradaEstable(cfg.HABITACION_ANTIRREBOTE_MS) for s in SENSORES}
        self._monitoreo = {s: False for s in SENSORES}
        self._eventos = []

    # ---------------- consultas ----------------

    def monitoreo(self, sensor):
        return self._monitoreo[self._sensor(sensor)]

    def estado(self):
        """Resumen para get_status. No lleva datos de fotos."""
        return {"puerta_abierta": self._entradas["puerta"].valor,
                "movimiento": self._entradas["movimiento"].valor,
                "monitoreo_puerta": self._monitoreo["puerta"],
                "monitoreo_movimiento": self._monitoreo["movimiento"]}

    def sacar_eventos(self):
        """Entrega y vacia los eventos pendientes: [{"tipo", "datos", "ms"}].

        "ms" es time.ticks_ms() de cuando ocurrio. 'datos' siempre esta vacio.
        """
        eventos = self._eventos
        self._eventos = []
        return eventos

    # ---------------- comandos ----------------

    @staticmethod
    def _sensor(sensor):
        if sensor not in SENSORES:
            raise ValueError("parametro_invalido:sensor")
        return sensor

    def fijar_monitoreo(self, sensor, activo):
        """Enciende o apaga el monitoreo de un sensor. Devuelve el estado nuevo."""
        sensor = self._sensor(sensor)
        if not isinstance(activo, bool):
            raise ValueError("parametro_invalido:enabled")
        self._monitoreo[sensor] = activo
        return {"sensor": sensor, "enabled": activo}

    # ---------------- ciclo ----------------

    def _lectura(self, sensor):
        valor = self._pines[sensor].value()
        if sensor == "puerta":
            return (valor == 1) == self._puerta_abierta_alto
        return valor == 1

    def actualizar(self, ahora_ms):
        """Lee los dos sensores. Anota un evento por flanco con el monitoreo activo."""
        for sensor in SENSORES:
            hubo_flanco = self._entradas[sensor].actualizar(self._lectura(sensor), ahora_ms)
            if hubo_flanco and self._monitoreo[sensor]:
                self._anotar(TIPOS_EVENTO[sensor], ahora_ms)

    def _anotar(self, tipo, ahora_ms):
        if len(self._eventos) >= MAX_EVENTOS:
            self._eventos.pop(0)
        self._eventos.append({"tipo": tipo, "datos": {}, "ms": ahora_ms})

    def apagar(self):
        """Apaga el monitoreo y descarta lo pendiente (fin del programa)."""
        for sensor in SENSORES:
            self._monitoreo[sensor] = False
        self._eventos = []


def iniciar(cfg=None):
    """Crea el control con los pines de config.py. Solo se llama si
    HABITACION_HABILITADO es True y el modulo conectado es la habitacion."""
    import config
    import setup_habitacion
    cfg = cfg or config
    pin_puerta, pin_pir = setup_habitacion.crear_hardware(cfg)
    return ControlHabitacion(pin_puerta, pin_pir, cfg)
