
"""main.py (PICO 2 W) - Colchon y figuras LED.

  1. Conecta WiFi, sincroniza UTC mediante NTP y toma la tara.
  2. Controla los 6 LED.
  3. Lee el peso y procesa las alarmas localmente.
  4. Revisa boton y temporizadores.
  5. Ejecuta ordenes demo/web.
  6. Envia eventos relevantes a Supabase.
  7. Si se pierde la conexion, detiene el monitoreo.
"""

import sys
import time

for _carpeta in (
    "/colchon",
    "/figuras-led",
    "/common/communication",
    "/common/utilities"
):
    _ruta = "/pico" + _carpeta
    if _ruta not in sys.path:
        sys.path.append(_ruta)

import comandos
import config
import demo
import eventos
import figuras
import indicador
import monitoreo
import nube
import peso
import setup_colchon
import wifi


def iniciar():
    """Inicializacion del dispositivo."""
    print("=== Cuna Inteligente IoT - PICO ===")
    print("Dispositivo:", config.DEVICE_ID)

    if not nube.habilitada():
        print("ADVERTENCIA: nube desactivada.")
        print("Revisa INGESTA_URL y DEVICE_TOKEN.")

    indicador.parpadear(3, 100)

    if wifi.conectar():
        indicador.parpadear(1, 600)

        print("Sincronizando reloj UTC...")
        if eventos.sincronizar_hora():
            print("Hora UTC:", eventos.ahora_iso())
        else:
            print("ADVERTENCIA: NTP no disponible.")
            print("No se permitiran eventos ni monitoreo.")
    else:
        indicador.parpadear(5, 100)
        print("Sin WiFi: se intentara reconectar.")

    print("Tomando tara: la balanza debe estar vacia...")
    peso.tomar_tara()


def han_pasado(inicio_ms, segundos):
    """Comprueba si transcurrio el intervalo indicado."""
    return time.ticks_diff(
        time.ticks_ms(), inicio_ms
    ) >= segundos * 1000


def hay_conexion():
    """Comprueba WiFi, disponibilidad de nube y hora valida."""
    return (
        wifi.esta_conectado()
        and eventos.hora_valida()
        and nube.hay_conexion()
    )


def atender_ordenes():
    """Ejecuta ordenes solo cuando la hora esta sincronizada."""
    if not eventos.hora_valida():
        return

    ordenes = nube.leer_comandos()

    if config.MODO_DEMO:
        orden_demo = demo.siguiente()
        if orden_demo is not None:
            ordenes.append(orden_demo)

    for orden in ordenes:
        confirmacion = comandos.ejecutar(orden)
        print("Confirmacion:", confirmacion)


def ciclo_principal():
    """Bucle principal del colchon."""
    ahora = time.ticks_ms()

    ultimo_peso = ahora
    ultimo_intento_hx711 = ahora
    ultima_revision_wifi = ahora

    while True:

        # 1. Actualizar figuras LED.
        figuras.actualizar()

        # 2. Vigilar boton y temporizadores.
        monitoreo.vigilar()

        # 3. Si se pierde una condicion necesaria, detener monitoreo.
        if (
            config.EXIGIR_CONEXION
            and monitoreo.activo()
            and not hay_conexion()
        ):
            print("Conexion o hora no valida: deteniendo monitoreo.")
            monitoreo.detener("connection")

        # 4. Ejecutar ordenes.
        atender_ordenes()

        # 5. Lectura de peso.
        if not peso.tiene_tara():

            if han_pasado(
                ultimo_intento_hx711,
                config.REINTENTO_HX711_S
            ):
                ultimo_intento_hx711 = time.ticks_ms()
                peso.tomar_tara()

        elif time.ticks_diff(
            time.ticks_ms(), ultimo_peso
        ) >= peso.INTERVALO_MS:

            ultimo_peso = time.ticks_ms()

            gramos = peso.leer_peso()
            monitoreo.procesar_lectura(gramos)

            if gramos is not None:
                print(
                    "Peso: %.1f g [%s]"
                    % (gramos, monitoreo.estado())
                )

        # 6. Revisar WiFi y sincronizacion NTP.
        if han_pasado(
            ultima_revision_wifi,
            config.REVISAR_WIFI_CADA_S
        ):
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

        # 7. Enviar eventos unicamente con hora valida.
        if eventos.hora_valida():

            for evento in monitoreo.tomar_eventos():
                nube.encolar(evento)

            nube.enviar_pendientes()

        time.sleep_ms(config.PAUSA_CICLO_MS)


def ejecutar():
    try:
        iniciar()
        ciclo_principal()

    except KeyboardInterrupt:
        print("Detenido por el usuario")

    finally:
        setup_colchon.buzzer_off()
        figuras.todos(False)
        indicador.apagar()


ejecutar()
