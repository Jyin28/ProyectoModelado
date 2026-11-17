"""wifi.py - Conexion a la red WiFi.

Funciones:
    conectar()           intenta conectar y devuelve True o False
    esta_conectado()     True si hay conexion ahora mismo
    direccion_ip()       la IP que nos dio el router
    asegurar_conexion()  si se cayo, intenta reconectar
"""
import time
import network

import config
import secrets

# Objeto que representa la antena WiFi de la Pico (modo "estacion" = cliente)
_wlan = network.WLAN(network.STA_IF)


def conectar(timeout_s=config.WIFI_TIMEOUT_S):
    """Conecta al WiFi de secrets.py. Devuelve True si lo logra."""
    _wlan.active(True)

    if _wlan.isconnected():
        return True

    print("Conectando a", secrets.WIFI_SSID, "...")
    _wlan.connect(secrets.WIFI_SSID, secrets.WIFI_PASSWORD)

    inicio = time.ticks_ms()
    while not _wlan.isconnected():
        transcurrido_ms = time.ticks_diff(time.ticks_ms(), inicio)
        if transcurrido_ms > timeout_s * 1000:
            print("No se pudo conectar (tiempo agotado)")
            return False
        time.sleep_ms(250)

    print("WiFi conectado. IP:", direccion_ip())
    return True


def esta_conectado():
    return _wlan.isconnected()


def direccion_ip():
    return _wlan.ifconfig()[0]


def asegurar_conexion():
    """Si el WiFi se cayo, intenta volver a conectar. Devuelve True si hay conexion."""
    if esta_conectado():
        return True
    print("WiFi caido, reconectando...")
    return conectar(timeout_s=15)
