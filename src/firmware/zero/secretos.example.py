"""Plantilla de claves (ZERO).

1. Copia este archivo con el nombre  secretos.py
   (no se llama secrets.py porque ese nombre ya existe en Python 3 y chocaria).
2. El WiFi de la Zero NO se configura aqui: lo maneja Raspberry Pi OS
   (raspi-config, nmcli o Raspberry Pi Imager).
3. INGESTA_URL y DEVICE_TOKEN los entrega quien hace el backend. Mientras
   esten vacios, la Zero NO envia nada a Internet (solo imprime por consola).
4. NUNCA subas secretos.py a Git. Nunca pongas aqui claves privilegiadas
   de Supabase (service_role): solo la credencial limitada del dispositivo.
"""
INGESTA_URL = ""      # ej: https://<proyecto>.supabase.co/functions/v1/ingesta
DEVICE_TOKEN = ""     # credencial limitada de ESTE dispositivo
