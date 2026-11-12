# Firmware de la Pico 2 W

Lee temperatura, humedad y movimiento, controla la lámpara y las figuras,
y envía las lecturas de ambiente a Supabase cuando está configurado.

## Estructura

```text
firmware/
├─ README.md
├─ main.py                      programa principal
├─ secrets.example.py           plantilla de WiFi y Supabase
├─ alimentacion/  habitacion/  juego/     vacías: proyecto completo
├─ colchon/
│  ├─ logica_colchon.py         lógica pura (estados, filtro, calibración, botón): se prueba en CPython
│  ├─ hx711.py                  lectura no bloqueante del HX711
│  ├─ control_colchon.py        ciclo, comandos locales, buzzer y botón
│  ├─ setup_colchon.py          crea el hardware desde config.py (no toca pines al importarse)
│  └─ prueba_colchon.py         menú de prueba sin red
├─ cuna/
│  ├─ lampara.py                LED blanco regulable 0-100 % (PWM + MOSFET)
│  └─ audio.py                  reproductor local MAX98357A por I²S (no bloqueante)
├─ figuras-led/
│  └─ figuras.py                seis LED: uno, todos o secuencias
└─ common/
   ├─ sensors/sensores.py       AM2301 (temperatura/humedad) y PIR
   ├─ communication/
   │  ├─ wifi.py                conectar, comprobar y reconectar el WiFi
   │  ├─ ambiente.py            sincronizar el reloj y publicar lecturas por HTTPS
   │  └─ gts-root-r4.der        certificado raíz público para verificar el servidor
   └─ utilities/
      ├─ config.py              pines y tiempos (lo que más editas)
      ├─ comandos.py            ejecuta una orden y devuelve su confirmación
      ├─ demo.py                simula órdenes de la web; MODO_DEMO = False lo apaga
      └─ indicador.py           parpadeo del LED interno de la Pico
```

`main.py` agrega las carpetas a `sys.path`, por eso los módulos se importan
simplemente como `import config` o `import wifi`.

## Línea de ejecución de main.py

1. `iniciar()`: parpadea 3 veces, conecta al WiFi (1 parpadeo largo = ok, 5 rápidos = falló).
2. `ciclo_principal()` repite cada 100 ms:
   - cada 10 s: lee temperatura y humedad, las imprime y entrega la lectura al envío
   - siempre: avisa si el PIR detecta movimiento
   - siempre: `figuras.actualizar()` mueve la secuencia de LED si hay una activa
   - modo demo: `demo.actualizar()` ejecuta la siguiente orden de ejemplo
   - si están habilitados: colchón (botón, muestreo, alarma) y audio local
   - sin envío configurado: revisa el WiFi cada 5 s y reconecta si se cayó
3. Cuando se habilita el envío, una tarea en el segundo núcleo maneja la
   reconexión, NTP y HTTPS. Mantiene como máximo una lectura en espera y la
   descarta si pierde el WiFi. Los fallos de red se registran en consola.

## Cómo probarlo

1. Usa [MicroPython 1.28.0 para la Pico 2 W](https://micropython.org/download/RPI_PICO2_W/).
   Comprueba en la consola que `import ntptime` funciona. Si falta, instala
   el paquete con `mpremote mip install ntptime` desde la computadora.
   [Gestión de paquetes de MicroPython](https://docs.micropython.org/en/v1.28.0/reference/packages.html)
2. Conserva tus variables de WiFi en `secrets.py` y agrega
   `AMBIENTE_URL`, `AMBIENTE_DEVICE_ID` y `AMBIENTE_TOKEN` con los valores
   entregados por B. Para una configuración nueva, usa `secrets.example.py`
   como plantilla. Mantén `secrets.py` fuera de Git.
3. Sube a la Pico `main.py`, `secrets.py` y las carpetas `colchon`, `cuna`, `figuras-led` y `common`
   **conservando la estructura** (en Thonny: crea las carpetas en la Pico y guarda cada archivo dentro).
   Transfiere el archivo binario `gts-root-r4.der` a `/common/communication/`
   usando el panel de archivos de Thonny.
4. Enciende el hotspot, abre `main.py` y pulsa Run. Verifica en consola
   «hora UTC sincronizada», una lectura real y «HTTP 201». Comprueba que el
   PIR y las figuras respondan durante el envío, y que vuelva a aparecer
   «HTTP 201» al cortar y restablecer el hotspot.

El cliente valida el certificado y el nombre del servidor. El certificado
público incluido es GTS Root R4. Si cambia la cadena del servidor, comprueba
la nueva raíz y actualiza el archivo en la Pico. [Google Trust Services](https://pki.goog/repository/)

La compilación oficial de MicroPython 1.28.0 habilita TLS 1.2. El requisito
de TLS 1.3 de la arquitectura queda pendiente para la prueba en hardware
con un firmware que lo admita. [Configuración de TLS de MicroPython 1.28.0](https://github.com/micropython/micropython/blob/v1.28.0/extmod/mbedtls/mbedtls_config_common.h)

[Contrato de ambiente](../shared/contracts/ambiente.md)

## Colchón y audio local (SIN PROBAR EN HARDWARE, apagados por defecto)

Ni el colchón ni el audio se habilitan solos: `COLCHON_HABILITADO` y
`AUDIO_HABILITADO` están en `False` en `config.py`. Con ambos apagados el
firmware se comporta como antes. Los pines son una **propuesta pendiente de
confirmación y cableado**; ninguno usa GP23/24/25/29 y `config.py` es el único
lugar donde se definen:

| Función | GPIO propuesto |
|---|---|
| HX711 SCK / DT | GP16 / GP17 |
| Buzzer activo (base del NPN) | GP14 |
| Botón físico (a GND, pull-up interno) | GP15 |
| I²S BCLK / WS / DIN (MAX98357A) | GP6 / GP7 / GP8 (WS = BCLK + 1, exigido por la RP2) |

No se ha comprobado la revisión eléctrica, ni la potencia sobre el parlante de
8 Ω / 0,5 W, ni el funcionamiento de I²S en la Pico 2 W, ni la fijación de la
celda de carga. Antes de habilitar nada, confirma el cableado con el equipo
de circuitos.

### Reglas del colchón (RF-14 a RF-16, DEC-03, DEC-07, DEC-13)

- Estados: `inactivo`, `activo`, `alarma`, `detenido`.
- **No hay factor de calibración por defecto.** Sin tara y calibración
  explícitas no se puede armar. La calibración vive en RAM y se pierde al reiniciar.
- Armar captura la referencia (promedio de `COLCHON_MUESTRAS_CAPTURA` lecturas
  válidas) y exige que sea positiva y que la duración sea positiva y ≤ 24 h.
- Muestreo cada 1 s sin bloquear el ciclo. Si el HX711 no está listo, se
  salta y se reintenta en la vuelta siguiente; si pasan 2 s sin estar listo,
  cuenta como lectura inválida. Las interrupciones se deshabilitan solo durante
  la ráfaga de 25 pulsos del HX711.
- Alarma: pérdida **estrictamente mayor** que la tolerancia (10 %) en 3
  lecturas consecutivas. Una lectura dentro de tolerancia o inválida reinicia
  la cuenta. Con referencia 1000 g: tres de 890 g alarman; tres de 900 g no.
- La alarma se apaga por botón, por comando `mattress_stop` o a los 60 s
  (`COLCHON_ALARMA_MAX_S`), y en los tres casos queda `detenido`. El buzzer
  arranca apagado y se apaga en cada parada y al cerrar el programa.
- Al vencer la duración del monitoreo también queda `detenido`.
- El botón (con antirrebote) **solo detiene**. Reanudar es explícito
  (`mattress_arm` o `mattress_rearm`) y siempre toma una referencia nueva.
- **WiFi:** con `COLCHON_REQUIERE_WIFI = True` (valor por defecto, conforme a
  la arquitectura), si se corta el WiFi con el monitoreo `activo` o con la
  alarma sonando, se apaga el buzzer, se detiene
  (`motivo_parada = "wifi_perdido"`) y hay que rearmar; tampoco se puede armar
  sin WiFi (arquitectura 4.4).
  La demostración independiente de la red solo se hace como **prueba
  controlada**: el menú `prueba_colchon.py` (que no exige WiFi y lo avisa) o
  poner `COLCHON_REQUIERE_WIFI = False` de forma explícita, lo que `main.py`
  anuncia en consola. No lo dejes así fuera de la prueba.

### Comandos locales (invocables sin red)

Se ejecutan con `comandos.ejecutar({"command": ..., "params": {...}})`. En
esta fase ningún canal de red los invoca y `main.py` no los dispara solo (el
ciclo principal ocupa la consola). Para probarlos sin red usa el menú
`prueba_colchon.py`, que llama a los mismos métodos, o un script propio que
registre un `ControlColchon` con `comandos.conectar_colchon`. La carpeta
`tests/` es solo de escritorio: no se sube a la Pico.

| Comando | Parámetros | Efecto |
|---|---|---|
| `mattress_tare` | — | mide el cero (colchón sin peso) |
| `mattress_calibrate` | `known_weight_g` (0–5000) | calcula el factor con una pesa conocida |
| `mattress_arm` | `duration_s` opcional | captura referencia y activa |
| `mattress_status` | — | estado, referencia, cuenta, `ultimo_resultado` |
| `mattress_stop` | — | detiene y apaga el buzzer |
| `mattress_rearm` | `duration_s` opcional | solo desde `detenido`; referencia nueva |
| `audio_play` / `audio_stop` / `audio_status` | `sound` | audio local |

Las acciones que miden devuelven `{"pendiente": True}`; consulta
`mattress_status` hasta que `captura` sea `None` y lee `ultimo_resultado`.
`get_status` conserva sus campos y agrega `colchon` y `audio` (`None` si están
deshabilitados). Los nombres de comandos son provisionales, como los demás.

### Procedimiento de calibración con pesas conocidas

1. Fija la celda como quedará en la maqueta y deja el colchón estable, sin
   bebé ni objetos. Ejecuta `mattress_tare`.
2. Coloca una pesa cuya masa hayas verificado con una balanza de referencia.
   Ejecuta `mattress_calibrate` con esa masa en gramos. El factor queda en
   `ultimo_resultado`. Usa una masa que represente bien el rango de uso.
3. Comprueba con una segunda pesa distinta (`leer peso` del menú o `mattress_arm`
   y `mattress_status`) que el valor leído coincide con su masa. Anota la
   diferencia observada: ese dato lo mides tú, no está en este repositorio.
4. Coloca el peso de trabajo y ejecuta `mattress_arm`. Quita o reduce peso por
   más de la tolerancia y espera 3 lecturas (≥ 3 s): debe sonar el buzzer.
5. Prueba el botón, `mattress_stop`, el límite de 60 s y el corte de WiFi.

Menú local (`colchon/prueba_colchon.py`, Run en Thonny): conserva las opciones
1–6 originales (leer peso, tara, buzzer on/off, probar botón, salir) y suma
7 calibrar, 8 armar, 9 estado, 10 detener, 11 rearmar. El menú usa el cableado
del montaje independiente del colchón: DT GP13, SCK GP12, buzzer GP18 y botón
GP19 (pines físicos 17, 16, 24 y 25, respectivamente). En la Pico del equipo
se recibieron diez muestras crudas válidas del HX711 con este mapa. GP13,
GP18 y GP19 también figuran en la configuración integrada de la lámpara y
los LED. Ejecuta el menú con solo el colchón conectado y acuerda el mapa
común con el equipo de circuitos antes de montar todo en la misma placa.

### Audio local MAX98357A

Catálogo fijo con un solo sonido, `tono_suave`: un tono de 500 Hz generado en
memoria (PCM 16 bits, mono, 16 kHz), sin archivos WAV ni dependencias. **No es
un audio pregrabado real**: sirve para probar la ruta I²S; el catálogo real
queda pendiente. La salida I²S solo existe mientras suena y está apagada por
defecto.

- `machine.I2S` TX no bloqueante (MicroPython 1.28 RP2): `.irq(callback)` y un
  único `write(buf)` en vuelo hasta que el callback confirma la copia al buffer
  interno; bloques reutilizables (50 ms) con rampa de subida y bajada. Tras
  confirmar el último bloque se espera el drenaje físico (buffer + DMA +
  margen) antes de liberar; hay watchdog si el callback no llega.
- Catálogo pregrabado: pendiente (hoy solo `tono_suave` sintetizado).
- Atenuación digital: `AUDIO_VOLUMEN_PCT = 10` % de la amplitud máxima,
  recortada a `AUDIO_VOLUMEN_MAX_PCT = 25`. Duración 5 s, tope 30 s.
  Estos topes son prudentes pero **no están medidos** contra el parlante.
- Un fallo de I²S deja el estado `error` y no detiene sensores ni luces.
- Falta comprobar en hardware cómo se comporta `write()` no bloqueante y el
  momento exacto del callback y el margen de drenaje.

### Prueba simultánea con la maqueta (pendiente de ejecutar)

1. Confirma cableado y revisión eléctrica. Habilita primero **solo uno**
   (`COLCHON_HABILITADO` o `AUDIO_HABILITADO`) y comprueba que sube sin errores.
2. Habilita ambos con el hotspot encendido. Verifica a la vez: lectura de
   ambiente y «HTTP 201», PIR, figuras LED, lámpara, `audio_play`, y el
   monitoreo del colchón con su alarma.
3. Durante `audio_play`, comprueba que el muestreo de 1 s del colchón y el
   botón siguen respondiendo, y que cortar el hotspot detiene el monitoreo.
4. Registra los resultados reales; hasta entonces, colchón y audio figuran
   como **sin probar en hardware**.

### Pruebas de escritorio

Con CPython 3 (sin dependencias ni hardware), desde la raíz del repositorio:

```text
python -m unittest discover -s src/firmware/tests -v
```

Cubren la frontera del 10 %, las tres lecturas, duración y timeout, botón y
rearme, WiFi, errores del HX711 y límites y errores del audio. No sustituyen
la prueba en hardware.

## Flujo de un comando

`demo.py` (luego, la web) crea una orden -> `comandos.ejecutar(orden)` ->
llama a `lampara` o `figuras` -> devuelve `{"ok": True/False, ...}`.
Pines nuevos (provisionales): lámpara GP13; LED GP18, 19, 20, 21, 22 y 26.
