"""config.py - Valores que puedes cambiar sin tocar el resto del codigo.

Los pines son PROVISIONALES: confirmalos con el equipo de circuitos.
No uses GP23, GP24, GP25 ni GP29 (los usa el chip WiFi de la Pico W).
"""

# Nombre con el que este dispositivo se identificara mas adelante en la nube
DEVICE_ID = "pico-sprint3-01"

# ---- Pines (numero de GPIO) ----
PIN_AM2301 = 2      # sensor de temperatura y humedad
PIN_PIR = 3         # sensor de movimiento

# ---- Tiempos ----
WIFI_TIMEOUT_S = 20          # cuanto esperar al conectar el WiFi
INTERVALO_AMBIENTE_S = 10    # cada cuanto leer temperatura y humedad
REVISAR_WIFI_CADA_S = 5      # cada cuanto comprobar que sigue el WiFi
PAUSA_CICLO_MS = 100         # pausa entre vueltas del ciclo principal
