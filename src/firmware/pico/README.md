# Pico 2 W - Colchón + Figuras LED (MicroPython)

La cuna (AM2301, PIR, lámpara, audio) va en la Zero 2 W: ver `../zero/`.

## Estructura

```text
pico/
├─ main.py                      programa principal (ciclo)
├─ secrets.example.py           plantilla de WiFi y nube (copiar a secrets.py)
├─ colchon/
│  ├─ setup_colchon.py          original, SIN modificar (pines, HX711, buzzer, botón)
│  ├─ prueba_colchon.py         original, SIN modificar (menú de pruebas)
│  ├─ peso.py                   tara, calibración (se guarda) y lectura en gramos
│  └─ monitoreo.py              referencia, filtro de 3 lecturas, alarma, parada, rearme
├─ figuras-led/figuras.py       seis LED: uno, todos o secuencias
└─ common/
   ├─ communication/
   │  ├─ wifi.py                conectar, comprobar y reconectar
   │  └─ nube.py                envío de eventos por HTTPS (cola + reintento)
   └─ utilities/
      ├─ config.py              tiempos y parámetros (lo que más editas)
      ├─ comandos.py            ejecuta una orden y devuelve su confirmación
      ├─ demo.py                simula órdenes de la web; MODO_DEMO = False lo apaga
      ├─ eventos.py             hora UTC (NTP) y eventos con id único
      └─ indicador.py           parpadeo del LED interno
```

## Pines
HX711 DT GP13 / SCK GP12 · botón GP19 · buzzer GP18 (en `setup_colchon.py`).
LED de figuras: GP20, 21, 22, 26, 27, 28 (en `config.py`). Provisionales.

## Ciclo de main.py (cada 100 ms)
1. `figuras.actualizar()`
2. `monitoreo.vigilar()`: botón y temporizadores (cada vuelta)
3. si se cae la conexión con monitoreo activo → `detener("connection")`
4. órdenes (demo / web) → `comandos.ejecutar()` → evento `command_ack`
5. cada 1 s: peso → `monitoreo.procesar_lectura()`
6. cada 5 s: revisa WiFi (y la hora)
7. cada 30 s: `heartbeat`
8. envía los eventos pendientes a la nube

## Colchón: flujo de uso
`scale_tare` (vacío) → `scale_calibrate {known_g}` (con peso conocido; se guarda)
→ `mattress_reference` (con la carga apoyada) → `mattress_start`
{duration_s, tolerance_pct, alarm_s}.

* Alarma: 3 lecturas seguidas **por debajo** de `referencia × (1 − tolerancia)`.
  1000 g y 10 %: 890 g ×3 dispara; 900 g ×3 no. Volver al umbral reinicia el conteo.
* Parar la alarma (web `alarm_stop`, botón o temporizador) **detiene el monitoreo y
  borra la referencia**: para volver a empezar hace falta `mattress_reference` otra vez.
* El monitoreo termina solo al vencer `duration_s`.
* Sin WiFi/Internet se detiene; al volver no se reanuda solo.
* `ALARMA_S` por defecto es 60 s (requisito); `setup_colchon.py` trae 5 s de prueba.

Comandos: `led_set, led_all, led_sequence, led_stop, scale_tare, scale_calibrate,
mattress_reference, mattress_start, mattress_stop, alarm_stop, get_status`.

## Probarlo
1. MicroPython en la Pico 2 W. Copia `secrets.example.py` → `secrets.py` y edítalo.
2. Sube a la Pico `main.py`, `secrets.py` y las carpetas `colchon`, `figuras-led`, `common`
   **conservando la estructura**. (`README.md` y `secrets.example.py` no hace falta.)
3. Ejecuta `main.py`. Con `MODO_DEMO = True` corre una secuencia de órdenes de ejemplo.
   En el banco sin red pon `EXIGIR_CONEXION = False`.

## Estado real
* Probada la **lógica** (filtro, alarma, parada, rearme, comandos, cola de envío) con
  hardware simulado en un PC. **No probado en la Pico ni con el circuito montado.**
* Pendiente: recibir órdenes de la web (Supabase Realtime), TLS 1.3 y verificación
  de certificado en MicroPython, y la identidad/credencial del dispositivo.
* El envío HTTPS **bloquea** hasta `HTTP_TIMEOUT_S` (3 s): el botón puede tardar en
  responder justo durante un envío. Por eso el peso se manda cada 5 s y no cada 1 s
  (el requisito dice 1 s). Hay que medir en la Pico si hace falta una conexión persistente.
* `peso.leer_peso()` usa 1 muestra (como el original); el filtro de 3 lecturas lo compensa.
