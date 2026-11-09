# Esqueleto básico - Pico 2 W

Versión simple para ver un avance. Todavía no envía nada a Internet.

## Archivos (todo va en la RAÍZ de la Pico, salvo `colchon/`)

| Archivo | Para qué sirve |
|---|---|
| `main.py` | Programa principal: arranca, conecta WiFi y repite un ciclo |
| `config.py` | Pines y tiempos (lo único que normalmente editas) |
| `secrets.example.py` | Plantilla: cópiala como `secrets.py` y pon tu WiFi |
| `wifi.py` | Conectar, comprobar y reconectar el WiFi |
| `sensores.py` | AM2301 (temperatura/humedad) y PIR (movimiento) |
| `indicador.py` | Parpadeo del LED interno de la Pico |
| `colchon/setup_colchon.py` | Original, SIN modificar |
| `colchon/prueba_colchon.py` | Original, SIN modificar |

## Línea de ejecución de main.py

1. `iniciar()`: parpadea 3 veces, conecta al WiFi (1 parpadeo largo = ok, 5 rápidos = falló).
2. `ciclo_principal()` repite cada 100 ms:
   - cada 10 s: lee temperatura y humedad y las imprime
   - siempre: avisa si el PIR detecta movimiento
   - cada 5 s: revisa el WiFi y reconecta si se cayó

## Cómo probarlo

1. Instala MicroPython en la Pico 2 W.
2. Copia `secrets.example.py` a `secrets.py` y edítalo.
3. En Thonny, guarda en la Pico: `main.py`, `config.py`, `secrets.py`, `wifi.py`, `sensores.py`, `indicador.py`.
4. Abre `main.py` y pulsa Run. Sin sensores conectados verás "Error leyendo AM2301": es normal.

## Notas sobre tus archivos originales (no los toqué)

- `setup_colchon.py` usa GP24 (buzzer) y GP25 (botón): esos pines no sirven en la Pico W (los usa el WiFi).
- `prueba_colchon.py` hace `import setup`, pero el archivo se llama `setup_colchon`.
Por eso el colchón aún no está conectado a `main.py`.
