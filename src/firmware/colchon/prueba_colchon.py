"""prueba_colchon.py - Menu de prueba local del colchon, SIN red.

Ejecutalo desde Thonny con solo el montaje del colchon conectado. Usa
su cableado (DT GP13, SCK GP12, buzzer GP18, boton GP19). Esta prueba
controlada no exige WiFi para armar el monitoreo.

Opciones 1 a 6: las del menu original. 7 a 11: calibrar, armar, estado,
detener y rearmar.
"""
import sys
import time

for _carpeta in ("/colchon", "/common/utilities"):
    if _carpeta not in sys.path:
        sys.path.append(_carpeta)

import config
import control_colchon
from logica_colchon import ACTIVO, ALARMA


def _ahora():
    return time.ticks_ms()


def _esperar_captura(control):
    """Avanza el ciclo hasta que termine la captura en curso y muestra el resultado."""
    while control.captura_activa():
        control.actualizar(_ahora(), True)
        time.sleep_ms(20)
    print("Resultado:", control.ultimo_resultado)
    return control.ultimo_resultado


def _seguir_monitoreo(control):
    print("Monitoreo en curso. Boton fisico o Ctrl+C para detener.")
    previo = None
    ultimo = time.ticks_add(_ahora(), -1000)
    try:
        while control.monitor.estado in (ACTIVO, ALARMA):
            ahora = _ahora()
            control.actualizar(ahora, True)
            if control.monitor.estado != previo:
                previo = control.monitor.estado
                print("Estado:", previo)
            if time.ticks_diff(ahora, ultimo) >= 1000:
                ultimo = ahora
                datos = control.estado(ahora)
                print("peso=%s g, consecutivas=%d, restante=%s s" % (
                    datos["ultimo_peso_g"], datos["consecutivas"], datos["restante_s"]))
            time.sleep_ms(20)
    except KeyboardInterrupt:
        control.detener(_ahora())
    print("Monitoreo terminado:", control.monitor.estado,
          "motivo:", control.monitor.motivo_parada)


def _pedir_duracion():
    texto = input("Duracion en segundos (Enter = %d): " % config.COLCHON_MONITOREO_S)
    return float(texto) if texto.strip() else None


def _ejecutar(control, opcion):
    ahora = _ahora()
    if opcion == "1":                       # leer peso
        control.leer_peso(ahora)
        resultado = _esperar_captura(control)
        if resultado["ok"]:
            if resultado["calibrado"]:
                print("Peso aproximado:", round(resultado["peso_g"], 2), "g")
            else:
                print("Sin calibrar: solo hay lectura cruda (opciones 2 y 7).")
    elif opcion == "2":                     # tara
        input("Retire todo peso de la celda y pulse Enter...")
        control.tara(_ahora())
        _esperar_captura(control)
    elif opcion == "3":                     # encender buzzer
        control.buzzer_prueba(True, ahora)
        print("Buzzer encendido (se apaga con la opcion 4, el boton o a los",
              config.COLCHON_ALARMA_MAX_S, "s)")
    elif opcion == "4":                     # apagar buzzer
        control.buzzer_prueba(False, ahora)
        print("Buzzer apagado")
    elif opcion == "5":                     # probar boton
        print("Esperando pulsacion del boton (Ctrl+C para cancelar)...")
        antes = control.pulsaciones
        try:
            while control.pulsaciones == antes:
                control.actualizar(_ahora(), True)
                time.sleep_ms(20)
            print("Boton detectado correctamente")
        except KeyboardInterrupt:
            print("Cancelado")
    elif opcion == "7":                     # calibrar
        peso = float(input("Peso conocido colocado en la celda, en gramos: "))
        control.calibrar(peso, _ahora())
        _esperar_captura(control)
    elif opcion == "8":                     # armar
        control.armar(_pedir_duracion(), _ahora())
        if _esperar_captura(control)["ok"]:
            _seguir_monitoreo(control)
    elif opcion == "9":                     # estado
        print(control.estado(ahora))
    elif opcion == "10":                    # detener
        print(control.detener(ahora))
    elif opcion == "11":                    # rearmar
        control.rearmar(_pedir_duracion(), _ahora())
        if _esperar_captura(control)["ok"]:
            _seguir_monitoreo(control)
    else:
        print("Opcion no valida")


def menu():
    cfg = control_colchon.copiar_config(
        config, PIN_HX711_DT=13, PIN_HX711_SCK=12,
        PIN_BUZZER=18, PIN_BOTON=19, COLCHON_REQUIERE_WIFI=False,
    )
    print("\n==============================")
    print(" PRUEBA DEL COLCHON (sin WiFi)")
    print("==============================")
    print("PRUEBA CONTROLADA: solo colchon, sin WiFi.")
    control = control_colchon.iniciar(cfg)
    print("\nPRUEBAS DISPONIBLES:")
    print("1 - Leer peso")
    print("2 - Realizar tara")
    print("3 - Encender buzzer")
    print("4 - Apagar buzzer")
    print("5 - Probar boton")
    print("6 - Salir")
    print("7 - Calibrar con pesa conocida")
    print("8 - Armar monitoreo")
    print("9 - Estado")
    print("10 - Detener")
    print("11 - Rearmar")
    try:
        while True:
            opcion = input("\nSeleccione una prueba: ").strip()
            if opcion == "6":
                print("Finalizando pruebas...")
                break
            try:
                _ejecutar(control, opcion)
            except (ValueError, OSError) as error:
                print("Error:", error)
    finally:
        control.apagar()


if __name__ == "__main__":
    menu()
