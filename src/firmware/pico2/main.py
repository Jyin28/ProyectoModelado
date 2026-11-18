"""main.py - Programa principal de la Pico 2 W.

Hay una sola Pico y se conecta a UN modulo por vez. config.MODULO dice a cual
("cuna", "colchon" o "figuras") y solo se atiende lo de ese modulo (modulo.py).

Que hace:
  1. Valida config.MODULO y se conecta al WiFi.
  Modulo "cuna":
  2. Cada 10 s lee temperatura y humedad, las muestra y las envia si esta configurado.
  3. Avisa por consola cuando el PIR detecta movimiento.
  4. Si secrets.py configura la lampara remota, ejecuta sus ordenes (la demo
     se desactiva para no pisar el PWM). Si config.py lo habilita, atiende el audio.
  Modulo "colchon":
  5. Si config.py lo habilita, atiende el colchon (boton, peso, alarma).
  Modulo "figuras":
  6. Mueve las secuencias de los 6 LED y ejecuta ordenes (ver demo.py en modo demo).
  Todos:
  7. Cada 5 s comprueba que el WiFi siga y reconecta si se cayo.
  8. El LED interno parpadea para indicar el estado.

Para detenerlo en Thonny: boton Stop (Ctrl+C).
"""
import sys
import time

# Las carpetas del proyecto se agregan a la ruta de busqueda para poder
# escribir "import config", "import wifi", etc. sin paquetes.
# (figuras-led lleva guion, por eso no se puede importar como paquete.)
for _carpeta in ("/cuna", "/figuras-led", "/common/communication",
                 "/common/sensors", "/common/utilities"):
    
    _ruta = "/pico2" + _carpeta
    if _carpeta not in sys.path:
        sys.path.append(_ruta)

import ambiente
import audio
import comandos
import config
import demo
import indicador
import lampara_remota
import modulo
import wifi

# sensores.py y figuras.py crean sus pines al importarse, asi que solo se
# importan si el modulo conectado los usa (ver preparar_modulo).
sensores = None
figuras = None


def preparar_modulo():
    """Importa los modulos que tocan pines, solo los del modulo conectado."""
    global sensores, figuras
    if modulo.usa("ambiente") or modulo.usa("movimiento"):
        import sensores as _sensores
        sensores = _sensores
    if modulo.usa("figuras"):
        import figuras as _figuras
        figuras = _figuras


def iniciar():
    """Pasos que se hacen una sola vez al arrancar."""
    print("=== Cuna Inteligente IoT ===")
    print("Dispositivo:", config.DEVICE_ID)
    print("Modulo conectado:", config.MODULO)

    indicador.parpadear(3, 100)          # 3 parpadeos rapidos = arrancando

    if wifi.conectar():
        indicador.parpadear(1, 600)      # 1 parpadeo largo = WiFi listo
    else:
        indicador.parpadear(5, 100)      # 5 rapidos = sin WiFi (se reintenta luego)


def han_pasado(inicio_ms, segundos):
    """True si ya pasaron 'segundos' desde 'inicio_ms'."""
    return time.ticks_diff(time.ticks_ms(), inicio_ms) >= segundos * 1000


def preparar_perifericos():
    """Crea audio SOLO si config.py lo habilita. Un fallo no detiene el resto."""
    reproductor = None
    if config.AUDIO_HABILITADO and modulo.usa("audio"):
        try:
            reproductor = audio.iniciar()
            comandos.conectar_audio(reproductor)
            print("Audio: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
        except Exception as error:
            reproductor = None
            print("Audio: no se pudo iniciar (%s)" % type(error).__name__)
    return reproductor


def ciclo_principal(envio=None, remota=None, reproductor=None):
    """Bucle infinito: cada tarea corre cuando le toca su turno."""
    pausa_ms = config.PAUSA_CICLO_MS
    # Se restan los intervalos para que la primera lectura ocurra de inmediato
    ultima_lectura = time.ticks_add(time.ticks_ms(),
                                    -config.INTERVALO_AMBIENTE_S * 1000)
    ultima_revision_wifi = time.ticks_ms()
    habia_movimiento = False
    hay_ambiente = modulo.usa("ambiente")
    hay_movimiento = modulo.usa("movimiento")
    hay_figuras = modulo.usa("figuras")

    while True:
        # --- Tarea 1: temperatura y humedad (solo modulo cuna) ---
        if hay_ambiente and han_pasado(ultima_lectura, config.INTERVALO_AMBIENTE_S):
            ultima_lectura = time.ticks_ms()
            datos = sensores.leer_ambiente()
            if datos is not None:
                temperatura, humedad = datos
                print("Ambiente: %.1f C, %.1f %% HR" % (temperatura, humedad))
                if envio is not None:
                    envio.registrar(temperatura, humedad, ultima_lectura)
                indicador.parpadear(1, 50)

        # --- Tarea 2: movimiento (solo modulo cuna; avisa al empezar a detectar) ---
        if hay_movimiento:
            hay = sensores.hay_movimiento()
            if hay and not habia_movimiento:
                print("Movimiento detectado")
                if envio is not None and config.MONITOREO_MOVIMIENTO_HABILITADO:
                    envio.registrar_movimiento(time.ticks_ms())
            habia_movimiento = hay

        # --- Tarea 3: avanzar la secuencia de los LED (solo modulo figuras) ---
        if hay_figuras:
            figuras.actualizar()

        # --- Tarea 4: lampara remota (el actuador solo se toca en este hilo) ---
        if remota is not None:
            remota.actualizar()

        # --- Tarea 5: demo de comandos (se apaga con MODO_DEMO = False) ---
        # Con la lampara remota activa la demo se separa para no pisar el PWM.
        if config.MODO_DEMO and remota is None:
            demo.actualizar()

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
        if (envio is None
                and han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S)):
            ultima_revision_wifi = time.ticks_ms()
            wifi.asegurar_conexion()

        time.sleep_ms(pausa_ms)


def ejecutar():
    envio = None
    remota = None
    reproductor = None
    try:
        modulo.validar()
    except ValueError as error:
        # Con un modulo desconocido no se inicializa ningun periferico.
        print("Modulo invalido (%s). Usa 'cuna' o 'figuras' en config.py." % error)
        return
    try:
        preparar_modulo()
        iniciar()
        if modulo.usa("ambiente"):
            remota = (lampara_remota.configurar(comandos.ejecutar)
                      if modulo.usa("lampara") else None)
            envio = ambiente.iniciar(remota)
            if envio is None:
                remota = None        # sin worker de red no hay lampara remota
        reproductor = preparar_perifericos()
        ciclo_principal(envio, remota, reproductor)
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        if envio is not None:
            envio.detener()
        if reproductor is not None:
            reproductor.detener()
        if remota is not None:
            remota.actualizar()      # deja la lampara apagada
        indicador.apagar()


ejecutar()
