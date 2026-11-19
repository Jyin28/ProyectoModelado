from machine import Pin, PWM, I2S
import dht
import uasyncio as asyncio
import struct


# ==================================================
# CONFIGURACION
# ==================================================

# Volumen entre 0.0 y 1.0
VOLUMEN = 0.3
ARCHIVO_AUDIO = "prueba.wav"

# Sensor AM2301
sensor = dht.DHT22(Pin(2))

# Sensor PIR HC-SR501: OUT conectado a GP3
pir = Pin(3, Pin.IN, Pin.PULL_DOWN)

# Seis LEDs de las figuritas
leds = [
    Pin(6, Pin.OUT),
    Pin(7, Pin.OUT),
    Pin(8, Pin.OUT),
    Pin(9, Pin.OUT),
    Pin(10, Pin.OUT),
    Pin(11, Pin.OUT)
]

# LED regulable
dimmer = PWM(Pin(13))
dimmer.freq(1000)
dimmer.duty_u16(0)

# Amplificador MAX98357A
audio = I2S(
    0,
    sck=Pin(18),
    ws=Pin(19),
    sd=Pin(20),
    mode=I2S.TX,
    bits=16,
    format=I2S.MONO,
    rate=16000,
    ibuf=20000
)


# ==================================================
# CONTROL DE VOLUMEN
# ==================================================

def ajustar_volumen(datos):
    cantidad = len(datos) // 2

    muestras = struct.unpack(
        "<" + "h" * cantidad,
        datos[:cantidad * 2]
    )

    ajustadas = []

    for muestra in muestras:
        nueva = int(muestra * VOLUMEN)

        # Mantener la muestra dentro del rango de 16 bits
        nueva = max(-32768, min(32767, nueva))
        ajustadas.append(nueva)

    return struct.pack(
        "<" + "h" * cantidad,
        *ajustadas
    )


# ==================================================
# REPRODUCCION WAV
# ==================================================

def leer_exactamente(archivo, cantidad):
    datos = archivo.read(cantidad)

    if len(datos) != cantidad:
        raise ValueError("Archivo WAV incompleto")

    return datos


def preparar_wav(archivo):
    encabezado = leer_exactamente(archivo, 12)

    if encabezado[0:4] != b"RIFF" or encabezado[8:12] != b"WAVE":
        raise ValueError("El archivo no es WAV valido")

    formato = None
    tamano_audio = None

    while True:
        identificador = archivo.read(4)

        if len(identificador) < 4:
            break

        tamano = struct.unpack(
            "<I",
            leer_exactamente(archivo, 4)
        )[0]

        if identificador == b"fmt ":
            if tamano < 16:
                raise ValueError("Formato WAV no valido")

            datos_fmt = leer_exactamente(archivo, 16)

            formato, canales, frecuencia, _, _, bits = struct.unpack(
                "<HHIIHH",
                datos_fmt
            )

            if tamano > 16:
                archivo.seek(tamano - 16, 1)

            if tamano % 2:
                archivo.seek(1, 1)

        elif identificador == b"data":
            tamano_audio = tamano
            break

        else:
            archivo.seek(tamano + (tamano % 2), 1)

    if formato != 1:
        raise ValueError("El audio debe ser PCM sin compresion")

    if canales != 1:
        raise ValueError("El audio debe ser MONO")

    if frecuencia != 16000:
        raise ValueError("La frecuencia debe ser 16000 Hz")

    if bits != 16:
        raise ValueError("El audio debe ser de 16 bits")

    if tamano_audio is None:
        raise ValueError("No se encontro el bloque de audio")

    return tamano_audio


async def reproducir_wav(nombre):
    try:
        print("Abriendo archivo:", nombre)

        with open(nombre, "rb") as archivo:
            restante = preparar_wav(archivo)

            print("Reproduciendo audio...")
            print("Volumen:", int(VOLUMEN * 100), "%")

            while restante > 0:
                cantidad = min(1024, restante)
                datos = archivo.read(cantidad)

                if not datos:
                    break

                # Contar los bytes leidos del archivo
                restante -= len(datos)
                datos = ajustar_volumen(datos)

                audio.write(datos)

                # Dar tiempo a las otras tareas
                await asyncio.sleep_ms(0)

        print("Reproduccion finalizada")

    except Exception as error:
        print("Error de audio:", error)


# ==================================================
# PATRONES DE LEDS
# ==================================================

def apagar_leds():
    for led in leds:
        led.off()


async def patrones_leds():
    while True:
        # 1. Encendido secuencial
        for led in leds:
            apagar_leds()
            led.on()
            await asyncio.sleep_ms(150)

        apagar_leds()

        # 2. Todos encendidos y apagados
        for led in leds:
            led.on()

        await asyncio.sleep_ms(500)

        apagar_leds()
        await asyncio.sleep_ms(500)

        # 3. Encendido alternado
        for _ in range(3):
            apagar_leds()

            for j in range(0, 6, 2):
                leds[j].on()

            await asyncio.sleep_ms(300)

            apagar_leds()

            for j in range(1, 6, 2):
                leds[j].on()

            await asyncio.sleep_ms(300)

        apagar_leds()

        # 4. Efecto de rebote
        for i in range(6):
            apagar_leds()
            leds[i].on()
            await asyncio.sleep_ms(120)

        for i in range(4, 0, -1):
            apagar_leds()
            leds[i].on()
            await asyncio.sleep_ms(120)

        apagar_leds()

        # 5. Encendido progresivo
        for led in leds:
            led.on()
            await asyncio.sleep_ms(200)

        await asyncio.sleep_ms(500)
        apagar_leds()


# ==================================================
# DIMMER
# ==================================================

async def controlar_dimmer():
    while True:
        # Aumentar brillo
        for brillo in range(0, 65536, 1000):
            dimmer.duty_u16(min(brillo, 65535))
            await asyncio.sleep_ms(20)

        # Disminuir brillo
        for brillo in range(65535, -1, -1000):
            dimmer.duty_u16(max(brillo, 0))
            await asyncio.sleep_ms(20)


# ==================================================
# SENSOR DE TEMPERATURA Y HUMEDAD
# ==================================================

async def leer_sensor():
    while True:
        try:
            sensor.measure()

            temperatura = sensor.temperature()
            humedad = sensor.humidity()

            print("----------------------")
            print("Temperatura:", temperatura, "°C")
            print("Humedad:", humedad, "%")
            print("----------------------")

        except Exception as error:
            print("Error del sensor:", error)

        await asyncio.sleep(15)


# ==================================================
# SENSOR PIR DE MOVIMIENTO
# ==================================================

async def leer_pir():
    print("PIR: esperando 60 segundos para estabilizarse...")
    await asyncio.sleep(60)

    print("PIR: lectura inicial de GP3 =", pir.value())
    print("PIR: esperando 2 segundos seguidos en reposo...")

    lecturas_en_cero = 0

    while lecturas_en_cero < 20:
        if pir.value() == 0:
            lecturas_en_cero += 1
        else:
            lecturas_en_cero = 0

        await asyncio.sleep_ms(100)

    print("PIR listo. Ahora pasa la mano frente al sensor.")
    estado_anterior = 0

    while True:
        estado = pir.value()

        if estado != estado_anterior:
            if estado == 1:
                print("PIR: movimiento detectado")
            else:
                print("PIR: salida en reposo")

            estado_anterior = estado

        await asyncio.sleep_ms(100)

# ==================================================
# PROGRAMA PRINCIPAL
# ==================================================

async def main():
    print("Iniciando sistema de la cuna...")

    asyncio.create_task(patrones_leds())
    asyncio.create_task(controlar_dimmer())
    asyncio.create_task(leer_sensor())
    asyncio.create_task(leer_pir())

    # Reproducir el audio una vez
    await asyncio.sleep(1)
    await reproducir_wav(ARCHIVO_AUDIO)

    # Mantener las otras tareas funcionando
    while True:
        await asyncio.sleep(1)


# ==================================================
# EJECUCION
# ==================================================

try:
    asyncio.run(main())

finally:
    apagar_leds()
    dimmer.duty_u16(0)
    audio.deinit()
    print("Sistema apagado")