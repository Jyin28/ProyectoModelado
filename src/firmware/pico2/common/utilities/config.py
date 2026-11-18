"""config.py - Valores que puedes cambiar sin tocar el resto del codigo.

Los pines son PROVISIONALES: confirmalos con el equipo de circuitos.
No uses GP23, GP24, GP25 ni GP29 (los usa el chip WiFi de la Pico W).
"""

# Identificador de la placa fisica ante Supabase. Debe coincidir con el id con
# el que se registro el dispositivo en la nube (junto con TOKEN_SHA256).
DEVICE_ID = "pico2-cuna-01"

# Modulo al que esta conectada la Pico AHORA. Hay una sola Pico y se pasa de un
# modulo a otro: edita este valor, copia config.py a la Pico y reinicia.
#   "cuna"    AM2301, PIR, lampara y audio
#   "figuras" los seis LED
# Solo se inicializa lo del modulo elegido (ver modulo.py).
MODULO = "cuna"

# ---- Pines (numero de GPIO) ----
PIN_AM2301 = 2      # sensor de temperatura y humedad
PIN_PIR = 3         # sensor de movimiento
PIN_LAMPARA = 13    # compuerta del MOSFET (LED blanco)
PINES_LEDS = (18, 19, 20, 21, 22, 26)   # los seis LED de las figuras

# ---- Movimiento (PIR) ----
# El PIR solo avisa por consola: la Ingesta desplegada en Supabase aun no
# acepta eventos de movimiento, asi que no se envian.

# ---- Lampara y figuras ----
LAMPARA_FRECUENCIA_HZ = 1000
SECUENCIAS_LED = ("chase", "alternate", "blink_all")
LED_INTERVALO_MINIMO_S = 2   # menos que esto da destellos bruscos

# ---- Demo (simula comandos de la web) ----
MODO_DEMO = True
DEMO_CADA_S = 6              # segundos entre una orden y la siguiente

# ---- Audio local MAX98357A (APAGADO POR DEFECTO, SIN PROBAR EN HARDWARE) ----
# Pines PROPUESTOS: en la RP2 WS debe ser el GPIO siguiente a BCLK.
AUDIO_HABILITADO = False
PIN_I2S_BCLK = 6
PIN_I2S_WS = 7               # obligatoriamente BCLK + 1
PIN_I2S_DIN = 8
AUDIO_ID_I2S = 0
AUDIO_TASA_HZ = 16000        # PCM 16 bits, mono
AUDIO_FRECUENCIA_HZ = 500    # tono suave sintetizado en memoria
AUDIO_VOLUMEN_PCT = 10       # % de la amplitud digital maxima
AUDIO_VOLUMEN_MAX_PCT = 25   # tope conservador; valores mayores se recortan
AUDIO_DURACION_S = 5         # duracion de cada reproduccion
AUDIO_DURACION_MAX_S = 30    # tope de duracion

# GPIO que usa el chip WiFi de la Pico W: no asignar a nada.
PINES_RESERVADOS_WIFI = (23, 24, 25, 29)

# ---- Tiempos ----
WIFI_TIMEOUT_S = 20          # cuanto esperar al conectar el WiFi
INTERVALO_AMBIENTE_S = 10    # cada cuanto leer temperatura y humedad
REVISAR_WIFI_CADA_S = 5      # cada cuanto comprobar que sigue el WiFi
PAUSA_CICLO_MS = 100         # pausa entre vueltas del ciclo principal
