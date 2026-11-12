"""config.py - Valores que puedes cambiar sin tocar el resto del codigo.

Los pines son PROVISIONALES: confirmalos con el equipo de circuitos.
No uses GP23, GP24, GP25 ni GP29 (los usa el chip WiFi de la Pico W).
"""

# Identificador de la placa fisica. El modulo ambiental usa AMBIENTE_DEVICE_ID.
DEVICE_ID = "pico-sprint3-01"

# ---- Pines (numero de GPIO) ----
PIN_AM2301 = 2      # sensor de temperatura y humedad
PIN_PIR = 3         # sensor de movimiento
PIN_LAMPARA = 13    # compuerta del MOSFET (LED blanco)
PINES_LEDS = (18, 19, 20, 21, 22, 26)   # los seis LED de las figuras

# ---- Movimiento (PIR) ----
# Deshabilitado por defecto. Para la maqueta: ponlo en True en este archivo y
# completa MOVIMIENTO_DEVICE_ID y MOVIMIENTO_TOKEN en secrets.py. No hay
# activacion remota ni horario en este incremento.
MONITOREO_MOVIMIENTO_HABILITADO = False

# ---- Lampara y figuras ----
LAMPARA_FRECUENCIA_HZ = 1000
SECUENCIAS_LED = ("chase", "alternate", "blink_all")
LED_INTERVALO_MINIMO_S = 2   # menos que esto da destellos bruscos

# ---- Demo (simula comandos de la web) ----
MODO_DEMO = True
DEMO_CADA_S = 6              # segundos entre una orden y la siguiente

# ---- Tiempos ----
WIFI_TIMEOUT_S = 20          # cuanto esperar al conectar el WiFi
INTERVALO_AMBIENTE_S = 10    # cada cuanto leer temperatura y humedad
REVISAR_WIFI_CADA_S = 5      # cada cuanto comprobar que sigue el WiFi
PAUSA_CICLO_MS = 100         # pausa entre vueltas del ciclo principal
