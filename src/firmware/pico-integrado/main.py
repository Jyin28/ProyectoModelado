"""main.py - Programa principal de la Pico 2 W.

Que hace:
  1. Se conecta al WiFi.
  2. Cada 10 s lee temperatura y humedad, las muestra y las envia si esta configurado.
  3. Avisa por consola cuando el PIR detecta movimiento.
  4. Cada 5 s comprueba que el WiFi siga y reconecta si se cayo.
  5. El LED interno parpadea para indicar el estado.
  6. Mueve las secuencias de los 6 LED y, en modo demo, ejecuta comandos
     de ejemplo sobre la lampara y las figuras (ver demo.py).
  7. Si secrets.py configura la lampara remota, ejecuta sus ordenes (la demo
     se desactiva para no pisar el PWM).
  8. Si config.py los habilita, atiende el colchon y el audio local.

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
import audio
import comandos
import config
import control_colchon
import demo
import figuras
import indicador
import lampara_remota
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


def preparar_perifericos():
    """Crea colchon y audio SOLO si config.py los habilita. Un fallo no detiene el resto."""
    colchon = None
    reproductor = None
    if config.COLCHON_HABILITADO:
        try:
            colchon = control_colchon.iniciar()
            comandos.conectar_colchon(colchon)
            print("Colchon: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
            if not config.COLCHON_REQUIERE_WIFI:
                print("Colchon: PRUEBA CONTROLADA, no se exige WiFi para monitorear")
        except Exception as error:
            colchon = None
            print("Colchon: no se pudo iniciar (%s)" % type(error).__name__)
    if config.AUDIO_HABILITADO:
        try:
            reproductor = audio.iniciar()
            comandos.conectar_audio(reproductor)
            print("Audio: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
        except Exception as error:
            reproductor = None
            print("Audio: no se pudo iniciar (%s)" % type(error).__name__)
    return colchon, reproductor


def ciclo_principal(envio=None, remota=None, colchon=None, reproductor=None):
    """Bucle infinito: cada tarea corre cuando le toca su turno."""
    pausa_ms = config.PAUSA_CICLO_MS
    if colchon is not None:
        pausa_ms = min(pausa_ms, config.COLCHON_PAUSA_CICLO_MS)   # boton y muestreo mas agiles
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
            if envio is not None and config.MONITOREO_MOVIMIENTO_HABILITADO:
                envio.registrar_movimiento(time.ticks_ms())
        habia_movimiento = hay

        # --- Tarea 3: avanzar la secuencia de los LED (si hay una activa) ---
        figuras.actualizar()

        # --- Tarea 4: lampara remota (el actuador solo se toca en este hilo) ---
        if remota is not None:
            remota.actualizar()

        # --- Tarea 5: demo de comandos (se apaga con MODO_DEMO = False) ---
        # Con la lampara remota activa la demo se separa para no pisar el PWM.
        if config.MODO_DEMO and remota is None:
            demo.actualizar()

        # --- Tarea 5: colchon (boton, muestreo, alarma). Un fallo lo deshabilita
        # con el buzzer apagado y el resto sigue.
        if colchon is not None:
            try:
                conectado = envio.esta_conectado() if envio is not None else wifi.esta_conectado()
                colchon.actualizar(time.ticks_ms(), conectado)
            except Exception as error:
                print("Colchon: error (%s); se deshabilita" % type(error).__name__)
                try:
                    colchon.apagar()
                except Exception:
                    pass
                colchon = None

        # --- Tarea 6: audio (cierre al drenar y vigilancia). Un fallo no afecta al resto.
        if reproductor is not None:
            try:
                reproductor.actualizar(time.ticks_ms())
            except Exception as error:
                print("Audio: error (%s)" % type(error).__name__)
                try:
                    reproductor.detener()
                except Exception:
                    pass
                reproductor = None

        # Sin envio configurado, el ciclo principal conserva la revision del WiFi.
        # (La reconexion bloquea hasta 15 s: no se hace mientras suena la alarma.)
        en_alarma = colchon is not None and colchon.en_alarma()
        if (envio is None and not en_alarma
                and han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S)):
            ultima_revision_wifi = time.ticks_ms()
            wifi.asegurar_conexion()

        time.sleep_ms(pausa_ms)


def ejecutar():
    envio = None
    remota = None
    colchon = None
    reproductor = None
    try:
        iniciar()
        remota = lampara_remota.configurar(comandos.ejecutar)
        envio = ambiente.iniciar(remota)
        if envio is None:
            remota = None            # sin worker de red no hay lampara remota
        colchon, reproductor = preparar_perifericos()
        ciclo_principal(envio, remota, colchon, reproductor)
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        if envio is not None:
            envio.detener()
        if colchon is not None:
            colchon.apagar()
        if reproductor is not None:
            reproductor.detener()
        if remota is not None:
            remota.actualizar()      # deja la lampara apagada
        indicador.apagar()


ejecutar()
