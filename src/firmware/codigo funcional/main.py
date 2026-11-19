"""Punto de entrada de MicroPython. Guardar todos los módulos en la raíz del Pico."""
from time import sleep_ms
from mfrc522 import MFRC522
from lector_tarjeta import LectorTarjeta
from dados import DadosElectronicos
from envio_serial import enviar_tarjeta, enviar_dados


def ejecutar():
    lector = LectorTarjeta(MFRC522(sck=2, mosi=3, miso=4, rst=5, cs=1))
    dados = DadosElectronicos()
    print("INFO|SISTEMA_INICIADO")
    while True:
        uid = lector.leer()
        if uid:
            enviar_tarjeta(uid)
        tirada = dados.leer_tirada()
        if tirada:
            enviar_dados(tirada[0], tirada[1])
        sleep_ms(20)


if __name__ == "__main__":
    ejecutar()
