# src/firmware — Firmware único (Raspberry Pi Pico 2 W)

## Propósito

Firmware de una sola Raspberry Pi Pico 2 W, compartida entre tres
protoboards, que en el proyecto completo:

- Lee los sensores de cuna, colchón y figuras LED.
- Envía datos de ingesta al backend por HTTPS.
- Recibe comandos de control por Realtime/WSS (Supabase).
- Controla el LED blanco (MOSFET IRLZ44N) y los seis LED comunes
  (resistencias de 330 Ω, sin WS2812B ni conversor de nivel).

## Hardware previsto (Sprint 3)

- 1 × Raspberry Pi Pico 2 W, alimentada por USB de computadora, tierra común.
- Sensor ambiental AM2301 (no SHT31).
- Sensor de movimiento PIR HC-SR501.
- LED blanco regulado mediante MOSFET IRLZ44N.
- 6 × LED comunes con resistencia de 330 Ω cada uno.
- HX711 + celda de carga de barra de 5 kg.
- Buzzer activo con transistor NPN, resistencia de 1 kΩ y botón físico.
- MAX98357A + parlante de 8 Ω / 0,5 W.
- Sin condensadores externos adicionales.
- Sin almacenamiento local de lecturas durante desconexiones para reenvío
  posterior.
- Demostración mediante hotspot del teléfono.

## Estado

Escrito pero **sin probar en la placa**. Lo comprobado hasta ahora fue en un PC:
las 10 pruebas de `colchon/test_logica_colchon.py` y las 23 comprobaciones de
`prueba_simulada.py` (hardware simulado: comandos, calibracion, alarma, boton,
rearme y desconexion). Eso no demuestra nada sobre la electronica real.

Siguen pendientes de verificar en la placa (nada se da por aprobado hasta
documentar resultados reales):

- Viabilidad real de TLS (version negociada) y de Realtime/WSS en la Pico 2 W.
- Audio I2S solo y luego junto con WiFi.
- Revision electrica completa y resistencia independiente del LED blanco.
- Fijacion mecanica y calibracion de la celda con pesos conocidos.
- Modelos exactos de cada modulo (AM2301 vs AM2301B, HX711, MAX98357A, NPN, buzzer).
- Pines definitivos (ver tabla).

## Estructura

La estructura de carpetas es la original; las carpetas vacias (`alimentacion`,
`habitacion`, `juego`) quedan para el proyecto completo. `main.py` y `secrets.py`
van en la raiz de la Pico y agregan las carpetas a `sys.path` (los nombres con
guion, como `figuras-led`, no se pueden importar como paquete).

| Archivo | Contenido |
|---|---|
| `main.py` | Arranca todas las tareas asyncio |
| `secrets.example.py` | Plantilla de WiFi y claves (copiar a `secrets.py`, no subir a Git) |
| `colchon/setup_colchon.py` | **Base del colchon**: pines, HX711, buzzer, boton (existente, con 3 correcciones) |
| `colchon/prueba_colchon.py` | Menu de pruebas por consola (existente, 1 correccion) |
| `colchon/logica_colchon.py` | Estados, filtro y alarma; sin hardware |
| `colchon/control_colchon.py` | Une `setup_colchon` con la logica; tara, calibracion y tareas |
| `colchon/calibrar_colchon.py` | Calibra con un peso conocido y guarda `calibration.json` |
| `colchon/test_logica_colchon.py` | Pruebas de la logica (PC) |
| `cuna/ambiente_cuna.py` | Temperatura y humedad cada 10 s |
| `cuna/movimiento_cuna.py` | PIR |
| `cuna/lampara_cuna.py` | LED blanco por PWM + MOSFET |
| `cuna/audio_cuna.py` | WAV PCM 16 bits mono por I2S |
| `figuras-led/figuras_led.py` | Seis LED y secuencias |
| `common/sensors/` | `am2301.py`, `pir.py` |
| `common/communication/` | `red.py` (WiFi, NTP, HTTPS), `realtime.py` (WebSocket + Phoenix) |
| `common/utilities/` | `config.py` (pines y tiempos), `eventos.py` (cola a Ingesta), `comandos.py` |
| `prueba_simulada.py` | Prueba de integracion con hardware simulado (PC) |

## Pines (GPIO)

Cada pin esta en un solo lugar: los del colchon en `colchon/setup_colchon.py`,
el resto en `common/utilities/config.py`. GP23, GP24, GP25 y GP29 no salen al
cabezal de la Pico W y los usa el WiFi.

| Funcion | GPIO | Origen |
|---|---|---|
| HX711 DT / SCK | 17 / 16 | existente |
| Buzzer (NPN) | 14 | **provisional** (antes 24, invalido) |
| Boton | 15 | **provisional** (antes 25, invalido) |
| AM2301 | 2 | propuesto |
| PIR | 3 | propuesto |
| I2S BCLK / LRC / DIN | 10 / 11 / 12 | propuesto (LRC = BCLK + 1) |
| Lampara (MOSFET) | 13 | propuesto |
| Seis LED | 18, 19, 20, 21, 22, 26 | propuesto |

## Cambios en los archivos existentes del colchon

- `setup_colchon.py`: `BUTTON_PIN` 25 -> 15 y `BUZZER_PIN` 24 -> 14 (esos GPIO no son usables); `ALARM_TIME` 5 -> 60 (requisito por defecto).
- `prueba_colchon.py`: `import setup` -> `import setup_colchon as setup` (el archivo tiene ese nombre).
- `CALIBRATION_FACTOR = 420.0` sigue siendo provisional: el programa exige calibrar antes de capturar una referencia.

## Comandos (PROVISIONAL, a validar con Persona B)

Llegan por Realtime como `{"command_id", "command", "params"}` y cada uno se
confirma con un evento `command_ack`.

| command | params |
|---|---|
| `lamp_set` | `level` 0-100 |
| `led_set` / `led_all` / `led_stop` | `index`, `on` / `on` / - |
| `led_sequence` | `name` (chase, alternate, blink_all), `step_s` (minimo 2) |
| `audio_play` / `audio_stop` | `track` / - |
| `motion_enable` | `enabled` |
| `scale_tare` / `scale_calibrate` | - / `known_g` |
| `mattress_capture_ref` | - |
| `mattress_arm` | `duration_s`, `tolerance_pct`, `alarm_s` (los tres opcionales: usan los valores de `setup_colchon.py`) |
| `mattress_stop` / `get_status` | - |

Eventos hacia Ingesta: `ambient`, `motion`, `weight`, `mattress_armed`,
`mattress_alarm`, `mattress_stopped`, `command_ack`, `audio_finished`,
`sensor_error`, `heartbeat`.

## Pruebas en el PC (PowerShell, dentro de `firmware`)

    cd colchon; python -m unittest test_logica_colchon -v; cd ..
    python prueba_simulada.py

## Cargar en la Pico (PowerShell, dentro de `firmware`)

1. Instalar MicroPython para **Raspberry Pi Pico 2 W** (.uf2 desde micropython.org, con BOOTSEL).
2. `pip install mpremote` y `Copy-Item secrets.example.py secrets.py` (editar `secrets.py`).
3. Averiguar el puerto con `mpremote connect list` (ej. COM5) y copiar conservando carpetas:

```
$p = "COM5"
foreach ($d in "colchon","cuna","figuras-led","common","common/communication","common/sensors","common/utilities","audio") { mpremote connect $p fs mkdir $d }
mpremote connect $p fs cp main.py secrets.py :
mpremote connect $p fs cp colchon/setup_colchon.py colchon/logica_colchon.py colchon/control_colchon.py colchon/calibrar_colchon.py colchon/prueba_colchon.py :colchon/
mpremote connect $p fs cp cuna/ambiente_cuna.py cuna/movimiento_cuna.py cuna/lampara_cuna.py cuna/audio_cuna.py :cuna/
mpremote connect $p fs cp figuras-led/figuras_led.py :figuras-led/
mpremote connect $p fs cp common/sensors/am2301.py common/sensors/pir.py :common/sensors/
mpremote connect $p fs cp common/communication/red.py common/communication/realtime.py :common/communication/
mpremote connect $p fs cp common/utilities/config.py common/utilities/eventos.py common/utilities/comandos.py :common/utilities/
```

   Audio: WAV PCM 16 bits mono en `/audio` con los nombres de `AUDIO_CATALOG` en `config.py`.
4. Antes del programa completo, probar el colchon solo: en la Pico, con `colchon/` en la ruta, ejecutar `colchon/prueba_colchon.py` y luego `colchon/calibrar_colchon.py` (por ejemplo desde Thonny o `mpremote run`).
5. `main.py` arranca solo al encender la Pico. Para verlo en vivo: `mpremote connect COM5 run main.py` (Ctrl+C para salir).

Agregar a `.gitignore`: `firmware/secrets.py` y `firmware/calibration.json`.

## Orden de pruebas en la placa

1. `prueba_colchon.py` (HX711, buzzer y boton) y `calibrar_colchon.py`.
2. WiFi + HTTPS hacia Ingesta (revisar la version de TLS negociada).
3. Unirse al canal Realtime y recibir un comando de prueba.
4. Audio solo; luego con WiFi activo.
5. AM2301 -> lampara -> PIR y LED -> colchon completo.
