
# ==========================================
# PRUEBA - SISTEMA DEL COLCHON
# ==========================================

import time

# Importar configuracion
import setup


# ==========================================
# 1. INICIALIZACION
# ==========================================

print("\n==============================")
print(" PRUEBA DEL COLCHON")
print("==============================")

print("Inicializando HX711...")

try:

    time.sleep(2)

    referencia = setup.tare()

    print("HX711 conectado correctamente")
    print("Tara:", referencia)

except OSError as error:

    print("ERROR:", error)
    raise


# ==========================================
# 2. MENU DE PRUEBAS
# ==========================================

print("\nPRUEBAS DISPONIBLES:")
print("1 - Leer peso")
print("2 - Realizar tara")
print("3 - Encender buzzer")
print("4 - Apagar buzzer")
print("5 - Probar boton")
print("6 - Salir")

while True:

    opcion = input("\nSeleccione una prueba: ")

    # --------------------------------------
    # LEER PESO
    # --------------------------------------

    if opcion == "1":

        try:

            lectura = setup.read_average(5)

            peso = setup.get_weight(
                lectura,
                referencia
            )

            print("\nLectura HX711:", lectura)
            print("Peso aproximado:", round(peso, 2), "g")

        except OSError as error:

            print("Error de lectura:", error)

    # --------------------------------------
    # REALIZAR TARA
    # --------------------------------------

    elif opcion == "2":

        print("Retire el peso de la celda...")

        time.sleep(2)

        referencia = setup.tare()

        print("Nueva referencia:", referencia)

    # --------------------------------------
    # ENCENDER BUZZER
    # --------------------------------------

    elif opcion == "3":

        setup.buzzer_on()

        print("Buzzer encendido")

    # --------------------------------------
    # APAGAR BUZZER
    # --------------------------------------

    elif opcion == "4":

        setup.buzzer_off()

        print("Buzzer apagado")

    # --------------------------------------
    # PROBAR BOTON
    # --------------------------------------

    elif opcion == "5":

        print("Esperando pulsacion del boton...")

        while not setup.button_pressed():
            time.sleep_ms(20)

        print("Boton detectado correctamente")

        while setup.button.value() == 0:
            time.sleep_ms(20)

    # --------------------------------------
    # SALIR
    # --------------------------------------

    elif opcion == "6":

        setup.buzzer_off()

        print("Finalizando pruebas...")
        break

    else:

        print("Opcion no valida")
