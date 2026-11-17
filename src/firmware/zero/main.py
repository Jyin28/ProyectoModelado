"""main.py (ZERO 2 W) - Cuna.

Que hace:
  1. Cada 10 s lee temperatura y humedad y las manda a la nube.
  2. Avisa (evento "motion_detected") cuando el PIR empieza a detectar movimiento.
  3. Controla la lampara regulable y el audio pregrabado segun las ordenes.
  4. Ejecuta ordenes (demo, y mas adelante las de la web) y manda su
     confirmacion como evento "command_ack".
  5. Cada 5 s comprueba que haya Internet; si se cae, detiene el audio.
  6. Manda a la nube un "heartbeat" periodico.

El colchon y las figuras LED NO estan aqui: van en la Pico 2 W.

Ejecutar:   python3 main.py        (Ctrl+C para detener)
"""
import os
import sys
import time

# Las carpetas del proyecto se agregan a la ruta de busqueda para poder
# escribir "import config", "import audio", etc. sin paquetes.
_RAIZ = os.path.dirname(os.path.abspath(__file__))
for _carpeta in ("cuna", "common/communication", "common/utilities"):
    _ruta = os.path.join(_RAIZ, _carpeta)
    if _ruta not in sys.path:
        sys.path.append(_ruta)
if _RAIZ not in sys.path:
    sys.path.insert(0, _RAIZ)                 # para encontrar secretos.py

import audio
import comandos
import config
import demo
import eventos
import lampara
import movimiento
import nube
import red
import sensores


def iniciar():
    """Pasos que se hacen una sola vez al arrancar."""
    print("=== Cuna Inteligente IoT - ZERO (cuna) ===")
    print("Dispositivo:", config.DEVICE_ID)
    print("Audio disponible:", audio.catalogo() or "ninguno (pon .wav en audio/)")
    nube.iniciar()
    red.revisar()
    nube.encolar(eventos.crear("device_online", {"device": config.DEVICE_ID}))


def han_pasado(inicio, segundos):
    """True si ya pasaron 'segundos' desde 'inicio' (time.monotonic)."""
    return time.monotonic() - inicio >= segundos


def atender_ordenes():
    """Ejecuta las ordenes pendientes y encola sus confirmaciones."""
    ordenes = nube.leer_comandos()
    if config.MODO_DEMO:
        orden_demo = demo.siguiente()
        if orden_demo is not None:
            ordenes.append(orden_demo)
    for orden in ordenes:
        confirmacion = comandos.ejecutar(orden)
        print("Confirmacion:", confirmacion)
        nube.encolar(eventos.crear("command_ack", confirmacion))


def ciclo_principal():
    """Bucle infinito: cada tarea corre cuando le toca su turno."""
    ahora = time.monotonic()
    # Se restan los intervalos para que la primera lectura ocurra de inmediato
    ultima_lectura = ahora - config.INTERVALO_AMBIENTE_S
    ultima_revision_red = ahora
    ultimo_heartbeat = ahora
    habia_internet = True

    while True:
        # --- Tarea 1: temperatura y humedad ---
        if han_pasado(ultima_lectura, config.INTERVALO_AMBIENTE_S):
            ultima_lectura = time.monotonic()
            datos = sensores.leer_ambiente()
            if datos is not None:
                temperatura, humedad = datos
                print("Ambiente: %.1f C, %.1f %% HR" % (temperatura, humedad))
                nube.encolar(eventos.crear("ambient", {
                    "temperature_c": round(temperatura, 1),
                    "humidity_pct": round(humedad, 1)}))

        # --- Tarea 2: movimiento (solo avisa al empezar a detectar) ---
        if movimiento.actualizar():
            print("Movimiento detectado")
            nube.encolar(eventos.crear("motion_detected", {
                "alert": movimiento.alertas_activas()}))

        # --- Tarea 3: audio (detecta cuando termina) ---
        audio.actualizar()

        # --- Tarea 4: ordenes (demo / web) ---
        atender_ordenes()

        # --- Tarea 5: vigilar Internet ---
        if han_pasado(ultima_revision_red, config.REVISAR_RED_CADA_S):
            ultima_revision_red = time.monotonic()
            hay_internet = red.revisar() and nube.hay_conexion()
            if habia_internet and not hay_internet and config.DETENER_AUDIO_SIN_RED:
                if audio.reproduciendo():
                    print("Sin Internet: se detiene el audio")
                    audio.detener()
            habia_internet = hay_internet

        # --- Tarea 6: aviso periodico ---
        if han_pasado(ultimo_heartbeat, config.HEARTBEAT_S):
            ultimo_heartbeat = time.monotonic()
            nube.encolar(eventos.crear("heartbeat", comandos.estado()))

        time.sleep(config.PAUSA_CICLO_S)


def ejecutar():
    try:
        iniciar()
        ciclo_principal()
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        audio.detener()
        lampara.cerrar()
        sensores.cerrar()
        nube.detener()


if __name__ == "__main__":
    ejecutar()
