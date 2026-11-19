# Firmware de la Pico 2 W

Firmware único de la Pico 2 W. Hay **una sola Pico** y se conecta a **un módulo
por vez**: se conecta a la cuna o a las figuras LED, se demuestra, se desconecta
y se pasa a otro módulo. Los módulos están separados; la Pico no los controla a todos a la vez.
Elige cuál está conectado con `MODULO` en `config.py` (ver abajo).

## Elegir el módulo

| `MODULO` | Qué hay conectado | Qué atiende el firmware | Credenciales (`secrets.py`) | Comandos que acepta |
|---|---|---|---|---|
| `"cuna"` | AM2301, PIR, lámpara (MOSFET) y audio MAX98357A | ambiente (envío a Supabase), movimiento (envío a Supabase), lámpara remota y audio local | WiFi, `INGESTA_URL`, `DEVICE_TOKEN`, `MOVIMIENTO_*` y `LAMPARA_*` según lo que uses | `lamp_set`, `audio_*`, `get_status` |
| `"figuras"` | los seis LED | secuencias de LED | solo WiFi | `led_*`, `get_status` |
| `"completo"` (por defecto) | todo lo anterior a la vez, como el código funcional | todo lo de `cuna` y `figuras` | las de `cuna` | `lamp_set`, `led_*`, `audio_*`, `get_status` |

Para cambiar de módulo: edita `MODULO` en `common/utilities/config.py`, copia el
archivo a la Pico y reinicia. Solo se inicializa lo del módulo elegido, así un
sensor sin cablear no da lecturas falsas ni se tocan pines de otro módulo. Una
orden de otro módulo se rechaza con el error `comando_de_otro_modulo:<modulo>`,
y un valor de `MODULO` desconocido detiene el arranque antes de tocar nada.
`get_status` responde siempre e incluye el campo `modulo`.

`AUDIO_HABILITADO` es el "cableado confirmado" del audio. Está en `True` porque
los pines vienen del código funcional (`src/firmware/codigo funcional/cuna.py`),
pero sigue **sin probarse en hardware con esta estructura**.

### Mapa de pines (tomado del código funcional)

| Función | GPIO |
|---|---|
| AM2301 (temperatura y humedad) | GP2 |
| PIR HC-SR501 (pull-down) | GP3 |
| Seis LED de las figuras | GP6, GP7, GP8, GP9, GP10, GP11 |
| Lámpara regulable (PWM 1 kHz, MOSFET) | GP13 |
| MAX98357A: BCLK / WS / DIN (I2S0) | GP18 / GP19 / GP20 |

### Efectos autónomos (`EFECTOS_AUTONOMOS = True`)

Como el código funcional, sin esperar órdenes de la web:

- Los LED corren el ciclo `patrones`: secuencial, parpadeo de todos, alternado,
  rebote y encendido progresivo (`efectos.pasos_patrones`). También se puede pedir
  con `led_sequence` y `name = "patrones"`; en ese caso `step_s` se ignora.
- La lámpara sube y baja su brillo (onda triangular de 2,6 s, `lampara.respirar`).
  No lo hace si hay lámpara remota ni si la demo del módulo tiene órdenes de lámpara.
- El PIR espera 60 s a estabilizarse y 2 s seguidos en reposo antes de informar
  movimiento (`pir.py`). Lo imprime en consola y lo envía a Supabase como el módulo
  `cuna-movimiento-01` (con `MONITOREO_MOVIMIENTO_HABILITADO = False` solo avisa por consola).
- El ambiente se lee cada 15 s.
- Al arrancar se reproduce una vez el WAV `prueba` (`AUDIO_AL_INICIAR`).

> El colchón (HX711, celda de carga, buzzer y botón) ya no forma parte de este
> firmware; lo atiende la Pico de `src/firmware/pico`.

## Estructura

```text
firmware/
├─ README.md
├─ main.py                      programa principal
├─ alimentacion/  habitacion/  juego/     vacías: proyecto completo
├─ cuna/
│  ├─ lampara.py                LED blanco regulable 0-100 % (PWM + MOSFET)
│  └─ audio.py                  reproductor local MAX98357A por I²S (no bloqueante)
├─ figuras-led/
│  └─ figuras.py                seis LED: uno, todos o secuencias
└─ common/
   ├─ sensors/
   │  ├─ sensores.py            AM2301 (temperatura/humedad) y PIR
   │  └─ pir.py                 estabilización del PIR (lógica pura, se prueba en CPython)
   ├─ communication/
   │  ├─ wifi.py                conectar, comprobar y reconectar el WiFi
   │  ├─ ambiente.py            sincronizar el reloj y publicar lecturas por HTTPS
   │  ├─ lampara_remota.py      Auth, Realtime y RPC de la lámpara (apagado sin LAMPARA_*)
   │  ├─ websocket_cliente.py   cliente WebSocket RFC 6455 mínimo
   │  └─ gts-root-r4.der        certificado raíz público para verificar el servidor
   └─ utilities/
      ├─ config.py              pines y tiempos (lo que más editas)
      ├─ comandos.py            ejecuta una orden y devuelve su confirmación
      ├─ demo.py                simula órdenes de la web (por módulo); MODO_DEMO = False lo apaga
      ├─ efectos.py             patrones de LED y onda de la lámpara (lógica pura)
      ├─ modulo.py              qué periféricos y comandos corresponden a MODULO
      ├─ rutas.py               busca archivos (certificado, WAV) en las carpetas habituales de la Pico
      ├─ secrets.example.py     plantilla de WiFi y Supabase (se copia a secrets.py)
      └─ indicador.py           parpadeo del LED interno de la Pico
```

`main.py` agrega las carpetas a `sys.path`, por eso los módulos se importan
simplemente como `import config` o `import wifi`.

## Línea de ejecución de main.py

0. Valida `MODULO`; si no es `cuna`, `figuras` ni `completo`, avisa y termina sin tocar ningún pin.
1. `iniciar()`: parpadea 3 veces, conecta al WiFi (1 parpadeo largo = ok, 5 rápidos = falló).
2. `ciclo_principal()` repite cada 100 ms, según el módulo:
   - `cuna`: cada 15 s lee temperatura y humedad, las imprime y entrega la lectura al envío;
     avisa si el PIR detecta movimiento; atiende la lámpara remota y, si está habilitado, el audio
   - `figuras`: `figuras.actualizar()` mueve la secuencia de LED si hay una activa
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
2. Copia `common/utilities/secrets.example.py` a `secrets.py` (queda fuera de Git)
   y completa el WiFi y la configuración de Supabase, que es la misma de la Pico
   del colchón: `INGESTA_URL`, `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Esta Pico
   tiene su **propio** `DEVICE_TOKEN` (64 caracteres hex) y su `TOKEN_SHA256`
   (el SHA-256 del token). El `DEVICE_ID` de `config.py` y `TOKEN_SHA256` deben
   estar registrados en Supabase (`cuna_private.dispositivos`) para que la
   Ingesta acepte los eventos; hasta entonces responde HTTP 401.
3. Elige el módulo en `MODULO`. Sube a la Pico `main.py`, `secrets.py` y las carpetas `cuna`, `figuras-led` y `common`
   **conservando la estructura** (en Thonny: crea las carpetas en la Pico y guarda cada archivo dentro).
   Transfiere el archivo binario `gts-root-r4.der` a `/common/communication/`
   usando el panel de archivos de Thonny.
4. Enciende el hotspot, abre `main.py` y pulsa Run. Verifica en consola
   «hora UTC sincronizada», una lectura real y «HTTP 200». Comprueba que el
   PIR y las figuras respondan durante el envío, y que vuelva a aparecer
   «HTTP 200» al cortar y restablecer el hotspot.

El cliente valida el certificado y el nombre del servidor. El certificado
público incluido es GTS Root R4. Si cambia la cadena del servidor, comprueba
la nueva raíz y actualiza el archivo en la Pico. [Google Trust Services](https://pki.goog/repository/)

La compilación oficial de MicroPython 1.28.0 habilita TLS 1.2. El requisito
de TLS 1.3 de la arquitectura queda pendiente para la prueba en hardware
con un firmware que lo admita. [Configuración de TLS de MicroPython 1.28.0](https://github.com/micropython/micropython/blob/v1.28.0/extmod/mbedtls/mbedtls_config_common.h)

Formato del envío (igual que el de la Pico del colchón, Edge Function `ingesta`):
`POST {INGESTA_URL}` con `Authorization: Bearer <DEVICE_TOKEN>` y
`{"device_id": ..., "events": [{"event_id", "type": "ambiente", "at", "data": {"temperatura_c", "humedad_pct"}}]}`.
La respuesta correcta es HTTP 200 (`{"estado": "recibido"}`).

El PIR es otro módulo, con credencial propia: `MOVIMIENTO_DEVICE_ID`
(`cuna-movimiento-NN`, el que espera la tabla `eventos_movimiento` y la web) y
`MOVIMIENTO_TOKEN` (64 hex). Envía un lote con un solo evento
`{"type": "movimiento", "data": {}}` por cada flanco ascendente del PIR, con
`Authorization: Bearer <MOVIMIENTO_TOKEN>`. La función `ingesta` desplegada debe
ser la versión de `supabase/functions/ingesta-lote/` (la anterior rechazaba el tipo
`movimiento` con HTTP 400). Mientras no esté desplegada, el PIR responde
`Movimiento: HTTP 400`; el ambiente no se ve afectado.

[Contrato de ambiente](../shared/contracts/ambiente.md)

## Lámpara remota (Supabase Auth + Realtime)

Apagada por defecto: sin variables `LAMPARA_*` en `secrets.py` el firmware
se comporta como antes (demo incluida). Alcance: solo la lámpara de la
maqueta (`lamp_set`, nivel entero 0..100). Contrato de comandos:
[lámpara](../shared/contracts/lampara.md).

### Configuración

Agrega a tu `secrets.py` (plantilla en `secrets.example.py`; nunca lo subas a Git):

| Variable | Contenido |
| --- | --- |
| `LAMPARA_SUPABASE_URL` | `https://<proyecto>.supabase.co`, sin ruta |
| `LAMPARA_PUBLISHABLE_KEY` | clave publicable (nunca `service_role` ni la secreta) |
| `LAMPARA_DEVICE_ID` | `cuna-lampara-NN` |
| `LAMPARA_AUTH_EMAIL`, `LAMPARA_AUTH_PASSWORD` | cuenta Auth exclusiva del dispositivo |

Las credenciales de Ingesta (`INGESTA_URL`, `DEVICE_TOKEN`) no cambian. La cuenta del
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
cd src\firmware\pico2
python -m unittest discover -s tests -v
```

Cubren frames y handshake WebSocket, vigencia RFC 3339, validación de órdenes,
respuestas HTTP y el flujo del cliente con RPC simulados. No se suben a la Pico.

## Audio local

`AUDIO_HABILITADO = True` en `config.py` (ponlo en `False` para apagarlo). Los
pines (GP18 / GP19 / GP20) son los del código funcional; ninguno usa
GP23/24/25/29 y `config.py` es el único lugar donde se definen. WS debe ser BCLK + 1
(lo exige la RP2).

Catálogo de dos sonidos, ambos PCM 16 bits, mono, 16 kHz:

| Sonido | Qué es |
|---|---|
| `tono_suave` | tono de 500 Hz sintetizado en memoria |
| `prueba` | el WAV de `AUDIO_ARCHIVO` (`prueba.wav`), leído del archivo bloque a bloque |

**Copia `prueba.wav` a la Pico** (a la raíz, como en el código funcional; hay una
copia en `src/firmware/codigo funcional/`). Se valida el encabezado: PCM sin
compresión, mono, 16 kHz y 16 bits; si falla, `audio_play` responde
`audio_wav_invalido`, `audio_archivo_no_encontrado` o `audio_archivo_no_configurado`
y el resto del firmware sigue. El volumen es `AUDIO_VOLUMEN_PCT = 30` (el
`VOLUMEN = 0.3` del código funcional), con tope `AUDIO_VOLUMEN_MAX_PCT = 30`.

No se ha comprobado la revisión eléctrica, ni la potencia sobre el parlante de
8 Ω / 0,5 W, ni el comportamiento del I²S no bloqueante leyendo el WAV desde la
memoria flash de la Pico.

Comandos locales (se ejecutan con `comandos.ejecutar({"command": ..., "params": {...}})`;
la carpeta `tests/` es solo de escritorio y no se sube a la Pico):

| Comando | Parámetros | Efecto |
|---|---|---|
| `audio_play` / `audio_stop` / `audio_status` | `sound` (`tono_suave` o `prueba`) | audio local |

`get_status` incluye `modulo`, `lampara`, `secuencia` y `audio` (`None` si está
deshabilitado). Los nombres de comandos son provisionales.

### Audio local MAX98357A

La salida I²S solo existe mientras suena. El tono se sintetiza en memoria; el
WAV se lee del archivo, se atenúa por software y se escribe bloque a bloque.

- `machine.I2S` TX no bloqueante (MicroPython 1.28 RP2): `.irq(callback)` y un
  único `write(buf)` en vuelo hasta que el callback confirma la copia al buffer
  interno; bloques reutilizables (50 ms) con rampa de subida y bajada. Tras
  confirmar el último bloque se espera el drenaje físico (buffer + DMA +
  margen) antes de liberar; hay watchdog si el callback no llega.
- Atenuación digital: `AUDIO_VOLUMEN_PCT = 30` % de la amplitud máxima,
  recortada a `AUDIO_VOLUMEN_MAX_PCT = 30`. El tono dura 5 s (tope 30 s); el WAV
  dura lo que mida el archivo. El volumen **no está medido** contra el parlante.
- Un fallo de I²S deja el estado `error` y no detiene sensores ni luces.
- Falta comprobar en hardware cómo se comporta `write()` no bloqueante y el
  momento exacto del callback y el margen de drenaje.

### Prueba del audio en el módulo de la cuna (pendiente de ejecutar)

1. Con `MODULO = "completo"` (o `"cuna"`), confirma cableado y revisión eléctrica.
   Comprueba que sube sin errores y que `prueba.wav` está en la Pico.
2. Con el hotspot encendido, verifica: lectura de ambiente y «HTTP 200», PIR (con «Movimiento: HTTP 200»),
   lámpara y `audio_play`.
3. Durante `audio_play`, comprueba que el muestreo de ambiente y las órdenes de
   la lámpara siguen respondiendo.
4. Registra los resultados reales; hasta entonces, el audio figura como
   **sin probar en hardware**.

### Pruebas de escritorio

Con CPython 3 (sin dependencias ni hardware), desde la raíz del repositorio:

```text
python -m unittest discover -s src/firmware/pico2/tests -v
```

Cubren la configuración, el selector de módulo, los comandos, el formato del lote
de ambiente, la lámpara remota y los límites y errores del audio. No sustituyen
la prueba en hardware.

## Flujo de un comando

`demo.py` (luego, la web) crea una orden -> `comandos.ejecutar(orden)` ->
llama a `lampara` o `figuras` (solo si el comando es del `MODULO` conectado) ->
devuelve `{"ok": True/False, ...}`.
Pines: ver el mapa de pines arriba (lámpara GP13; LED GP6 a GP11; I²S GP18 a GP20).

## Limitaciones conocidas

- Si el WiFi no conecta y no hay envío a Supabase, `main.py` intenta reconectar cada
  5 s y cada intento bloquea el ciclo hasta 15 s: los LED y la lámpara se
  congelan durante ese tiempo. Con el envío activo la reconexión la hace el
  hilo de red y no bloquea.
