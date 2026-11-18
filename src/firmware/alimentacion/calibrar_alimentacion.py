"""calibrar_alimentacion.py - Tara y calibracion local de la balanza del biberon, SIN red.

Ejecutalo desde Thonny con solo el montaje de la alimentacion conectado
(MODULO = "alimentacion" y ALIMENTACION_HABILITADO = True en config.py). Usa
los pines de config.py y guarda el factor en ARCHIVO_CALIBRACION_ALIMENTACION,
que main.py carga al arrancar. Tambien toma el cero con la balanza vacia al
encender (ALIMENTACION_TARA_AL_INICIAR), asi que el factor es lo unico que hay
que calibrar con una pesa de peso conocido.

Pasos: 1) balanza vacia y opcion 1 (tara). 2) pesa conocida y opcion 2.
3) opcion 3 para comprobar la lectura. SIN PROBAR EN HARDWARE.
"""
import sys
import time

for _carpeta in ("/alimentacion", "/colchon", "/common/utilities"):
    if _carpeta not in sys.path:
        sys.path.append(_carpeta)

import config
import control_alimentacion


def _esperar(control):
    """Avanza el ciclo hasta que termine la captura en curso y muestra el resultado."""
    while control.captura_activa():
        control.actualizar(time.ticks_ms())
        time.sleep_ms(20)
    print("Resultado:", control.ultimo_resultado)


def menu():
    config.ALIMENTACION_TARA_AL_INICIAR = False     # aqui la tara se pide a mano
    control = control_alimentacion.iniciar(config)
    while True:
        print("\n1 tara (balanza vacia)  2 calibrar (pesa conocida)  3 leer  4 salir")
        opcion = input("> ").strip()
        try:
            if opcion == "1":
                control.tarar(time.ticks_ms())
                _esperar(control)
            elif opcion == "2":
                gramos = float(input("Peso de la pesa en gramos: "))
                control.calibrar(gramos, time.ticks_ms())
                _esperar(control)
            elif opcion == "3":
                if not control.calibracion.calibrada:
                    print("Falta la tara o el factor")
                    continue
                control.pesar("00000000-0000-4000-8000-000000000000", "control", time.ticks_ms())
                _esperar(control)
                for evento in control.sacar_eventos():
                    print(evento["tipo"], evento["datos"])
            elif opcion == "4":
                return
        except ValueError as error:
            print("Error:", error)


if __name__ == "__main__":
    menu()
