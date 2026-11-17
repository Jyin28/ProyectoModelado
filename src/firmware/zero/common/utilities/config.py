"""config.py (ZERO) - Valores que puedes cambiar sin tocar el resto del codigo.

Esta Raspberry Pi Zero 2 W controla la CUNA: temperatura/humedad (AM2301),
movimiento (PIR), lampara regulable y audio pregrabado.
El colchon y las figuras LED van en la Pico 2 W.

Los pines usan la numeracion BCM (el numero "GPIO", no el numero fisico).
Los pines son PROVISIONALES: confirmalos con el equipo de circuitos.
NO USAR: BCM18, BCM19 y BCM21 (los usa el amplificador I2S MAX98357A),
         BCM0 y BCM1 (EEPROM de la placa), BCM14 y BCM15 (consola serie).
"""
import os

# Carpeta zero/ (config.py esta en zero/common/utilities/)
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Nombre con el que este dispositivo se identifica ante la nube
DEVICE_ID = "zero-cuna-01"

# ---- Pines (BCM) ----
PIN_AM2301 = 4      # sensor de temperatura y humedad (D4 = BCM4)
PIN_PIR = 17        # sensor de movimiento HC-SR501 (salida de 3,3 V)
PIN_LAMPARA = 12    # compuerta del MOSFET IRLZ44N (LED blanco)
# I2S (MAX98357A): BCLK = BCM18, LRC = BCM19, DIN = BCM21 -> reservados

# ---- Lampara ----
LAMPARA_FRECUENCIA_HZ = 1000

# ---- Audio ----
CARPETA_AUDIO = os.path.join(RAIZ, "audio")   # archivos .wav del catalogo
# Dispositivo ALSA. Para limitar el volumen del parlante de 0,5 W crea un
# dispositivo "softvol" (ver README) y pon su nombre aqui, p. ej. "cuna_vol".
AUDIO_DISPOSITIVO = "default"
DETENER_AUDIO_SIN_RED = True   # si se cae Internet, se detiene el audio

# ---- Conexion ----
HEARTBEAT_S = 30             # aviso periodico a la nube
HTTP_TIMEOUT_S = 5           # espera maxima por cada envio HTTPS
COLA_MAX = 50                # eventos pendientes (los mas viejos se descartan)
ENVIOS_FALLIDOS_MAX = 3      # envios seguidos fallidos = sin Internet
REINTENTO_ENVIO_S = 5        # espera tras un envio fallido

# ---- Demo (simula comandos de la web) ----
MODO_DEMO = True
DEMO_CADA_S = 6              # segundos entre una orden y la siguiente

# ---- Tiempos del ciclo principal ----
INTERVALO_AMBIENTE_S = 10    # cada cuanto leer temperatura y humedad
REVISAR_RED_CADA_S = 5       # cada cuanto comprobar que hay Internet
PAUSA_CICLO_S = 0.1          # pausa entre vueltas del ciclo principal
