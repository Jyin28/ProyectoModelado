# Esqueleto básico - Pico 2 W

Versión simple para ver un avance. Todavía no envía nada a Internet.

## Estructura

```text
firmware/
├─ README.md
├─ main.py                      programa principal
├─ secrets.example.py           plantilla de WiFi (copiar a secrets.py)
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
   ├─ communication/wifi.py     conectar, comprobar y reconectar el WiFi
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
   - cada 10 s: lee temperatura y humedad y las imprime
   - siempre: avisa si el PIR detecta movimiento
   - siempre: `figuras.actualizar()` mueve la secuencia de LED si hay una activa
   - modo demo: `demo.actualizar()` ejecuta la siguiente orden de ejemplo
   - cada 5 s: revisa el WiFi y reconecta si se cayó

## Cómo probarlo

1. Instala MicroPython en la Pico 2 W.
2. Copia `secrets.example.py` a `secrets.py` y edítalo.
3. Sube a la Pico `main.py`, `secrets.py` y las carpetas `colchon`, `cuna`, `figuras-led` y `common`
   **conservando la estructura** (en Thonny: crea las carpetas en la Pico y guarda cada archivo dentro).
   No hace falta subir `README.md` ni `secrets.example.py`.
4. Abre `main.py` y pulsa Run. Sin sensores conectados verás "Error leyendo AM2301": es normal.

## Notas sobre tus archivos originales (no los toqué)

- `setup_colchon.py` usa GP24 (buzzer) y GP25 (botón): esos pines no sirven en la Pico W (los usa el WiFi).
- `prueba_colchon.py` hace `import setup`, pero el archivo se llama `setup_colchon`.
Por eso el colchón aún no está conectado a `main.py`.

## Flujo de un comando

`demo.py` (luego, la web) crea una orden -> `comandos.ejecutar(orden)` ->
llama a `lampara` o `figuras` -> devuelve `{"ok": True/False, ...}`.
Pines nuevos (provisionales): lámpara GP13; LED GP18, 19, 20, 21, 22 y 26.
