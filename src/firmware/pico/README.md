# Firmware de la Pico 2 W

Firmware único de la Pico 2 W. Hay **una sola Pico** y se conecta a **un módulo
por vez**: se conecta al colchón, se demuestra, se desconecta y se pasa a otro
módulo. Los módulos están separados; la Pico no los controla a todos a la vez.
Elige cuál está conectado con `MODULO` en `config.py` (ver abajo).

> **Esta es la única carpeta de código de la Pico (`src/firmware/pico/`).** Todo lo
> necesario para usarla está aquí dentro: el firmware de todos los módulos, las
> pruebas y la plantilla de secretos.
>
> **El módulo `colchon` es el de `Documentos\pico`** (`colchon/peso.py`,
> `colchon/monitoreo.py`, `colchon/setup_colchon.py`): pesa, monitorea, alarma y envía
> los eventos `monitoring_*` / `alarm_*` del dispositivo `pico-figuras-colchon-01`, que
> es el que muestra la pestaña Colchón de la web. Con `MODULO = "colchon"`, `main.py`
> ejecuta `iniciar_colchon()` y `ciclo_colchon()` (ver «Colchón» más abajo). El colchón
> anterior (`control_colchon`, contrato `colchon.md`) se eliminó; su respaldo está
> fuera del repo.
>
> **Cómo copiarlo a la Pico:** sube el **contenido** de `src/firmware/pico/` a la raíz
> de la Pico (`/main.py`, `/colchon/`, `/common/`…), sin `tests/` ni el README. Copia
> `secrets.example.py` como `secrets.py`, edítalo y agrega `INGESTA_URL` y
> `DEVICE_TOKEN` (y las tres claves de órdenes) para el colchón.

## Elegir el módulo

| `MODULO` | Qué hay conectado | Qué atiende el firmware | Credenciales (`secrets.py`) | Comandos que acepta |
|---|---|---|---|---|
| `"cuna"` (por defecto) | AM2301, PIR, lámpara (MOSFET) y audio MAX98357A | ambiente (envío a Supabase), movimiento, lámpara remota y audio local | WiFi, `AMBIENTE_*`, `LAMPARA_*`, `MOVIMIENTO_*` según lo que uses | `lamp_set`, `motion_set`, `audio_*`, `get_status` |
| `"colchon"` | HX711, celda de carga, buzzer y botón | `colchon/` (peso, monitoreo, alarma, botón) y envío por `nube.py` | WiFi, `INGESTA_URL`, `DEVICE_TOKEN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TOKEN_SHA256` | `scale_tare`, `scale_calibrate`, `mattress_reference`, `mattress_start`, `mattress_stop`, `alarm_stop`, `get_status` |
| `"figuras"` | los seis LED | secuencias de LED | solo WiFi | `led_set`, `led_all`, `led_sequence`, `led_stop`, `get_status` |

Para cambiar de módulo: edita `MODULO` en `common/utilities/config.py`, copia el
archivo a la Pico y reinicia. Solo se inicializa lo del módulo elegido, así un
sensor sin cablear no da lecturas falsas ni se tocan pines de otro módulo. Una
orden de otro módulo se rechaza con el error `comando_de_otro_modulo:<modulo>`,
y un valor de `MODULO` desconocido detiene el arranque antes de tocar nada.
`get_status` responde siempre e incluye el campo `modulo`.

`AUDIO_HABILITADO` y `VOZ_HABILITADA` están en `True` (la cuna con parlante): además de
elegir el módulo, el periférico debe estar habilitado; con `False`, `audio_play` responde
`audio_no_habilitado`. El colchón no tiene ese interruptor: con `MODULO = "colchon"`
arranca siempre.

La calibración del colchón (el factor cuentas/gramo) se guarda en la Pico en
`calibracion.json` y se carga al arrancar, así no se repite con la pesa conocida
al volver al módulo. La **tara no se guarda**: se toma de nuevo cada vez.

## Estructura

```text
src/firmware/pico/
├─ README.md
├─ main.py                      programa principal
├─ secrets.example.py           plantilla de WiFi y Supabase
├─ alimentacion/  habitacion/  juego/     módulos de alimentación (incluye hx711.py y logica_colchon.py), habitación y juego
├─ colchon/                     colchón (el de Documentos\pico)
│  ├─ setup_colchon.py          pines, HX711, buzzer y botón (crea el hardware al importarse)
│  ├─ peso.py                   tara, calibración (se guarda) y lectura en gramos
│  ├─ monitoreo.py              referencia, filtro de 3 lecturas, alarma, parada y eventos
│  └─ prueba_colchon.py         menú de prueba sin red
├─ cuna/
│  ├─ lampara.py                LED blanco regulable 0-100 % (PWM + MOSFET)
│  ├─ audio.py                  reproductor local MAX98357A por I²S (no bloqueante)
│  ├─ voz.py                    voz en vivo del cuidador por la misma salida I²S
│  └─ prueba.wav                sonido «prueba» del catálogo (PCM 16 bits, mono, 16 kHz; copiar a /cuna)
├─ figuras-led/
│  └─ figuras.py                seis LED: uno, todos o secuencias
└─ common/
   ├─ sensors/sensores.py       AM2301 (temperatura/humedad) y PIR
   ├─ communication/
   │  ├─ wifi.py                conectar, comprobar y reconectar el WiFi
   │  ├─ ambiente.py            sincronizar el reloj y publicar lecturas por HTTPS
   │  ├─ nube.py                colchón: envío de eventos, lectura y confirmación de órdenes
   │  ├─ lampara_remota.py      Auth, Realtime y RPC de la lámpara (apagado sin LAMPARA_*)
   │  ├─ websocket_cliente.py   cliente WebSocket RFC 6455 mínimo
   │  └─ gts-root-r4.der        certificado raíz público para verificar el servidor
   └─ utilities/
      ├─ config.py              pines y tiempos (lo que más editas)
      ├─ comandos.py            ejecuta una orden y devuelve su confirmación
      ├─ eventos.py             hora UTC (NTP) y eventos con id único (colchón)
      ├─ demo.py                simula órdenes de la web (por módulo); MODO_DEMO = False lo apaga
      ├─ modulo.py              qué periféricos y comandos corresponden a MODULO
      └─ indicador.py           parpadeo del LED interno de la Pico
```

`main.py` agrega las carpetas a `sys.path`, por eso los módulos se importan
simplemente como `import config` o `import wifi`.

## Línea de ejecución de main.py

0. Valida `MODULO`; si no es `cuna`, `colchon` ni `figuras`, avisa y termina sin tocar ningún pin.
1. `iniciar()`: parpadea 3 veces, conecta al WiFi (1 parpadeo largo = ok, 5 rápidos = falló).
2. `ciclo_principal()` repite cada 100 ms, según el módulo:
   - `cuna`: cada 2 s (`INTERVALO_AMBIENTE_S`, el mínimo del AM2301) lee temperatura y humedad, las imprime y entrega la lectura al envío;
     avisa si el PIR detecta movimiento; atiende la lámpara remota y, si está habilitado, el audio
   - `figuras`: `figuras.actualizar()` mueve la secuencia de LED si hay una activa
   - `colchon`: no usa `ciclo_principal()`: `iniciar_colchon()` (hora UTC y tara) y `ciclo_colchon()` (boton, órdenes cada 3 s, peso cada 1 s, WiFi y envío de eventos)
   - modo demo: `demo.actualizar()` ejecuta la siguiente orden de ejemplo del módulo
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
3. Elige el módulo en `MODULO`. Sube a la Pico `main.py`, `secrets.py` y las carpetas `colchon`, `cuna`, `figuras-led`, `alimentacion`, `habitacion`, `juego` y `common`
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

## Lámpara remota (Supabase Auth + Realtime)

Apagada por defecto: sin variables `LAMPARA_*` en `secrets.py` el firmware
se comporta como antes (demo incluida). Alcance: solo la lámpara de la
maqueta (`lamp_set`, nivel entero 0..100). El PIR usa el envío de eventos
descrito en su [contrato](../shared/contracts/movimiento.md).
Contrato de comandos:
[lámpara](../shared/contracts/lampara.md).

### Configuración

Agrega a tu `secrets.py` (plantilla en `secrets.example.py`; nunca lo subas a Git):

| Variable | Contenido |
| --- | --- |
| `LAMPARA_SUPABASE_URL` | `https://<proyecto>.supabase.co`, sin ruta |
| `LAMPARA_PUBLISHABLE_KEY` | clave publicable (nunca `service_role` ni la secreta) |
| `LAMPARA_DEVICE_ID` | `cuna-lampara-NN` |
| `LAMPARA_AUTH_EMAIL`, `LAMPARA_AUTH_PASSWORD` | cuenta Auth exclusiva del dispositivo |

Las credenciales de AM2301 (`AMBIENTE_*`) no cambian. La cuenta del
dispositivo y su vínculo con el módulo los crea el backend; esta fase no los crea.
Cada variable se valida al arrancar y, si falta algo, la lámpara remota se
queda desactivada con un aviso sin datos sensibles.

### Cómo funciona

- Un solo worker de red (el de `ambiente.py`, que también corre si solo hay
  lámpara) hace `paso()` cooperativo cada ~100 ms, con timeout de socket de
  0,2 s para leer. No se crea otro `_thread` y el ciclo principal (PIR, LED,
  sensores) no espera a la red.
- Auth: `POST /auth/v1/token?grant_type=password`; renueva con
  `refresh_token` antes de vencer o vuelve a autenticarse; en fallos aplica
  backoff de 2 s a 60 s (60 s si la cuenta es rechazada). Nunca imprime
  credenciales, tokens ni respuestas.
- Realtime: `wss://<host>/realtime/v1/websocket?apikey=<publicable>&vsn=1.0.0`
  (cliente RFC 6455 propio en `websocket_cliente.py`: valida HTTP 101 y
  `Sec-WebSocket-Accept`, enmascara frames, responde ping, maneja cierre y limita
  tamaños). `phx_join` a `realtime:lampara:<id>` con `private: true` y espera
  `phx_reply` ok. Heartbeat a `phoenix` cada 20 s; sin respuesta en 10 s se
  reconecta. Renueva el JWT con el evento `access_token`.
- La orden nunca viaja por Realtime. Al confirmarse la suscripción y ante
  cada `orden_disponible` se llama al RPC `tomar_orden_lampara`. Las órdenes se
  procesan una a una.
- La orden pasa por un buzón de un lugar al ciclo principal, que comprueba la
  vigencia (`vence_en`, con reloj NTP y margen de 1 s, además del guard del
  servidor) y ejecuta con `comandos.ejecutar`. Después el worker llama a
  `confirmar_orden_lampara` (`p_ok`, `p_level`, `p_error`). Sin respuesta
  2xx no se declara registrada, y tras 3 intentos se descarta.
- Al perder la conexión (WiFi, heartbeat, cierre) se descartan las órdenes
  pendientes y la lámpara queda apagada. También arranca apagada.
- Con la lámpara remota activa, `demo.py` no corre, para no pisar el PWM.

### Limitaciones y pendientes

- **TLS**: MicroPython 1.28 habilita TLS 1.2; el TLS 1.3 de la arquitectura
  sigue pendiente. El cliente valida el certificado raíz DER incluido y el
  nombre del servidor.
- **No verificado en hardware**: WSS/TLS contra Supabase Realtime, el
  comportamiento de `settimeout` y las lecturas parciales sobre sockets TLS,
  el tamaño de pila del worker (16 KiB con lámpara remota) y la memoria con dos
  conexiones TLS. Tampoco la luz física ni el cableado de la lámpara.
- `tomar_orden_lampara` entrega una sola vez: si se pierde la respuesta, la
  orden aparecerá como `sin-respuesta`.
- `ok` solo dice qué nivel aplicó el firmware, no que la luz sea visible.

### Pruebas de lógica (computadora, sin hardware ni red)

```powershell
cd src\firmware
python -m unittest discover -s tests -v
```

Cubren frames y handshake WebSocket, vigencia RFC 3339, validación de órdenes,
respuestas HTTP y el flujo del cliente con RPC simulados. No se suben a la Pico.

## Colchón

Es el firmware de `Documentos\pico`: `colchon/setup_colchon.py` (hardware), `colchon/peso.py`
(tara y calibración), `colchon/monitoreo.py` (referencia, alarma y eventos),
`common/communication/nube.py` (envío y órdenes) y `common/utilities/eventos.py` (hora UTC).
Los pines están en `setup_colchon.py` y los tiempos en `config.py`:

| Función | GPIO |
|---|---|
| HX711 DT / SCK | GP13 / GP12 |
| Botón físico | GP19 |
| Buzzer pasivo (base del NPN) | GP18 |

En la Pico del equipo se recibieron diez muestras crudas válidas del HX711 y se completó una
tara con este mapa. **No** se ha comprobado la revisión eléctrica ni la fijación de la celda
de carga.

### Flujo de uso

`scale_tare` (vacío) → `scale_calibrate {known_g}` (con una pesa conocida; se guarda en
`calibracion.json`) → `mattress_reference` (con la carga apoyada) → `mattress_start`
`{duration_s, tolerance_pct, alarm_s}`. Sin factor guardado el firmware usa 420 (provisional)
y lo avisa en consola.

### Reglas del colchón

- Alarma: 3 lecturas seguidas **por debajo** de `referencia × (1 − tolerancia)`. Con 1000 g y 10 %:
  tres de 890 g alarman; tres de 900 g no. Volver al umbral reinicia la cuenta.
- Parar la alarma (web `alarm_stop`, botón o temporizador `ALARMA_S`) **detiene el monitoreo y
  borra la referencia**: para volver a empezar hace falta `mattress_reference` otra vez.
- El monitoreo termina solo al vencer `duration_s`.
- Con `EXIGIR_CONEXION = True` (valor por defecto), si se pierde el WiFi, Internet o la hora
  UTC con el monitoreo activo, se detiene (`connection`) y no se reanuda solo. Sin hora
  sincronizada (NTP) no se permiten eventos ni monitoreo. En el banco sin red usa `False`.
- Si el HX711 deja de responder `FALLOS_LECTURA_MAX` veces seguidas, se detiene el monitoreo.
- El buzzer queda apagado en cada parada y al cerrar el programa (`finally` de `ejecutar()`).

### Eventos y órdenes

`monitoreo.py` produce `monitoring_started` (también como latido cada 20 s mientras monitorea),
`monitoring_stopped {reason}`, `alarm_started` y `alarm_stopped {reason}`. `nube.py` los envía por
lotes a `INGESTA_URL` con `DEVICE_TOKEN` como dispositivo `DEVICE_ID`; si el envío falla, reintenta
(`REINTENTO_ENVIO_S`) y la cola descarta lo más viejo al llenarse (`COLA_MAX`). Cada 3 s consulta
las órdenes de la web (RPC `tomar_ordenes_colchon`) y confirma cada una (`confirmar_orden_colchon`).
Sin `INGESTA_URL` y `DEVICE_TOKEN` la nube queda desactivada y solo se imprime por consola.

### Comandos

Se ejecutan con `comandos.ejecutar({"command": ..., "params": {...}})`; la web los pide por Supabase.

| Comando | Parámetros | Efecto |
|---|---|---|
| `scale_tare` | — | mide el cero (balanza vacía); rechaza con `monitoreo_activo` |
| `scale_calibrate` | `known_g` (1–5000) | calcula y guarda el factor con una pesa conocida |
| `mattress_reference` | `reference_g` opcional (1–20000) | fija o mide la referencia |
| `mattress_start` | `duration_s`, `tolerance_pct` (1–50), `alarm_s` (1–600), `reference_g` opcionales | inicia el monitoreo |
| `mattress_stop` | — | detiene el monitoreo |
| `alarm_stop` | — | silencia la alarma y detiene el monitoreo |

`get_status` incluye `colchon` (el resumen de `monitoreo.resumen()`) en este módulo y `None` en los demás.
Los nombres de comandos son provisionales, como los demás.

### Procedimiento de calibración con pesas conocidas

1. Fija la celda como quedará en la maqueta y deja el colchón estable, sin bebé ni objetos.
   Ejecuta `scale_tare`.
2. Coloca una pesa cuya masa hayas verificado con una balanza de referencia y ejecuta
   `scale_calibrate` con esa masa en gramos. Usa una masa que represente bien el rango de uso.
   Al volver a este módulo solo hace falta `scale_tare`.
3. Comprueba con una segunda pesa distinta que el valor leído (`Peso:` en la consola) coincide con
   su masa. Anota la diferencia observada: ese dato lo mides tú, no está en este repositorio.
4. Coloca el peso de trabajo, ejecuta `mattress_reference` y `mattress_start`. Quita o reduce peso por
   más de la tolerancia y espera 3 lecturas (≥ 3 s): debe sonar el buzzer.
5. Prueba el botón, `mattress_stop`, el límite de `ALARMA_S` y el corte de WiFi.

Menú local (`colchon/prueba_colchon.py`, Run en Thonny, sin red): leer peso, tara, buzzer, botón y
calibración. Ejecútalo con solo el colchón conectado.

## Audio local

`AUDIO_HABILITADO` está en `True` en `config.py` (con `False` el firmware se comporta como antes
y las órdenes `audio_*` responden `audio_no_habilitado`). El I²S no toca ningún pin hasta que se
reproduce algo, y si no arranca el audio queda apagado sin afectar al resto del módulo.
Los pines I²S son una **propuesta pendiente de confirmación y cableado**
(BCLK GP18, WS GP19, DIN GP20; WS = BCLK + 1, exigido por la RP2) y `config.py` es el único lugar
donde se definen. No se ha comprobado la potencia sobre el parlante de 8 Ω / 0,5 W ni el
funcionamiento de I²S en la Pico 2 W. Antes de habilitarlo, confirma el cableado con el equipo
de circuitos. Los comandos son `audio_play {sound}`, `audio_stop` y `audio_status`.

El catálogo vive en `config.AUDIO_CATALOGO` (nombre -> `None` o ruta de un WAV).
Trae dos sonidos: `tono_suave` (un tono de 500 Hz generado en memoria, PCM 16
bits, mono, 16 kHz) y `prueba` (el WAV `prueba.wav`, que está en `cuna/prueba.wav` y hay que
copiar a la Pico en `/cuna`). **Las canciones pregrabadas no vienen incluidas**: para sumar una, copia
su WAV (PCM 16 bits, mono, 16 kHz) a la Pico, agrégala a `AUDIO_CATALOGO` (solo
`a-z`, `0-9` y `_`, hasta 40 caracteres) y agrega el mismo nombre a
`CATALOGO_AUDIO` en `src/frontend/src/models/ordenes.ts`. No hay carga de
archivos desde la app (DEC-08). La salida I²S solo existe mientras suena y está
apagada por defecto.

- `machine.I2S` TX no bloqueante (MicroPython 1.28 RP2): `.irq(callback)` y un
  único `write(buf)` en vuelo hasta que el callback confirma la copia al buffer
  interno; bloques reutilizables (50 ms) con rampa de subida y bajada. Tras
  confirmar el último bloque se espera el drenaje físico (buffer + DMA +
  margen) antes de liberar; hay watchdog si el callback no llega.
- Atenuación digital: `AUDIO_VOLUMEN_PCT = 30` % de la amplitud máxima,
  recortada a `AUDIO_VOLUMEN_MAX_PCT = 30`. Duración 5 s, tope 30 s.
  Estos topes son prudentes pero **no están medidos** contra el parlante.
- Un fallo de I²S deja el estado `error` y no detiene sensores ni luces.
- Falta comprobar en hardware cómo se comporta `write()` no bloqueante y el
  momento exacto del callback y el margen de drenaje.

### Prueba del audio en el módulo de la cuna (pendiente de ejecutar)

1. Con `MODULO = "cuna"`, confirma cableado y revisión eléctrica. `AUDIO_HABILITADO` y
   `VOZ_HABILITADA` ya están en `True`: comprueba que sube sin errores (por serial se ve
   «Voz: sesión iniciada / cerrada» cuando llega la voz de la web).
2. Con el hotspot encendido, verifica: lectura de ambiente y «HTTP 201», PIR,
   lámpara y `audio_play`.
3. Durante `audio_play`, comprueba que el muestreo de ambiente y las órdenes de
   la lámpara siguen respondiendo.
4. El colchón se prueba aparte, con `MODULO = "colchon"` (calibración, alarma,
   botón y corte de WiFi). No se prueban a la vez: la Pico va a un módulo por vez.
5. Registra los resultados reales; hasta entonces, colchón y audio figuran
   como **sin probar en hardware**.

### Pruebas de escritorio

Con CPython 3 (sin dependencias ni hardware), desde la raíz del repositorio:

```text
python -m unittest discover -s src/firmware/pico/tests -v
```

Cubren la frontera del 10 %, las tres lecturas, duración y timeout, botón y
rearme, WiFi, errores del HX711 y límites y errores del audio. No sustituyen
la prueba en hardware.

## Flujo de un comando

`demo.py` (luego, la web) crea una orden -> `comandos.ejecutar(orden)` ->
llama a `lampara` o `figuras` (solo si el comando es del `MODULO` conectado) ->
devuelve `{"ok": True/False, ...}`.

Figuras: `led_set` cambia solo el LED pedido (varias figuras pueden quedar
encendidas a la vez; si había una secuencia en curso, la reemplaza y apaga
todo antes). `led_set` y `led_all` exigen que `on` sea un booleano real; un
texto como `"false"` o un número se rechaza con `parametro_invalido:on`.
Pines nuevos (provisionales): lámpara GP13; LED de las figuras GP6 a GP11 (`PINES_LEDS`).
