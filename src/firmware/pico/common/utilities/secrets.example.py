"""Plantilla de claves (PICO).

1. Copia este archivo con el nombre  secrets.py
2. Escribe tu red WiFi (debe ser de 2,4 GHz; el hotspot del telefono sirve).
3. INGESTA_URL y DEVICE_TOKEN los entrega quien hace el backend. Mientras
   esten vacios, la Pico NO envia nada a Internet (solo imprime por consola).
4. NUNCA subas secrets.py a Git. Nunca pongas aqui claves privilegiadas
   de Supabase (service_role): solo la credencial limitada del dispositivo.
"""
WIFI_SSID = "nombre-de-tu-wifi"
WIFI_PASSWORD = "clave-de-tu-wifi"

INGESTA_URL = ""      # ej: https://<proyecto>.supabase.co/functions/v1/ingesta
DEVICE_TOKEN = ""     # credencial limitada de ESTE dispositivo
