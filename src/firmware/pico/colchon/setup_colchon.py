
# ==========================================
# SETUP - SISTEMA DEL COLCHON
# Raspberry Pi Pico 2 W
# ==========================================

from machine import Pin, PWM
import time

# ==========================================
# 1. ASIGNACION DE PINES
# ==========================================

# HX711
HX711_DT = 13  # GP13, pin fisico 17
HX711_SCK = 12  # GP12, pin fisico 16

# Boton fisico
BUTTON_PIN = 19  # GP19, pin fisico 25
# True: el boton une el pin con GND (pull-up, se lee 0 al pulsar). False: lo une con 3V3
# (pull-down, se lee 1 al pulsar). Si el boton no responde, ejecuta buscar_boton.py: dice el pin.
BUTTON_ACTIVE_LOW = True

# Transistor NPN y buzzer pasivo
BUZZER_PIN = 18  # GP18, pin fisico 24


# ==========================================
# 2. CONFIGURACION
# ==========================================

# Factor de calibracion provisional
CALIBRATION_FACTOR = 420.0

# Tolerancia de perdida de peso (%)
TOLERANCE = 10.0

# Tiempo de monitoreo (segundos)
MONITORING_TIME = 300

# Duracion de alarma (segundos)
ALARM_TIME = 5

# Frecuencia del buzzer pasivo (Hz), tomada de prueba_buzzer.py
BUZZER_FREQ_HZ = 2637

# Lecturas consecutivas para activar alarma
REQUIRED_READINGS = 3

# Intervalo entre mediciones (milisegundos)
READING_INTERVAL = 1000

# Dos flancos del boton mas juntos que esto cuentan como uno (rebote del contacto)
BUTTON_DEBOUNCE_MS = 50


# ==========================================
# 3. INICIALIZACION DE COMPONENTES
# ==========================================

# HX711
hx711_dt = Pin(HX711_DT, Pin.IN, Pin.PULL_UP)
hx711_sck = Pin(HX711_SCK, Pin.OUT)
hx711_sck.value(0)

# Boton con resistencia interna: pull-up si va a GND, pull-down si va a 3V3
button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP if BUTTON_ACTIVE_LOW else Pin.PULL_DOWN)

# Salida hacia la base del transistor. Mientras suena es PWM; en silencio el PWM se elimina
# (deinit) y el pin queda como GPIO normal en BAJO, como hacia el firmware anterior
# (BuzzerPasivo): asi el silencio no depende de dejar el PWM con duty 0.
buzzer_pin = Pin(BUZZER_PIN, Pin.OUT, value=0)
buzzer = None          # objeto PWM, solo mientras suena

# La pulsacion se guarda por interrupcion (flanco al pulsar). El ciclo principal hace
# llamadas de red que bloquean varios segundos: si el boton solo se leyera por sondeo,
# una pulsacion corta durante ese bloqueo se perderia. La interrupcion ademas silencia
# el buzzer al instante, sin esperar a que el ciclo vuelva a correr.
_pulsado = [False]
_ultimo_flanco = [0]


def _al_pulsar(pin):
    ahora = time.ticks_ms()
    if time.ticks_diff(ahora, _ultimo_flanco[0]) > BUTTON_DEBOUNCE_MS:
        _pulsado[0] = True
        buzzer_off()
    _ultimo_flanco[0] = ahora


button.irq(trigger=Pin.IRQ_FALLING if BUTTON_ACTIVE_LOW else Pin.IRQ_RISING, handler=_al_pulsar)

print("Boton: GP%d (%s), nivel=%d, interrupcion activa"
      % (BUTTON_PIN, "a GND" if BUTTON_ACTIVE_LOW else "a 3V3", button.value()))


# ==========================================
# 4. FUNCIONES DEL HX711
# ==========================================

def read_hx711():

    start = time.ticks_ms()

    # Esperar a que termine la conversion
    while hx711_dt.value() == 1:

        if time.ticks_diff(time.ticks_ms(), start) > 1000:
            raise OSError("HX711 no responde")

        time.sleep_us(10)

    value = 0

    # Leer los 24 bits
    for i in range(24):

        hx711_sck.value(1)
        time.sleep_us(1)

        value = (value << 1) | hx711_dt.value()

        hx711_sck.value(0)
        time.sleep_us(1)

    # Pulso adicional:
    # Canal A, ganancia 128
    hx711_sck.value(1)
    time.sleep_us(1)
    hx711_sck.value(0)
    time.sleep_us(1)

    # Convertir complemento a dos
    if value & 0x800000:
        value -= 0x1000000

    return value


# ==========================================
# 5. FUNCIONES DE MEDICION
# ==========================================

def read_average(samples=10):

    total = 0

    for i in range(samples):
        total += read_hx711()

    return total / samples


def tare(samples=20):

    return read_average(samples)


def get_weight(raw_value, reference):

    return (raw_value - reference) / CALIBRATION_FACTOR


# ==========================================
# 6. CONTROL DEL BUZZER
# ==========================================

def buzzer_on():
    global buzzer
    if buzzer is None:
        buzzer = PWM(buzzer_pin, freq=BUZZER_FREQ_HZ, duty_u16=32768)  # ciclo de trabajo del 50 %
    else:
        buzzer.duty_u16(32768)


def buzzer_off():
    """Silencia el buzzer: elimina el PWM y deja el GPIO en bajo. Se puede llamar las veces que sea."""
    global buzzer
    pwm = buzzer
    buzzer = None
    if pwm is not None:
        try:
            pwm.deinit()
        except Exception:
            pass
        print("Buzzer: apagado (GP%d en bajo)" % BUZZER_PIN)
    buzzer_pin.init(Pin.OUT, value=0)
    buzzer_pin.value(0)


# ==========================================
# 7. CONTROL DEL BOTON
# ==========================================

def _pulsado_ahora():
    """True si el boton esta pulsado en este instante (segun a donde este cableado)."""
    return button.value() == (0 if BUTTON_ACTIVE_LOW else 1)


def button_pressed():
    """True si el boton se pulso desde la ultima vez (guardado por interrupcion) o esta pulsado ahora."""
    if _pulsado[0]:
        _pulsado[0] = False
        print("Boton: pulsado")
        return True

    if _pulsado_ahora():

        time.sleep_ms(30)

        if _pulsado_ahora():
            print("Boton: pulsado")
            return True

    return False


def button_clear():
    """Descarta una pulsacion guardada (p. ej. la de un momento en que no habia nada que detener)."""
    _pulsado[0] = False
