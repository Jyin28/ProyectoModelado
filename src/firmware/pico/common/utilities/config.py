"""config.py - Valores que puedes cambiar sin tocar el resto del codigo.

Los pines son PROVISIONALES: confirmalos con el equipo de circuitos.
No uses GP23, GP24, GP25 ni GP29 (los usa el chip WiFi de la Pico W).
"""

# Identificador de la placa fisica. El modulo ambiental usa AMBIENTE_DEVICE_ID.
DEVICE_ID = "pico-figuras-colchon-01"

# Modulo al que esta conectada la Pico AHORA. Hay una sola Pico y se pasa de un
# modulo a otro: edita este valor, copia config.py a la Pico y reinicia.
#   "cuna"    AM2301, PIR, lampara y audio
#   "colchon" HX711, celda de carga, buzzer y boton
#   "figuras" los seis LED
#   "habitacion" sensor de puerta (reed) y PIR del cuarto
#   "juego"   cinco botones con luz y un buzzer (funciona sin red)
#   "alimentacion" balanza (HX711) y sonda de temperatura (DS18B20) del biberon
# Solo se inicializa lo del modulo elegido (ver modulo.py).
# Los pines solo deben ser unicos DENTRO de cada modulo: la Pico atiende uno por vez.
MODULO = "cuna"

# ---- Pines (numero de GPIO) ----
PIN_AM2301 = 2      # sensor de temperatura y humedad
PIN_PIR = 3         # sensor de movimiento
PIN_LAMPARA = 13    # compuerta del MOSFET (LED blanco)
PINES_LEDS = (6, 7, 8, 9, 10, 11)       # los seis LED de las figuras (cableado del codigo funcional)

# ---- Movimiento (PIR) ----
# True = el PIR esta cableado y secrets.py tiene MOVIMIENTO_DEVICE_ID y
# MOVIMIENTO_TOKEN. Con ordenes remotas, el monitoreo arranca APAGADO y solo lo
# enciende una orden motion_set confirmada (la Pico informa monitoreo=false al
# conectarse); con False, motion_set responde movimiento_no_habilitado.
MONITOREO_MOVIMIENTO_HABILITADO = True
# El HC-SR501 tarda en estabilizarse tras encender: 60 s sin informar y despues
# 2 s seguidos en reposo (common/sensors/pir.py, como en el codigo funcional).
PIR_ESTABILIZACION_S = 60
PIR_REPOSO_S = 2

# ---- Lampara y figuras ----
LAMPARA_FRECUENCIA_HZ = 1000
SECUENCIAS_LED = ("chase", "alternate", "blink_all")
LED_INTERVALO_MINIMO_S = 2   # menos que esto da destellos bruscos
LED_RAMPA_MS = 400           # duracion de cada transicion de brillo (sin destellos bruscos)
LED_PWM_HZ = 1000
FIGURAS_PAUSA_CICLO_MS = 20  # pausa del ciclo con las figuras: con 100 ms la rampa de 400 ms se ve a saltos

# ---- Demo (simula comandos de la web) ----
MODO_DEMO = True
DEMO_CADA_S = 6              # segundos entre una orden y la siguiente

# ---- Colchon (modulo "colchon": colchon/peso.py, colchon/monitoreo.py, colchon/setup_colchon.py) ----
# Los pines (HX711 GP13/GP12, boton GP19, buzzer GP18) estan en colchon/setup_colchon.py.
# Eventos y ordenes viajan por common/communication/nube.py (INGESTA_URL, DEVICE_TOKEN y las
# demas claves en secrets.py) al dispositivo DEVICE_ID, que es el que muestra la web.
ALARMA_S = 60                    # duracion del sonido (configurable por orden)
REFERENCIA_MINIMA_G = 50         # menos que esto no se acepta como referencia
MUESTRAS_REFERENCIA = 5          # lecturas que se promedian al capturar referencia
REFERENCIA_VARIACION_MAX_PCT = 5 # si las lecturas varian mas, se rechaza (inestable)
FALLOS_LECTURA_MAX = 5           # lecturas seguidas sin respuesta -> detener monitoreo
PESO_REFERENCIA_G = 200
TOLERANCIA_PESO_PCT = 10
# El factor de calibracion se guarda en la Pico para que sobreviva al cambio de
# modulo. La tara NO se guarda: depende del montaje y se toma cada vez.
ARCHIVO_CALIBRACION = "calibracion.json"

# True: si se cae el WiFi/Internet, el monitoreo del colchon se detiene (requisito).
# Ponlo en False solo para probar en el banco sin red.
EXIGIR_CONEXION = True
HTTP_TIMEOUT_S = 3           # espera maxima por cada envio HTTPS del colchon
HTTP_TIMEOUT_ALARMA_S = 1    # con la alarma sonando la red espera menos: el boton y 'detener' no deben quedar bloqueados
COLA_MAX = 20                # eventos pendientes de enviar (los mas viejos se descartan)
ENVIOS_FALLIDOS_MAX = 3      # envios seguidos fallidos = sin Internet
REINTENTO_ENVIO_S = 5        # espera tras un envio fallido
REINTENTO_HX711_S = 5        # si el HX711 no responde, reintentar cada 5 s

# ---- Audio local MAX98357A (HABILITADO, SIN PROBAR EN HARDWARE) ----
# Con False, audio_play/audio_stop responden audio_no_habilitado. No toca ningun
# pin hasta que se reproduce algo; si el I2S no arranca, el audio queda apagado y
# el resto del modulo sigue.
# Pines del cableado del codigo funcional (I2S0: BCLK GP18, WS GP19, DIN GP20); en
# la RP2 WS debe ser el GPIO siguiente a BCLK. Sin revision electrica del equipo.
AUDIO_HABILITADO = True
PIN_I2S_BCLK = 18
PIN_I2S_WS = 19              # obligatoriamente BCLK + 1
PIN_I2S_DIN = 20
AUDIO_ID_I2S = 0
AUDIO_TASA_HZ = 16000        # PCM 16 bits, mono
AUDIO_FRECUENCIA_HZ = 500    # tono suave sintetizado en memoria
AUDIO_VOLUMEN_PCT = 30       # % de la amplitud digital maxima (VOLUMEN = 0.3 del codigo funcional)
AUDIO_VOLUMEN_MAX_PCT = 30   # tope; valores mayores se recortan
AUDIO_DURACION_S = 5         # duracion del "tono_suave"
AUDIO_DURACION_MAX_S = 30    # tope de duracion
# Catalogo de sonidos que la app puede pedir con audio_play (nombre -> origen):
#   None        = tono sintetizado en memoria (frecuencia AUDIO_FRECUENCIA_HZ)
#   "ruta.wav"  = WAV PCM 16 bits, mono, 16 kHz, copiado a la Pico
# Para agregar una cancion: copia el WAV a la Pico, agrega su nombre aqui (solo
# a-z, 0-9 y _, hasta 40 caracteres) y agregalo tambien a CATALOGO_AUDIO en
# src/frontend/src/models/ordenes.ts. No hay carga de archivos desde la app (DEC-08).
AUDIO_CATALOGO = {
    "tono_suave": None,
    "prueba": "prueba.wav",
}

# ---- Voz del cuidador (HABILITADA, SIN PROBAR EN HARDWARE) ----
# Reutiliza la salida I2S del audio: con VOZ_HABILITADA tambien debe estar
# AUDIO_HABILITADO (si no, la voz no se crea y no avisa). Contrato:
# src/shared/contracts/voz.md.
VOZ_HABILITADA = True
VOZ_TASA_ENTRADA_HZ = 8000   # PCM 16 bits, mono, que envia la web
VOZ_BUFER_FRAGMENTOS = 4     # fragmentos en espera; al llenarse se descarta el mas antiguo
VOZ_SIN_DATOS_MS = 2000      # sin fragmentos tanto tiempo, la sesion se cierra

# ---- Habitacion (HARDWARE APAGADO POR DEFECTO, SIN PROBAR EN HARDWARE) ----
# Pines PROPUESTOS (docs/Sprint4/diseno-fisico.md 3.4). Sin alarma local: el
# evento solo avisa por Telegram (CA-17.3). No distingue entrada de salida.
HABITACION_HABILITADO = False
PIN_PUERTA = 4               # reed (MC-38) a GND con pull-up interno: abierto = 1
PIN_PIR_HABITACION = 5       # PIR del cuarto
PUERTA_ABIERTA_ES_ALTO = True   # con pull-up, el contacto abierto lee 1
HABITACION_ANTIRREBOTE_MS = 100  # el sensor debe estar estable este tiempo
HABITACION_PAUSA_CICLO_MS = 20   # pausa del ciclo con la habitacion habilitada

# ---- Juego de cinco botones (HARDWARE APAGADO POR DEFECTO, SIN PROBAR EN HARDWARE) ----
# Funciona solo en la Pico, sin WiFi ni Supabase. Pines PROPUESTOS
# (docs/Sprint4/diseno-fisico.md 3.5): botones a GND con pull-up, un LED por boton.
JUEGO_HABILITADO = False
PINES_JUEGO_BOTONES = (2, 3, 4, 5, 6)     # cinco botones arcade
PINES_JUEGO_LEDS = (7, 8, 9, 10, 11)      # un LED con resistencia por boton
PIN_JUEGO_BUZZER = 14                     # base del NPN del buzzer pasivo
JUEGO_BOTON_ACTIVO_BAJO = True            # pulsado = 0 (boton a GND con pull-up)
JUEGO_ANTIRREBOTE_MS = 30                 # el boton debe estar estable este tiempo
JUEGO_TONO_HZ = 1500                      # tono de la recompensa
JUEGO_RECOMPENSA_MS = 400                 # duracion de la recompensa
JUEGO_INICIA_ENCENDIDO = True             # al darle corriente, el juego empieza
# Apagar y volver a encender sin otro boton: mantener pulsados estos dos botones
# (indices 0 a 4) a la vez. PROPUESTA: el diseno comercial puede usar un interruptor.
JUEGO_COMBO_ONOFF = (0, 4)
JUEGO_COMBO_MS = 2000
JUEGO_PAUSA_CICLO_MS = 10                 # pausa del ciclo con el juego habilitado

# ---- Alimentacion (HARDWARE APAGADO POR DEFECTO, SIN PROBAR EN HARDWARE) ----
# La web conduce la toma; la Pico pesa cuando se lo ordenan (feeding_weigh) y
# envia los gramos como evento. No calienta, no enfria ni suministra alimento
# (CA-23.4). Pines PROPUESTOS (docs/Sprint4/diseno-fisico.md 3.6). El boton fisico
# de inicio no se implementa: el inicio se registra desde la web.
ALIMENTACION_HABILITADO = False
PIN_ALIMENTACION_DT = 17         # datos del HX711 (propuesta)
PIN_ALIMENTACION_SCK = 16        # reloj del HX711 (propuesta)
PIN_DS18B20 = 4                  # sonda 1-Wire con resistencia de 4,7 kOhm a 3,3 V (propuesta)
ARCHIVO_CALIBRACION_ALIMENTACION = "calibracion_alimentacion.json"   # factor propio, no el del colchon
ALIMENTACION_MUESTRAS_PESO = 10          # lecturas promediadas en cada pesaje
ALIMENTACION_PESO_MIN_G = 2.0            # el peso inicial y el final deben superar esto (hay recipiente)
ALIMENTACION_PESO_MAX_G = 1000.0         # rango de la celda de 1 kg
ALIMENTACION_CAPTURA_TIMEOUT_MS = 10000  # tope para completar un pesaje
ALIMENTACION_CALIBRACION_DELTA_MIN = 100 # cuentas minimas de diferencia al calibrar
ALIMENTACION_TARA_AL_INICIAR = True      # cero con la balanza vacia al encender
ALIMENTACION_INTERVALO_TEMP_S = 30       # una lectura de temperatura cada tanto
ALIMENTACION_CONVERSION_TEMP_MS = 800    # espera de la conversion del DS18B20 (12 bits: 750 ms)
ALIMENTACION_PAUSA_CICLO_MS = 20         # pausa del ciclo con la alimentacion habilitada

# GPIO que usa el chip WiFi de la Pico W: no asignar a nada.
PINES_RESERVADOS_WIFI = (23, 24, 25, 29)

# ---- Tiempos ----
WIFI_TIMEOUT_S = 20          # cuanto esperar al conectar el WiFi
INTERVALO_AMBIENTE_S = 2     # cada cuanto leer temperatura y humedad (2 s = minimo del AM2301)
REVISAR_WIFI_CADA_S = 5      # cada cuanto comprobar que sigue el WiFi
PAUSA_CICLO_MS = 100         # pausa entre vueltas del ciclo principal
