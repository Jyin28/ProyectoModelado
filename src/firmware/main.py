"""main.py - Programa principal de la Pico 2 W.

Hay una sola Pico y se conecta a UN modulo por vez. config.MODULO dice a cual
("cuna", "colchon", "figuras" o "habitacion") y solo se atiende lo de ese modulo (modulo.py).

Que hace:
  1. Valida config.MODULO y se conecta al WiFi.
  Modulo "cuna":
  2. Cada 10 s lee temperatura y humedad, las muestra y las envia si esta configurado.
  3. Avisa por consola cuando el PIR detecta movimiento.
  4. Si secrets.py configura la lampara remota, ejecuta sus ordenes (la demo
     se desactiva para no pisar el PWM). Si config.py lo habilita, atiende el audio.
     Con ORDENES_* en secrets.py tambien recibe ordenes de audio y de monitoreo
     de movimiento, y con VOZ_HABILITADA la voz del cuidador en vivo.
  Modulo "colchon":
  5. Si config.py lo habilita, atiende el colchon (boton, peso, alarma).
  Modulo "figuras":
  6. Mueve las secuencias de los 6 LED y ejecuta ordenes (ver demo.py en modo demo
     o las ordenes remotas si secrets.py define ORDENES_*).
  Modulo "habitacion":
  6b. Si config.py lo habilita, vigila la puerta y el PIR del cuarto y informa
     cada accion durante el monitoreo activo (sin alarma local).
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
for _carpeta in ("/colchon", "/cuna", "/habitacion", "/figuras-led", "/common/communication",
                 "/common/sensors", "/common/utilities"):
    if _carpeta not in sys.path:
        sys.path.append(_carpeta)

import ambiente
import audio
import comandos
import config
import control_colchon
import control_habitacion
import demo
import indicador
import lampara_remota
import modulo
import ordenes_remotas
import voz
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
    """Crea colchon y audio SOLO si config.py los habilita. Un fallo no detiene el resto."""
    colchon = None
    reproductor = None
    if config.COLCHON_HABILITADO and modulo.usa("colchon"):
        try:
            colchon = control_colchon.iniciar()
            comandos.conectar_colchon(colchon)
            print("Colchon: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
            if not config.COLCHON_REQUIERE_WIFI:
                print("Colchon: PRUEBA CONTROLADA, no se exige WiFi para monitorear")
        except Exception as error:
            colchon = None
            print("Colchon: no se pudo iniciar (%s)" % type(error).__name__)
    if config.AUDIO_HABILITADO and modulo.usa("audio"):
        try:
            reproductor = audio.iniciar()
            comandos.conectar_audio(reproductor)
            print("Audio: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
        except Exception as error:
            reproductor = None
            print("Audio: no se pudo iniciar (%s)" % type(error).__name__)
    return colchon, reproductor


def preparar_habitacion():
    """Crea la habitacion SOLO si config.py la habilita. Un fallo no detiene el resto."""
    if not (config.HABITACION_HABILITADO and modulo.usa("habitacion")):
        return None
    try:
        control = control_habitacion.iniciar()
        comandos.conectar_habitacion(control)
        print("Habitacion: habilitada (SIN PROBAR EN HARDWARE; pines propuestos)")
        return control
    except Exception as error:
        print("Habitacion: no se pudo iniciar (%s)" % type(error).__name__)
        return None


def preparar_voz(reproductor):
    """Crea la voz solo si config.py la habilita y hay audio. Un fallo no detiene el resto."""
    if not (config.VOZ_HABILITADA and reproductor is not None and modulo.usa("audio")):
        return None
    try:
        sesion = voz.iniciar(config, reproductor)
        comandos.conectar_voz(sesion)
        print("Voz: habilitada (SIN PROBAR EN HARDWARE; comparte los pines del audio)")
        return sesion
    except Exception as error:
        print("Voz: no se pudo iniciar (%s)" % type(error).__name__)
        return None


def ciclo_principal(envio=None, remota=None, colchon=None, reproductor=None,
                    sesion_voz=None, movimiento_remoto=False, habitacion=None):
    """Bucle infinito: cada tarea corre cuando le toca su turno.

    movimiento_remoto: con ordenes remotas configuradas, el aviso de movimiento
    solo sale si una orden confirmada activo el monitoreo (arranca apagado).
    """
    pausa_ms = config.PAUSA_CICLO_MS
    if colchon is not None:
        pausa_ms = min(pausa_ms, config.COLCHON_PAUSA_CICLO_MS)   # boton y muestreo mas agiles
    if habitacion is not None:
        pausa_ms = min(pausa_ms, config.HABITACION_PAUSA_CICLO_MS)   # antirrebote de los sensores
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
                if (envio is not None and config.MONITOREO_MOVIMIENTO_HABILITADO
                        and (not movimiento_remoto or comandos.monitoreo_movimiento())):
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

        # --- Tarea 5: colchon (boton, muestreo, alarma). Un fallo lo deshabilita
        # con el buzzer apagado y el resto sigue.
        if colchon is not None:
            try:
                conectado = envio.esta_conectado() if envio is not None else wifi.esta_conectado()
                colchon.actualizar(time.ticks_ms(), conectado)
                for evento in colchon.sacar_eventos():
                    if envio is not None:
                        envio.registrar_evento_colchon(
                            evento["tipo"], evento["datos"], evento["ms"])
            except Exception as error:
                print("Colchon: error (%s); se deshabilita" % type(error).__name__)
                try:
                    colchon.apagar()
                except Exception:
                    pass
                colchon = None

        # --- Tarea 5b: habitacion (puerta y PIR). Un fallo la deshabilita y el resto sigue.
        if habitacion is not None:
            try:
                habitacion.actualizar(time.ticks_ms())
                for evento in habitacion.sacar_eventos():
                    print("Habitacion: %s" % evento["tipo"])
                    if envio is not None:
                        envio.registrar_evento_habitacion(
                            evento["tipo"], evento["datos"], evento["ms"])
            except Exception as error:
                print("Habitacion: error (%s); se deshabilita" % type(error).__name__)
                try:
                    habitacion.apagar()
                except Exception:
                    pass
                habitacion = None

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

        # --- Tarea 7: voz en vivo (abre, escribe y cierra la salida). Un fallo no afecta al resto.
        if sesion_voz is not None:
            sesion_voz.actualizar(time.ticks_ms())

        # Sin envio configurado, el ciclo principal conserva la revision del WiFi.
        # (La reconexion bloquea hasta 15 s: no se hace mientras suena la alarma.)
        en_alarma = colchon is not None and colchon.en_alarma()
        if (envio is None and not en_alarma
                and han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S)):
            ultima_revision_wifi = time.ticks_ms()
            wifi.asegurar_conexion()

        time.sleep_ms(min(pausa_ms, 20) if sesion_voz is not None and sesion_voz.activa() else pausa_ms)


def ejecutar():
    envio = None
    remota = None
    colchon = None
    habitacion = None
    reproductor = None
    sesion_voz = None
    try:
        modulo.validar()
    except ValueError as error:
        # Con un modulo desconocido no se inicializa ningun periferico.
        print("Modulo invalido (%s). Usa 'cuna', 'colchon', 'figuras' o 'habitacion' en config.py." % error)
        return
    try:
        preparar_modulo()
        iniciar()
        colchon, reproductor = preparar_perifericos()
        habitacion = preparar_habitacion()
        sesion_voz = preparar_voz(reproductor)
        lampara = (lampara_remota.configurar(comandos.ejecutar)
                   if modulo.usa("lampara") else None)
        ordenes = ordenes_remotas.configurar(comandos.ejecutar, voz=sesion_voz)
        if lampara is not None or ordenes is not None:
            remota = ordenes_remotas.Grupo([lampara, ordenes])
        if (modulo.usa("ambiente") or modulo.usa("colchon") or modulo.usa("habitacion")
                or remota is not None):
            envio = ambiente.iniciar(remota)
            if envio is None:
                remota = None        # sin worker de red no hay ordenes remotas
        ciclo_principal(envio, remota, colchon, reproductor, sesion_voz,
                        movimiento_remoto=ordenes is not None, habitacion=habitacion)
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        if envio is not None:
            envio.detener()
        if colchon is not None:
            colchon.apagar()
        if habitacion is not None:
            habitacion.apagar()
        if reproductor is not None:
            reproductor.detener()
        if sesion_voz is not None:
            sesion_voz.finalizar()
            sesion_voz.actualizar(time.ticks_ms())
        if remota is not None:
            remota.actualizar()      # deja la lampara apagada
        indicador.apagar()


ejecutar()
