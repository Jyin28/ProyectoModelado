"""main.py - Programa principal de la Pico 2 W (version esqueleto).

Que hace:
  1. Se conecta al WiFi.
  2. Cada 10 s lee temperatura y humedad y las muestra en consola.
  3. Avisa por consola cuando el PIR detecta movimiento.
  4. Cada 5 s comprueba que el WiFi siga y reconecta si se cayo.
  5. El LED interno parpadea para indicar el estado.

Todavia NO envia nada a Internet ni usa el colchon: eso viene en los
siguientes avances. Para detenerlo en Thonny: boton Stop (Ctrl+C).
"""
import time
import config
import indicador
import sensores
import wifi


def iniciar():
    """Pasos que se hacen una sola vez al arrancar."""

    print("=== Cuna Inteligente IoT - esqueleto ===")
    print("Dispositivo:", config.DEVICE_ID)

    indicador.parpadear(3, 100)          # 3 parpadeos rapidos = arrancando

    if wifi.conectar():
        indicador.parpadear(1, 600)      # 1 parpadeo largo = WiFi listo
    else:
        indicador.parpadear(5, 100)      # 5 rapidos = sin WiFi (se reintenta luego)


def han_pasado(inicio_ms, segundos):
    """True si ya pasaron 'segundos' desde 'inicio_ms'."""
    return time.ticks_diff(time.ticks_ms(), inicio_ms) >= segundos * 1000


def ciclo_principal():
    """Bucle infinito: cada tarea corre cuando le toca su turno."""
    # Se restan los intervalos para que la primera lectura ocurra de inmediato

    ultima_lectura = time.ticks_add(time.ticks_ms(),
                                    -config.INTERVALO_AMBIENTE_S * 1000)
    ultima_revision_wifi = time.ticks_ms()
    habia_movimiento = False

    while True:
        # --- Tarea 1: temperatura y humedad ---
        if han_pasado(ultima_lectura, config.INTERVALO_AMBIENTE_S):

            ### Actualizar el tiempo de la ultima lectura antes de leer sensores
            ultima_lectura = time.ticks_ms()

            ### Leer sensores de ambiente
            datos = sensores.leer_ambiente()
            if datos is not None:

                ### Mostrar en consola y parpadear el LED
                temperatura, humedad = datos
                print("Ambiente: %.1f C, %.1f %% HR" % (temperatura, humedad))
                indicador.parpadear(1, 50)

        # --- Tarea 2: movimiento (solo avisa al empezar a detectar) ---
        hay = sensores.hay_movimiento()

        ### Solo avisar cuando empieza a detectar movimiento, no cada vuelta del bucle
        if hay and not habia_movimiento:
            print("Movimiento detectado")
        habia_movimiento = hay

        # --- Tarea 3: vigilar el WiFi ---
        if han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S):
            ultima_revision_wifi = time.ticks_ms()
            wifi.asegurar_conexion()

        time.sleep_ms(config.PAUSA_CICLO_MS)


def ejecutar():
    try:
        iniciar()
        ciclo_principal()
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        indicador.apagar()


ejecutar()
