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

# Solo se usan si config.MONITOREO_MOVIMIENTO_HABILITADO = True.
# El token es el dedicado al modulo de movimiento (64 hex), distinto al de ambiente.
MOVIMIENTO_DEVICE_ID = "cuna-movimiento-01"
MOVIMIENTO_TOKEN = ""
