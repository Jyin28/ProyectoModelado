"""Plantilla de claves.

1. Copia este archivo con el nombre  secrets.py
2. Escribe tu red WiFi (debe ser de 2,4 GHz; el hotspot del telefono sirve).
3. NUNCA subas secrets.py a Git.
"""
WIFI_SSID = "nombre-de-tu-wifi"
WIFI_PASSWORD = "clave-de-tu-wifi"

# Completa el token con el valor entregado para este modulo.
AMBIENTE_URL = "https://tlbwsdnqhwvuvgjcxgsg.supabase.co/functions/v1/ingesta"
AMBIENTE_DEVICE_ID = "cuna-ambiente-01"
AMBIENTE_TOKEN = ""

# Lampara remota (apagada mientras estas variables esten vacias).
# Cuenta Supabase Auth exclusiva del dispositivo; no uses la del cuidador.
LAMPARA_SUPABASE_URL = ""        # https://<proyecto>.supabase.co (sin ruta)
LAMPARA_PUBLISHABLE_KEY = ""     # clave publicable (nunca la secreta ni service_role)
LAMPARA_DEVICE_ID = ""           # cuna-lampara-NN
LAMPARA_AUTH_EMAIL = ""
LAMPARA_AUTH_PASSWORD = ""

# Ordenes remotas de figuras, audio, monitoreo de movimiento y colchon (y voz).
# Apagadas mientras estas variables esten vacias. Cuenta Supabase Auth exclusiva
# del dispositivo, vinculada a UN modulo del producto (el que esta conectado).
ORDENES_SUPABASE_URL = ""        # https://<proyecto>.supabase.co (sin ruta)
ORDENES_PUBLISHABLE_KEY = ""     # clave publicable (nunca la secreta ni service_role)
ORDENES_DEVICE_ID = ""           # cuna-figuras-NN, cuna-audio-NN, cuna-colchon-NN...
ORDENES_PRODUCTO_ID = ""         # producto al que pertenece ese modulo, por ejemplo cuna-01
ORDENES_AUTH_EMAIL = ""
ORDENES_AUTH_PASSWORD = ""

# Solo se usan si config.MONITOREO_MOVIMIENTO_HABILITADO = True.
# El token es el dedicado al modulo de movimiento (64 hex), distinto al de ambiente.
MOVIMIENTO_DEVICE_ID = "cuna-movimiento-01"
MOVIMIENTO_TOKEN = ""

# Informe de alarmas del colchon (solo con COLCHON_HABILITADO = True y MODULO = "colchon").
# El token se crea con el alta del dispositivo; nunca se sube a git.
COLCHON_DEVICE_ID = "cuna-colchon-01"
COLCHON_TOKEN = ""

# Informe de eventos de la habitacion (solo con HABITACION_HABILITADO = True y MODULO = "habitacion").
# El token se crea con el alta del dispositivo; nunca se sube a git.
HABITACION_DEVICE_ID = "cuna-habitacion-01"
HABITACION_TOKEN = ""

# Informe de pesos y temperatura del biberon (solo con ALIMENTACION_HABILITADO = True y MODULO = "alimentacion").
# El token se crea con el alta del dispositivo; nunca se sube a git.
ALIMENTACION_DEVICE_ID = "cuna-alimentacion-01"
ALIMENTACION_TOKEN = ""
