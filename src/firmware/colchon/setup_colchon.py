"""setup_colchon.py - Crea el hardware del colchon a partir de config.py.

Los pines salen SOLO de config.py (propuesta pendiente de confirmacion y
cableado). No toca ningun pin al importarse: el hardware se crea cuando se
llama a crear_hardware(), y esa funcion se llama solo si COLCHON_HABILITADO
es True o desde el menu de prueba. El buzzer arranca apagado.
"""


def validar_pines(pines, reservados):
    """Rechaza pines repetidos o reservados por el chip WiFi (GP23/24/25/29)."""
    vistos = []
    for pin in pines:
        if pin in reservados:
            raise ValueError("pin_reservado_wifi:%d" % pin)
        if pin in vistos:
            raise ValueError("pin_repetido:%d" % pin)
        vistos.append(pin)


class BuzzerPasivo:
    """Entrega un tono al transistor y mantiene el GPIO en bajo al silenciar."""

    def __init__(self, pin, modo_salida, crear_pwm, frecuencia_hz):
        self._pin = pin
        self._modo_salida = modo_salida
        self._crear_pwm = crear_pwm
        self._frecuencia_hz = frecuencia_hz
        self._pwm = None
        self._pin.init(self._modo_salida, value=0)

    def value(self, encendido):
        if encendido:
            if self._pwm is None:
                try:
                    self._pwm = self._crear_pwm(
                        self._pin, freq=self._frecuencia_hz, duty_u16=32768,
                    )
                except Exception:
                    self._pin.init(self._modo_salida, value=0)
                    raise
        elif self._pwm is not None:
            try:
                self._pwm.deinit()
            finally:
                self._pwm = None
                self._pin.init(self._modo_salida, value=0)


def crear_hardware(cfg):
    """Devuelve (sensor_hx711, buzzer_pasivo, pin_boton)."""
    validar_pines((cfg.PIN_HX711_DT, cfg.PIN_HX711_SCK, cfg.PIN_BUZZER, cfg.PIN_BOTON),
                  cfg.PINES_RESERVADOS_WIFI)

    from machine import Pin, PWM
    import hx711

    dt = Pin(cfg.PIN_HX711_DT, Pin.IN, Pin.PULL_UP)   # sin sensor: nunca "listo"
    sck = Pin(cfg.PIN_HX711_SCK, Pin.OUT, value=0)
    buzzer = BuzzerPasivo(Pin(cfg.PIN_BUZZER), Pin.OUT, PWM, cfg.BUZZER_FRECUENCIA_HZ)
    boton = Pin(cfg.PIN_BOTON, Pin.IN, Pin.PULL_UP)
    return hx711.Hx711(dt, sck), buzzer, boton
