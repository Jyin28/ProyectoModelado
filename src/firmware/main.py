"""main.py - Programa principal de la Pico 2 W.

Que hace:
  1. Se conecta al WiFi.
  2. Cada 10 s lee temperatura y humedad, las muestra y las envia si esta configurado.
  3. Avisa por consola cuando el PIR detecta movimiento.
  4. Cada 5 s comprueba que el WiFi siga y reconecta si se cayo.
  5. El LED interno parpadea para indicar el estado.
  6. Mueve las secuencias de los 6 LED y, en modo demo, ejecuta comandos
     de ejemplo sobre la lampara y las figuras (ver demo.py).

Para detenerlo en Thonny: boton Stop (Ctrl+C).
"""
import sys
import time

# Las carpetas del proyecto se agregan a la ruta de busqueda para poder
# escribir "import config", "import wifi", etc. sin paquetes.
# (figuras-led lleva guion, por eso no se puede importar como paquete.)
for _carpeta in ("/colchon", "/cuna", "/figuras-led", "/common/communication",
                 "/common/sensors", "/common/utilities"):
    if _carpeta not in sys.path:
        sys.path.append(_carpeta)

import ambiente
import config
import demo
import figuras
import indicador
import sensores
import wifi


def iniciar():
    """Pasos que se hacen una sola vez al arrancar."""
    print("=== Cuna Inteligente IoT ===")
    print("Dispositivo:", config.DEVICE_ID)

    indicador.parpadear(3, 100)          # 3 parpadeos rapidos = arrancando

    if wifi.conectar():
        indicador.parpadear(1, 600)      # 1 parpadeo largo = WiFi listo
    else:
        indicador.parpadear(5, 100)      # 5 rapidos = sin WiFi (se reintenta luego)


def han_pasado(inicio_ms, segundos):
    """True si ya pasaron 'segundos' desde 'inicio_ms'."""
    return time.ticks_diff(time.ticks_ms(), inicio_ms) >= segundos * 1000


def ciclo_principal(envio=None):
    """Bucle infinito: cada tarea corre cuando le toca su turno."""
    # Se restan los intervalos para que la primera lectura ocurra de inmediato
    ultima_lectura = time.ticks_add(time.ticks_ms(),
                                    -config.INTERVALO_AMBIENTE_S * 1000)
    ultima_revision_wifi = time.ticks_ms()
    habia_movimiento = False

    while True:
        # --- Tarea 1: temperatura y humedad ---
        if han_pasado(ultima_lectura, config.INTERVALO_AMBIENTE_S):
            ultima_lectura = time.ticks_ms()
            datos = sensores.leer_ambiente()
            if datos is not None:
                temperatura, humedad = datos
                print("Ambiente: %.1f C, %.1f %% HR" % (temperatura, humedad))
                if envio is not None:
                    envio.registrar(temperatura, humedad, ultima_lectura)
                indicador.parpadear(1, 50)

        # --- Tarea 2: movimiento (solo avisa al empezar a detectar) ---
        hay = sensores.hay_movimiento()
        if hay and not habia_movimiento:
            print("Movimiento detectado")
        habia_movimiento = hay

        # --- Tarea 3: avanzar la secuencia de los LED (si hay una activa) ---
        figuras.actualizar()

        # --- Tarea 4: demo de comandos (se apaga con MODO_DEMO = False) ---
        if config.MODO_DEMO:
            demo.actualizar()

        # Sin envio configurado, el ciclo principal conserva la revision del WiFi.
        if envio is None and han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S):
            ultima_revision_wifi = time.ticks_ms()
            wifi.asegurar_conexion()

        time.sleep_ms(config.PAUSA_CICLO_MS)


def ejecutar():
    envio = None
    try:
        iniciar()
        envio = ambiente.iniciar()
        ciclo_principal(envio)
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        if envio is not None:
            envio.detener()
        indicador.apagar()


ejecutar()
