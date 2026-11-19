"""Plantilla de claves (PICO 2).

1. Copia este archivo con el nombre  secrets.py  (esta en .gitignore).
2. Escribe tu red WiFi (2,4 GHz; el hotspot del telefono sirve).
3. INGESTA_URL, SUPABASE_URL y SUPABASE_ANON_KEY son los mismos de la Pico del colchon.
4. DEVICE_TOKEN: token propio de este dispositivo (64 caracteres hex).
   TOKEN_SHA256: su SHA-256 (es lo que se registra en Supabase). Para generarlos:
       python -c "import secrets,hashlib;t=secrets.token_hex(32);print(t);print(hashlib.sha256(t.encode()).hexdigest())"
5. NUNCA subas secrets.py a Git ni pongas claves privilegiadas (service_role).
"""
WIFI_SSID = "nombre-de-tu-wifi"
WIFI_PASSWORD = "clave-de-tu-wifi"

INGESTA_URL = ""          # ej: https://<proyecto>.supabase.co/functions/v1/ingesta
SUPABASE_URL = ""         # ej: https://<proyecto>.supabase.co
SUPABASE_ANON_KEY = ""
DEVICE_TOKEN = ""
TOKEN_SHA256 = ""

# PIR: modulo propio (cuna-movimiento-NN) con su token. Genera el par igual que arriba.
MOVIMIENTO_DEVICE_ID = ""    # ej: cuna-movimiento-01
MOVIMIENTO_TOKEN = ""
MOVIMIENTO_TOKEN_SHA256 = ""
