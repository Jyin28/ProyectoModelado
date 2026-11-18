"""setup_alimentacion.py - Crea el hardware de la alimentacion a partir de config.py.

Los pines salen SOLO de config.py (propuesta pendiente de cableado). No toca
ningun pin al importarse: crear_hardware() se llama solo si ALIMENTACION_HABILITADO
es True. Sin actuadores: solo se leen la celda de carga y la sonda.
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


class SondaDS18B20:
    """Una sonda DS18B20 con conversion en dos pasos para no bloquear el ciclo."""

    def __init__(self, ds, rom):
        self._ds = ds
        self._rom = rom

    def convertir(self):
        """Inicia la conversion (tarda unos 750 ms; se lee despues)."""
        self._ds.convert_temp()

    def leer(self):
        """Temperatura en grados Celsius de la ultima conversion."""
        return self._ds.read_temp(self._rom)


def crear_hardware(cfg):
    """Devuelve (sensor_hx711, termometro_o_None). Sin sonda conectada no hay termometro."""
    validar_pines((cfg.PIN_ALIMENTACION_DT, cfg.PIN_ALIMENTACION_SCK, cfg.PIN_DS18B20),
                  cfg.PINES_RESERVADOS_WIFI)

    from machine import Pin
    import hx711

    dt = Pin(cfg.PIN_ALIMENTACION_DT, Pin.IN, Pin.PULL_UP)   # sin sensor: nunca "listo"
    sck = Pin(cfg.PIN_ALIMENTACION_SCK, Pin.OUT, value=0)
    sensor = hx711.Hx711(dt, sck)

    termometro = None
    try:
        import ds18x20
        import onewire
        ds = ds18x20.DS18X20(onewire.OneWire(Pin(cfg.PIN_DS18B20)))
        roms = ds.scan()
        if roms:
            termometro = SondaDS18B20(ds, roms[0])
        else:
            print("Alimentacion: no se encontro la sonda DS18B20; sin temperatura")
    except Exception as error:
        print("Alimentacion: sonda no disponible (%s)" % type(error).__name__)
    return sensor, termometro
