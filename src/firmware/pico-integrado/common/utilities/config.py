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

# ---- Colchon (HARDWARE APAGADO POR DEFECTO, SIN PROBAR EN HARDWARE) ----
# Los pines son una PROPUESTA pendiente de confirmacion y cableado.
COLCHON_HABILITADO = False   # True solo cuando el cableado este confirmado
PIN_HX711_DT = 17            # datos del HX711 (propuesta)
PIN_HX711_SCK = 16           # reloj del HX711 (propuesta)
PIN_BUZZER = 14              # base del NPN del buzzer pasivo (propuesta)
BUZZER_FRECUENCIA_HZ = 2000   # tono de la alarma
PIN_BOTON = 15               # boton fisico a GND con pull-up interno (propuesta)
BOTON_ACTIVO_BAJO = True     # True: pulsado = 0 (boton a GND)

COLCHON_TOLERANCIA_PCT = 10          # perdida de peso tolerada, % de la referencia
COLCHON_LECTURAS_REQUERIDAS = 3      # lecturas consecutivas fuera de tolerancia
COLCHON_INTERVALO_MS = 1000          # una lectura de monitoreo por segundo
COLCHON_MONITOREO_S = 300            # duracion por defecto del monitoreo
COLCHON_MONITOREO_MAX_S = 86400      # tope de duracion aceptada (24 h)
COLCHON_ALARMA_MAX_S = 60            # la alarma se apaga sola a los 60 s
COLCHON_MUESTRAS_CAPTURA = 10        # lecturas promediadas para tara/referencia
COLCHON_ESPERA_LISTO_MS = 2000       # HX711 sin "listo" tanto tiempo = lectura invalida
COLCHON_CAPTURA_TIMEOUT_MS = 10000   # tope para completar una captura
COLCHON_ANTIRREBOTE_MS = 50          # el boton debe estar estable este tiempo
COLCHON_CALIBRACION_DELTA_MIN = 100  # cuentas minimas de diferencia al calibrar
# True: si se corta el WiFi con el monitoreo activo, se detiene y exige rearme.
# False solo para una prueba controlada independiente (ver README).
COLCHON_REQUIERE_WIFI = True
COLCHON_PAUSA_CICLO_MS = 20          # pausa del ciclo si el colchon esta habilitado

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
