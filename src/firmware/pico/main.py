"""main.py - Programa principal de la Pico 2 W.

Hay una sola Pico y se conecta a UN modulo por vez. config.MODULO dice a cual
("cuna", "colchon", "figuras", "habitacion", "alimentacion" o "juego") y solo se atiende lo de ese modulo (modulo.py).

Que hace:
  1. Valida config.MODULO y se conecta al WiFi.
  Modulo "cuna":
  2. Cada 2 s lee temperatura y humedad, las muestra y las envia si esta configurado.
  3. Avisa por consola cuando el PIR detecta movimiento.
  4. Si secrets.py configura la lampara remota, ejecuta sus ordenes (la demo
     se desactiva para no pisar el PWM). Si config.py lo habilita, atiende el audio.
     Con ORDENES_* en secrets.py tambien recibe ordenes de audio y de monitoreo
     de movimiento, y con VOZ_HABILITADA la voz del cuidador en vivo.
  Modulo "colchon" (colchon/peso.py, colchon/monitoreo.py, common/communication/nube.py):
  5. Sincroniza la hora UTC (NTP), toma la tara, lee el peso, procesa la alarma, vigila el
     boton, ejecuta las ordenes de la web y envia los eventos monitoring_* a Supabase.
     Si se pierde el WiFi o la hora, detiene el monitoreo (EXIGIR_CONEXION).
  Modulo "figuras":
  6. Mueve las secuencias de los 6 LED y ejecuta ordenes (ver demo.py en modo demo
     o las ordenes remotas si secrets.py define ORDENES_*).
  Modulo "habitacion":
  6b. Si config.py lo habilita, vigila la puerta y el PIR del cuarto y informa
     cada accion durante el monitoreo activo (sin alarma local).
  Modulo "alimentacion":
  6d. Si config.py lo habilita, pesa el biberon cuando la web lo ordena
     (feeding_weigh) e informa los gramos como evento, y mide la temperatura.
     No calienta, no enfria ni suministra alimento.
  Modulo "juego":
  6c. Si config.py lo habilita, corre el juego de cinco botones. Funciona solo
     en la Pico: no se conecta al WiFi, no abre hilo de red ni recibe ordenes.
  Los demas modulos:
  7. Cada 5 s comprueba que el WiFi siga y reconecta si se cayo.
  8. El LED interno parpadea para indicar el estado.

Para detenerlo en Thonny: boton Stop (Ctrl+C).
"""
import os
import sys
import time

# Los modulos se importan por nombre ("import config", "import wifi"...), asi que sus carpetas
# deben estar en sys.path. El firmware puede estar en la raiz de la Pico ("/"), bajo "/pico",
# aplanado (p. ej. "/utilities") o repartido: se agregan las carpetas esperadas (raiz primero)
# y despues cualquier otra hasta _PROFUNDIDAD niveles, sin importar como se llamen.
# (figuras-led lleva guion, por eso no se puede importar como paquete.)
_BASES = ("", "/pico")
_CARPETAS = ("colchon", "cuna", "habitacion", "alimentacion", "juego", "figuras-led",
             "common/communication", "common/sensors", "common/utilities")
_PROFUNDIDAD = 3
_IGNORAR = ("lib", "tests", "__pycache__", "System Volume Information")


def _es_carpeta(ruta):
    try:
        return bool(os.stat(ruta or "/")[0] & 0x4000)
    except OSError:
        return False


def _listar(ruta):
    try:
        return sorted(os.listdir(ruta or "/"))
    except OSError:
        return None


def _agregar_arbol(ruta, nivel, salida):
    """Agrega a 'salida' las subcarpetas de 'ruta' (y las de estas), hasta _PROFUNDIDAD niveles."""
    if nivel >= _PROFUNDIDAD:
        return
    for nombre in _listar(ruta) or ():
        if nombre in _IGNORAR or nombre.startswith("."):
            continue
        hijo = ruta + "/" + nombre
        if _es_carpeta(hijo):
            if hijo not in salida:
                salida.append(hijo)
            _agregar_arbol(hijo, nivel + 1, salida)


def _carpetas_del_firmware():
    """Carpetas donde buscar modulos: primero las esperadas, despues todas las demas."""
    encontradas = []
    for base in _BASES:
        candidatas = ([base] if base else []) + [base + "/" + carpeta for carpeta in _CARPETAS]
        for ruta in candidatas:
            if ruta not in encontradas and _es_carpeta(ruta):
                encontradas.append(ruta)
    _agregar_arbol("", 0, encontradas)
    return encontradas


def _avisar_importacion_fallida(error):
    """Dice que archivos ve la Pico y donde, para saber que falta o donde quedo cada uno."""
    print("ERROR de importacion:", error)
    print("sys.path:", sys.path)
    print("Archivos que ve la Pico (carpeta : .py/.der):")
    for ruta in ["/"] + _carpetas_del_firmware():
        utiles = [n for n in (_listar(ruta) or ()) if n.endswith((".py", ".mpy", ".der"))]
        print("  ", ruta, ":", utiles)
    print("Faltan archivos del firmware en la Pico: sube las carpetas (colchon, common, cuna,")
    print("figuras-led, alimentacion, habitacion, juego) con main.py y secrets.py.")


for _ruta in _carpetas_del_firmware():
    if _ruta not in sys.path:
        sys.path.append(_ruta)

# Solo lo que usan todos los modulos. Lo demas (ambiente, audio, voz, lampara_remota,
# ordenes_remotas, control_*) se importa cuando el modulo conectado lo necesita.
try:
    import comandos
    import config
    import demo
    import indicador
    import modulo
    import wifi
except ImportError as _error:
    _avisar_importacion_fallida(_error)
    raise

# sensores.py y figuras.py crean sus pines al importarse, asi que solo se
# importan si el modulo conectado los usa (ver preparar_modulo).
sensores = None
figuras = None
# Colchon (colchon/ y common/): setup_colchon crea los pines al importarse y nube.py lee
# secrets.py, asi que solo se importan con MODULO = "colchon" (ver preparar_modulo).
monitoreo = None
peso = None
setup_colchon = None
eventos = None
nube = None


def preparar_modulo():
    """Importa los modulos que tocan pines, solo los del modulo conectado."""
    global sensores, figuras, monitoreo, peso, setup_colchon, eventos, nube
    if modulo.usa("ambiente") or modulo.usa("movimiento"):
        import sensores as _sensores
        sensores = _sensores
    if modulo.usa("figuras"):
        import figuras as _figuras
        figuras = _figuras
    if modulo.usa("colchon"):
        import eventos as _eventos
        import monitoreo as _monitoreo
        import nube as _nube
        import peso as _peso
        import setup_colchon as _setup_colchon
        eventos, monitoreo, nube, peso, setup_colchon = (
            _eventos, _monitoreo, _nube, _peso, _setup_colchon)


def iniciar():
    """Pasos que se hacen una sola vez al arrancar."""
    print("=== Cuna Inteligente IoT ===")
    print("Dispositivo:", config.DEVICE_ID)
    print("Modulo conectado:", config.MODULO)
    print("Config cargado de:", getattr(config, "__file__", "?"))

    indicador.parpadear(3, 100)          # 3 parpadeos rapidos = arrancando

    if not modulo.requiere_red():
        print("Este modulo funciona sin WiFi")
    elif wifi.conectar():
        indicador.parpadear(1, 600)      # 1 parpadeo largo = WiFi listo
    else:
        indicador.parpadear(5, 100)      # 5 rapidos = sin WiFi (se reintenta luego)


def han_pasado(inicio_ms, segundos):
    """True si ya pasaron 'segundos' desde 'inicio_ms'."""
    return time.ticks_diff(time.ticks_ms(), inicio_ms) >= segundos * 1000


def preparar_perifericos():
    """Crea el audio SOLO si config.py lo habilita. Un fallo no detiene el resto."""
    reproductor = None
    if config.AUDIO_HABILITADO and modulo.usa("audio"):
        try:
            import audio
            reproductor = audio.iniciar()
            comandos.conectar_audio(reproductor)
            print("Audio: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
        except Exception as error:
            reproductor = None
            print("Audio: no se pudo iniciar (%s)" % type(error).__name__)
    return reproductor


def preparar_habitacion():
    """Crea la habitacion SOLO si config.py la habilita. Un fallo no detiene el resto."""
    if not (config.HABITACION_HABILITADO and modulo.usa("habitacion")):
        return None
    try:
        import control_habitacion
        control = control_habitacion.iniciar()
        comandos.conectar_habitacion(control)
        print("Habitacion: habilitada (SIN PROBAR EN HARDWARE; pines propuestos)")
        return control
    except Exception as error:
        print("Habitacion: no se pudo iniciar (%s)" % type(error).__name__)
        return None


def preparar_alimentacion():
    """Crea la alimentacion SOLO si config.py la habilita. Un fallo no detiene el resto."""
    if not (config.ALIMENTACION_HABILITADO and modulo.usa("alimentacion")):
        return None
    try:
        import control_alimentacion
        control = control_alimentacion.iniciar()
        comandos.conectar_alimentacion(control)
        print("Alimentacion: habilitada (SIN PROBAR EN HARDWARE; pines propuestos)")
        return control
    except Exception as error:
        print("Alimentacion: no se pudo iniciar (%s)" % type(error).__name__)
        return None


def preparar_juego():
    """Crea el juego SOLO si config.py lo habilita. Un fallo no detiene el programa."""
    if not (config.JUEGO_HABILITADO and modulo.usa("juego")):
        return None
    try:
        import control_juego
        control = control_juego.iniciar()
        print("Juego: habilitado (SIN PROBAR EN HARDWARE; pines propuestos)")
        return control
    except Exception as error:
        print("Juego: no se pudo iniciar (%s)" % type(error).__name__)
        return None


def ciclo_juego(juego):
    """Bucle del juego: sin red, solo botones, LED y buzzer. Un fallo apaga el juego."""
    while True:
        try:
            juego.actualizar(time.ticks_ms())
        except Exception as error:
            print("Juego: error (%s)" % type(error).__name__)
            juego.apagar()
            return
        time.sleep_ms(config.JUEGO_PAUSA_CICLO_MS)


def preparar_voz(reproductor):
    """Crea la voz solo si config.py la habilita y hay audio. Un fallo no detiene el resto."""
    if not (config.VOZ_HABILITADA and reproductor is not None and modulo.usa("audio")):
        return None
    try:
        import voz
        sesion = voz.iniciar(config, reproductor)
        comandos.conectar_voz(sesion)
        print("Voz: habilitada (SIN PROBAR EN HARDWARE; comparte los pines del audio)")
        return sesion
    except Exception as error:
        print("Voz: no se pudo iniciar (%s)" % type(error).__name__)
        return None


def ciclo_principal(envio=None, remota=None, reproductor=None,
                    sesion_voz=None, movimiento_remoto=False, habitacion=None, alimentacion=None):
    """Bucle infinito: cada tarea corre cuando le toca su turno.

    movimiento_remoto: con ordenes remotas configuradas, el aviso de movimiento
    solo sale si una orden confirmada activo el monitoreo (arranca apagado).
    """
    pausa_ms = config.PAUSA_CICLO_MS
    if habitacion is not None:
        pausa_ms = min(pausa_ms, config.HABITACION_PAUSA_CICLO_MS)   # antirrebote de los sensores
    if alimentacion is not None:
        pausa_ms = min(pausa_ms, config.ALIMENTACION_PAUSA_CICLO_MS)   # lectura agil de la balanza
    if modulo.usa("figuras"):
        pausa_ms = min(pausa_ms, config.FIGURAS_PAUSA_CICLO_MS)   # rampas de brillo suaves
    # Se restan los intervalos para que la primera lectura ocurra de inmediato
    ultima_lectura = time.ticks_add(time.ticks_ms(),
                                    -config.INTERVALO_AMBIENTE_S * 1000)
    ultima_revision_wifi = time.ticks_ms()
    habia_movimiento = False
    hay_ambiente = modulo.usa("ambiente")
    hay_movimiento = modulo.usa("movimiento")
    hay_figuras = modulo.usa("figuras")
    estado_voz = "inactiva"      # para avisar por serial solo cuando cambia (prueba de banco)

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

        # --- Tarea 5c: alimentacion (pesajes y temperatura). Un fallo la deshabilita y el resto sigue.
        if alimentacion is not None:
            try:
                alimentacion.actualizar(time.ticks_ms())
                for evento in alimentacion.sacar_eventos():
                    print("Alimentacion: %s" % evento["tipo"])
                    if envio is not None:
                        envio.registrar_evento_alimentacion(
                            evento["tipo"], evento["datos"], evento["ms"])
            except Exception as error:
                print("Alimentacion: error (%s); se deshabilita" % type(error).__name__)
                try:
                    alimentacion.apagar()
                except Exception:
                    pass
                alimentacion = None

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
            nuevo_estado = sesion_voz.actualizar(time.ticks_ms())
            if nuevo_estado != estado_voz:
                estado_voz = nuevo_estado
                if estado_voz == "activa":
                    print("Voz: sesion iniciada")
                elif estado_voz == "error":
                    print("Voz: error (%s)" % sesion_voz.estado()["error"])
                else:
                    print("Voz: sesion cerrada")

        # Sin envio configurado, el ciclo principal conserva la revision del WiFi.
        if (envio is None
                and han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S)):
            ultima_revision_wifi = time.ticks_ms()
            wifi.asegurar_conexion()

        time.sleep_ms(min(pausa_ms, 20) if sesion_voz is not None and sesion_voz.activa() else pausa_ms)


def iniciar_colchon():
    """Arranque del modulo colchon: aviso de nube, hora UTC (NTP) y tara."""
    if not nube.habilitada():
        print("ADVERTENCIA: nube desactivada.")
        print("Revisa INGESTA_URL y DEVICE_TOKEN en secrets.py.")

    if wifi.esta_conectado():
        print("Sincronizando reloj UTC...")
        if eventos.sincronizar_hora():
            print("Hora UTC:", eventos.ahora_iso())
        else:
            print("ADVERTENCIA: NTP no disponible.")
            print("No se permitiran eventos ni monitoreo.")
    else:
        print("Sin WiFi: se intentara reconectar.")

    print("Tomando tara: la balanza debe estar vacia...")
    peso.tomar_tara()

    if eventos.hora_valida():
        monitoreo.notificar_inactivo("boot")
        for ev in monitoreo.tomar_eventos():
            nube.encolar(ev)
        nube.enviar_pendientes()


def hay_conexion_colchon():
    """Comprueba WiFi, disponibilidad de nube y hora valida."""
    return wifi.esta_conectado() and eventos.hora_valida() and nube.hay_conexion()


def atender_ordenes_colchon():
    """Ejecuta las ordenes de la web (tomar_ordenes_colchon) solo con la hora sincronizada."""
    if not eventos.hora_valida():
        return

    for orden in nube.leer_comandos():
        confirmacion = comandos.ejecutar(orden)
        print("Confirmacion:", confirmacion)
        if not str(orden.get("command_id", "")).startswith("prueba-"):
            nube.confirmar_orden(confirmacion)


def ciclo_colchon():
    """Bucle del modulo colchon: peso, monitoreo, alarma, boton, ordenes y envio de eventos."""
    ahora = time.ticks_ms()
    ultimo_peso = ahora
    ultimo_intento_hx711 = ahora
    ultima_revision_wifi = ahora
    ultima_revision_ordenes = ahora
    ultimo_latido = ahora
    timeout_normal = config.HTTP_TIMEOUT_S

    while True:
        # 1. Vigilar boton y temporizadores.
        monitoreo.vigilar()

        # Con la alarma sonando las llamadas de red esperan poco (HTTP_TIMEOUT_ALARMA_S): el
        # boton fisico y "detener" no deben quedar bloqueados varios segundos por un timeout.
        config.HTTP_TIMEOUT_S = (config.HTTP_TIMEOUT_ALARMA_S if monitoreo.estado() == monitoreo.ALARMA
                                 else timeout_normal)

        # 2. Si se pierde una condicion necesaria, detener el monitoreo.
        if (config.EXIGIR_CONEXION and monitoreo.activo()
                and not hay_conexion_colchon()):
            print("Conexion o hora no valida: deteniendo monitoreo.")
            monitoreo.detener("connection")

        # 3. Ordenes de la web (cada 3 s; cada 2 s con la alarma sonando, para que "detener" llegue pronto).
        intervalo_ordenes = 2 if monitoreo.estado() == monitoreo.ALARMA else 3
        if han_pasado(ultima_revision_ordenes, intervalo_ordenes):
            ultima_revision_ordenes = time.ticks_ms()
            atender_ordenes_colchon()
            monitoreo.vigilar()           # el boton se atiende en cuanto vuelve la llamada de red

        # 4. Latido de presencia (cada 20 s) SOLO mientras monitorea; en alarma no se envia (ver
        #    monitoreo.emitir_latido). Los 20 s cuentan desde que empieza el monitoreo.
        if monitoreo.estado() != monitoreo.MONITOREANDO:
            ultimo_latido = time.ticks_ms()
        elif han_pasado(ultimo_latido, 20):
            ultimo_latido = time.ticks_ms()
            if eventos.hora_valida():
                monitoreo.emitir_latido()

        # 5. Lectura de peso.
        if not peso.tiene_tara():
            if han_pasado(ultimo_intento_hx711, config.REINTENTO_HX711_S):
                ultimo_intento_hx711 = time.ticks_ms()
                peso.tomar_tara()
        elif time.ticks_diff(time.ticks_ms(), ultimo_peso) >= peso.INTERVALO_MS:
            ultimo_peso = time.ticks_ms()
            gramos = peso.leer_peso()
            monitoreo.procesar_lectura(gramos)
            if gramos is not None:
                print("Peso: %.1f g [%s]" % (gramos, monitoreo.estado()))

        # 6. Revisar WiFi y sincronizacion NTP.
        if han_pasado(ultima_revision_wifi, config.REVISAR_WIFI_CADA_S):
            ultima_revision_wifi = time.ticks_ms()
            conectado = wifi.asegurar_conexion()
            if conectado and not eventos.hora_valida():
                print("WiFi disponible. Sincronizando UTC...")
                if eventos.sincronizar_hora():
                    print("Hora UTC:", eventos.ahora_iso())
                else:
                    print("NTP fallo. Se volvera a intentar.")
            elif not conectado and monitoreo.activo():
                monitoreo.detener("connection")

        # 7. Enviar eventos unicamente con hora valida. Antes se atiende el boton, para que la
        #    parada de la alarma salga en este mismo envio y no en el siguiente.
        monitoreo.vigilar()
        if eventos.hora_valida():
            for evento in monitoreo.tomar_eventos():
                nube.encolar(evento)
            nube.enviar_pendientes()
            monitoreo.vigilar()

        time.sleep_ms(config.PAUSA_CICLO_MS)


def ejecutar():
    envio = None
    remota = None
    habitacion = None
    alimentacion = None
    juego = None
    reproductor = None
    sesion_voz = None
    try:
        modulo.validar()
    except ValueError as error:
        # Con un modulo desconocido no se inicializa ningun periferico.
        print("Modulo invalido (%s). Usa 'cuna', 'colchon', 'figuras', 'habitacion', 'alimentacion' o 'juego' en config.py." % error)
        return
    try:
        preparar_modulo()
        iniciar()
        if modulo.usa("juego"):
            # Sin red: no hay hilo de WiFi ni ordenes remotas en este modulo.
            juego = preparar_juego()
            if juego is not None:
                ciclo_juego(juego)
            return
        if modulo.usa("colchon"):
            # El colchon no usa el worker de red de ambiente.py: nube.py envia por HTTPS.
            iniciar_colchon()
            ciclo_colchon()
            return
        import ambiente
        import lampara_remota
        import ordenes_remotas
        reproductor = preparar_perifericos()
        habitacion = preparar_habitacion()
        alimentacion = preparar_alimentacion()
        sesion_voz = preparar_voz(reproductor)
        lampara = (lampara_remota.configurar(comandos.ejecutar)
                   if modulo.usa("lampara") else None)
        ordenes = ordenes_remotas.configurar(comandos.ejecutar, voz=sesion_voz,
                                              estado_para_nube=comandos.estado_para_nube)
        if lampara is not None or ordenes is not None:
            remota = ordenes_remotas.Grupo([lampara, ordenes])
        if (modulo.usa("ambiente") or modulo.usa("habitacion")
                or modulo.usa("alimentacion") or remota is not None):
            envio = ambiente.iniciar(remota)
            if envio is None:
                remota = None        # sin worker de red no hay ordenes remotas
        ciclo_principal(envio, remota, reproductor, sesion_voz,
                        movimiento_remoto=ordenes is not None, habitacion=habitacion,
                        alimentacion=alimentacion)
    except ImportError as error:
        _avisar_importacion_fallida(error)
        raise
    except KeyboardInterrupt:
        print("Detenido por el usuario")
    finally:
        if envio is not None:
            envio.detener()
        if setup_colchon is not None:
            setup_colchon.buzzer_off()   # el buzzer nunca queda sonando
        if habitacion is not None:
            habitacion.apagar()
        if alimentacion is not None:
            alimentacion.apagar()
        if juego is not None:
            juego.apagar()
        if reproductor is not None:
            reproductor.detener()
        if sesion_voz is not None:
            sesion_voz.finalizar()
            sesion_voz.actualizar(time.ticks_ms())
        if remota is not None:
            remota.actualizar()      # deja la lampara apagada
        if figuras is not None:
            figuras.apagar()         # los LED no quedan encendidos con el programa detenido
        indicador.apagar()


ejecutar()
