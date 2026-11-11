
# ==========================================
# SETUP - SISTEMA DEL COLCHON
# Raspberry Pi Pico 2 W
# ==========================================

from machine import Pin
import time

# ==========================================
# 1. ASIGNACION DE PINES
# ==========================================

# HX711
HX711_DT = 17
HX711_SCK = 16

# Boton fisico
BUTTON_PIN = 25

# Transistor NPN y buzzer
BUZZER_PIN = 24


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

# Lecturas consecutivas para activar alarma
REQUIRED_READINGS = 3

# Intervalo entre mediciones (milisegundos)
READING_INTERVAL = 1000


# ==========================================
# 3. INICIALIZACION DE COMPONENTES
# ==========================================

# HX711
hx711_dt = Pin(HX711_DT, Pin.IN, Pin.PULL_UP)
hx711_sck = Pin(HX711_SCK, Pin.OUT)
hx711_sck.value(0)

# Boton con resistencia pull-up interna
button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)

# Salida hacia la base del transistor
buzzer = Pin(BUZZER_PIN, Pin.OUT)
buzzer.value(0)


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
    buzzer.value(1)


def buzzer_off():
    buzzer.value(0)


# ==========================================
# 7. CONTROL DEL BOTON
# ==========================================

def button_pressed():

    if button.value() == 0:

        time.sleep_ms(30)

        if button.value() == 0:
            return True

    return False
