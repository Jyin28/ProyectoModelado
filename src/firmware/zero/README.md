# Raspberry Pi Zero 2 W - Cuna (Python 3)

El colchón y las figuras LED van en la Pico 2 W: ver `../pico/`.

## Estructura

```text
zero/
├─ main.py                      programa principal (ciclo)
├─ secretos.example.py          plantilla de nube (copiar a secretos.py)
├─ requirements.txt
├─ audio/                       pon aquí los .wav del catálogo
├─ cuna/
│  ├─ sensores.py               AM2301 (temperatura/humedad) y PIR
│  ├─ movimiento.py             detecta el INICIO del movimiento y las alertas
│  ├─ lampara.py                LED blanco regulable 0-100 % (PWM + MOSFET)
│  └─ audio.py                  catálogo .wav por el MAX98357A (aplay)
└─ common/
   ├─ communication/
   │  ├─ red.py                 comprueba que haya Internet
   │  └─ nube.py                envío de eventos por HTTPS en un hilo aparte
   └─ utilities/
      ├─ config.py              pines y tiempos (lo que más editas)
      ├─ comandos.py            ejecuta una orden y devuelve su confirmación
      ├─ demo.py                simula órdenes de la web; MODO_DEMO = False lo apaga
      └─ eventos.py             eventos con id único y hora UTC
```

`secretos.py` (y no `secrets.py`) porque `secrets` ya existe en Python 3.

## Pines (BCM, provisionales)
AM2301 → BCM4 · PIR → BCM17 · MOSFET de la lámpara → BCM12.
I²S del MAX98357A: BCLK BCM18, LRC BCM19, DIN BCM21 (**reservados**).

## Ciclo de main.py (cada 100 ms)
1. cada 10 s: temperatura/humedad → evento `ambient`
2. PIR: al empezar un movimiento → evento `motion_detected` (`alert` = alertas activas)
3. `audio.actualizar()`
4. órdenes (demo / web) → `comandos.ejecutar()` → evento `command_ack`
5. cada 5 s: revisa Internet; si se cae, detiene el audio
6. cada 30 s: `heartbeat`

Comandos: `lamp_set, audio_list, audio_play, audio_stop, motion_alerts, get_status`.

## Instalar y probar (Raspberry Pi OS Lite 64-bit, Bookworm)
```bash
sudo apt install -y python3-gpiozero python3-lgpio python3-requests alsa-utils libgpiod2
sudo pip install adafruit-circuitpython-dht --break-system-packages   # o usa un venv con --system-site-packages
cp secretos.example.py secretos.py     # y edítalo (la nube puede quedar vacía)
python3 main.py                         # Ctrl+C para detener
```
**Audio I²S**: en `/boot/firmware/config.txt` añade `dtoverlay=hifiberry-dac` y
`dtparam=audio=off`, reinicia y comprueba con `aplay -l`. Copia un `audio/demo.wav`
(PCM corto) para que funcione el demo.

**Volumen (parlante 0,5 W)**: crea `~/.asoundrc` (ajusta `card`/`plughw` según `aplay -l`):
```text
pcm.cuna_vol {
    type softvol
    slave.pcm "plughw:0,0"
    control { name "Cuna"; card 0 }
    max_dB -10.0
}
```
y pon `AUDIO_DISPOSITIVO = "cuna_vol"` en `config.py`. Empieza con volumen bajo.

**Arranque automático** (más adelante): un servicio systemd que ejecute `python3 main.py`.

## Estado real
* Probada la **lógica** (comandos, flanco del PIR, cola/reintento de envío contra un
  servidor local, ciclo de main) con hardware simulado. **No probado en la Zero ni con
  AM2301, PIR, MOSFET o MAX98357A reales.**
* Verificar: modelo exacto del AM2301 (la variante AM2301B es I²C), resistencia en serie
  con el LED, y que el IRLZ44N conduzca con 3,3 V.
* Pendiente: recibir órdenes por Supabase Realtime (WSS), voz en vivo, credencial del
  dispositivo. `nube.leer_comandos()` es el punto donde se conectará.
* Los eventos pendientes se descartan si la cola pasa de `COLA_MAX` (no se requiere
  guardar lecturas durante una desconexión).
