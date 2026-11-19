"""Contrato de salida USB serial: una línea por evento."""


def enviar_tarjeta(uid, salida=print):
    salida("RFID|{}".format(uid))


def enviar_dados(dado1, dado2, salida=print):
    if not 1 <= dado1 <= 6 or not 1 <= dado2 <= 6:
        raise ValueError("Cada dado debe estar entre 1 y 6")
    salida("DADO|{}|{}|{}".format(dado1, dado2, dado1 + dado2))
