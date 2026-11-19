"""config.py - Valores que puedes cambiar sin tocar el resto del codigo.

Los pines son PROVISIONALES: confirmalos con el equipo de circuitos.
No uses GP23, GP24, GP25 ni GP29 (los usa el chip WiFi de la Pico W).
"""

# Identificador de la placa fisica ante Supabase. Debe coincidir con el id con
# el que se registro el dispositivo en la nube (junto con TOKEN_SHA256).
DEVICE_ID = "pico2-cuna-01"

# Modulo al que esta conectada la Pico AHORA. Hay una sola Pico y se pasa de un
# modulo a otro: edita este valor, copia config.py a la Pico y reinicia.
#   "cuna"     AM2301, PIR, lampara y audio
#   "figuras"  los seis LED
#   "completo" todo a la vez (como el codigo funcional; los pines no se pisan)
# Solo se inicializa lo del modulo elegido (ver modulo.py).
MODULO = "completo"

# ---- Pines (numero de GPIO) ----
PIN_AM2301 = 2      # sensor de temperatura y humedad
PIN_PIR = 3         # sensor de movimiento
PIN_LAMPARA = 13    # compuerta del MOSFET (LED blanco)
PINES_LEDS = (6, 7, 8, 9, 10, 11)       # los seis LED de las figuras (codigo funcional)

# ---- Movimiento (PIR) ----
# Cada flanco ascendente del PIR se envia a Supabase como evento de movimiento
# (modulo cuna-movimiento-NN, con MOVIMIENTO_DEVICE_ID y MOVIMIENTO_TOKEN en
# secrets.py). Ponlo en False para que solo avise por consola.
MONITOREO_MOVIMIENTO_HABILITADO = True
PIR_ESTABILIZACION_S = 60    # el HC-SR501 tarda en estabilizarse tras encender
PIR_REPOSO_S = 2             # segundos seguidos en reposo antes de confiar en el

# ---- Lampara y figuras ----
LAMPARA_FRECUENCIA_HZ = 1000
SECUENCIAS_LED = ("chase", "alternate", "blink_all", "patrones")
LED_INTERVALO_MINIMO_S = 2   # menos que esto da destellos bruscos

# ---- Efectos autonomos del codigo funcional ----
# Sin ordenes de la web: los LED corren el ciclo "patrones" y la lampara sube y
# baja su brillo. La lampara no respira si hay lampara remota (no pisar el PWM).
EFECTOS_AUTONOMOS = True
LAMPARA_RESPIRAR_PERIODO_S = 2.6   # subir y bajar completo

# ---- Demo (simula comandos de la web) ----
MODO_DEMO = True
DEMO_CADA_S = 6              # segundos entre una orden y la siguiente

# ---- Audio local MAX98357A ----
# Pines y formato tomados del codigo funcional (I2S0: BCLK GP18, WS GP19, DIN GP20).
# En la RP2 WS debe ser el GPIO siguiente a BCLK. SIN PROBAR en esta estructura.
AUDIO_HABILITADO = True
PIN_I2S_BCLK = 18
PIN_I2S_WS = 19              # obligatoriamente BCLK + 1
PIN_I2S_DIN = 20
AUDIO_ID_I2S = 0
AUDIO_TASA_HZ = 16000        # PCM 16 bits, mono
AUDIO_FRECUENCIA_HZ = 500    # tono suave sintetizado en memoria ("tono_suave")
AUDIO_VOLUMEN_PCT = 30       # % de la amplitud digital maxima (VOLUMEN = 0.3 del codigo funcional)
AUDIO_VOLUMEN_MAX_PCT = 30   # tope; valores mayores se recortan
AUDIO_DURACION_S = 5         # duracion del "tono_suave"
AUDIO_DURACION_MAX_S = 30    # tope de duracion
AUDIO_ARCHIVO = "prueba.wav" # WAV PCM 16 bits, mono, 16 kHz, en la Pico ("prueba")
AUDIO_AL_INICIAR = True      # reproduce AUDIO_SONIDO_INICIO una vez al arrancar
AUDIO_SONIDO_INICIO = "prueba"

# GPIO que usa el chip WiFi de la Pico W: no asignar a nada.
PINES_RESERVADOS_WIFI = (23, 24, 25, 29)

# ---- Tiempos ----
WIFI_TIMEOUT_S = 20          # cuanto esperar al conectar el WiFi
INTERVALO_AMBIENTE_S = 15    # cada cuanto leer temperatura y humedad
REVISAR_WIFI_CADA_S = 5      # cada cuanto comprobar que sigue el WiFi
PAUSA_CICLO_MS = 100         # pausa entre vueltas del ciclo principal
