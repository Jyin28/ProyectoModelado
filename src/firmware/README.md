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
│  ├─ setup_colchon.py          original, SIN modificar
│  └─ prueba_colchon.py         original, SIN modificar
├─ cuna/
│  └─ lampara.py                LED blanco regulable 0-100 % (PWM + MOSFET)
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

## Notas sobre tus archivos originales (no los toqué)

- `setup_colchon.py` usa GP24 (buzzer) y GP25 (botón): esos pines no sirven en la Pico W (los usa el WiFi).
- `prueba_colchon.py` hace `import setup`, pero el archivo se llama `setup_colchon`.
Por eso el colchón aún no está conectado a `main.py`.

## Flujo de un comando

`demo.py` (luego, la web) crea una orden -> `comandos.ejecutar(orden)` ->
llama a `lampara` o `figuras` -> devuelve `{"ok": True/False, ...}`.
Pines nuevos (provisionales): lámpara GP13; LED GP18, 19, 20, 21, 22 y 26.
