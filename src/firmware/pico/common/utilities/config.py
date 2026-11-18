"""config.py (PICO) - Valores que puedes cambiar sin tocar el resto del codigo.

Esta Pico 2 W controla el COLCHON y las FIGURAS LED.
La cuna (AM2301, PIR, lampara, audio) va en la Raspberry Pi Zero 2 W.

Los pines del colchon (HX711, boton, buzzer) estan en colchon/setup_colchon.py.
No uses GP23, GP24, GP25 ni GP29 (los usa el chip WiFi de la Pico W).
"""

# Nombre con el que este dispositivo se identifica ante la nube
DEVICE_ID = "pico-figuras-colchon-01"

# ---- Pines (numero de GPIO) ----
PINES_LEDS = (20, 21, 22, 26, 27, 28)   # los seis LED de las figuras

# ---- Figuras ----
SECUENCIAS_LED = ("chase", "alternate", "blink_all")
LED_INTERVALO_MINIMO_S = 2   # menos que esto da destellos bruscos

# ---- Colchon ----
ALARMA_S = 60                    # duracion del sonido (configurable por orden)
REFERENCIA_MINIMA_G = 50         # menos que esto no se acepta como referencia
MUESTRAS_REFERENCIA = 5          # lecturas que se promedian al capturar referencia
REFERENCIA_VARIACION_MAX_PCT = 5 # si las lecturas varian mas, se rechaza (inestable)
FALLOS_LECTURA_MAX = 5           # lecturas seguidas sin respuesta -> detener monitoreo
ARCHIVO_CALIBRACION = "calibracion.json"   # guarda el factor de calibracion

PESO_REFERENCIA_G = 200
TOLERANCIA_PESO_PCT = 10



# ---- Conexion ----
# True: si se cae el WiFi/Internet, el monitoreo se detiene (requisito).
# Ponlo en False solo para probar en el banco sin red.
EXIGIR_CONEXION = True
WIFI_TIMEOUT_S = 20          # cuanto esperar al conectar el WiFi
REVISAR_WIFI_CADA_S = 5      # cada cuanto comprobar que sigue el WiFi
HEARTBEAT_S = 30             # aviso periodico a la nube (tambien prueba la conexion)
ENVIAR_PESO_CADA_S = 5       # el requisito dice 1 s; ver README (envio bloqueante)
HTTP_TIMEOUT_S = 3           # espera maxima por cada envio HTTPS
COLA_MAX = 20                # eventos pendientes de enviar (los mas viejos se descartan)
ENVIOS_FALLIDOS_MAX = 3      # envios seguidos fallidos = sin Internet
REINTENTO_ENVIO_S = 5        # espera tras un envio fallido

# ---- Demo (simula comandos de la web) ----
MODO_DEMO = True
DEMO_CADA_S = 6              # segundos entre una orden y la siguiente

# ---- Ciclo principal ----
REINTENTO_HX711_S = 5        # si el HX711 no responde, reintentar cada 5 s
PAUSA_CICLO_MS = 100         # pausa entre vueltas del ciclo principal
