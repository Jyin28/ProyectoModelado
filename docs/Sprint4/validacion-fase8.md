# Validación de la fase 8 · Juego de cinco botones

**Resultados reales de la ejecución del 2026-11-18.** Fase 8 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-19.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase7-habitacion` |
| Rama de trabajo | `feat/fase8-juego` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |

Commits: `git log feat/fase7-habitacion..feat/fase8-juego`.

## 1. Qué se construyó

Decisión del plan: el juego es **solo local**. No hay web, tabla, evento ni orden remota; funciona sin WiFi.

- `src/firmware/juego/logica_juego.py`: reglas puras con el azar inyectado. Objetivo al azar entre cinco; cada pulsación (acierto o error) elige otro objetivo distinto del anterior; sigue hasta apagarlo.
- `src/firmware/juego/control_juego.py`: une las reglas con cinco botones, cinco LED y el buzzer sin bloquear. Cuenta una pulsación por acción física (antirrebote y flanco), enciende solo el LED del objetivo y suena solo en acierto durante `JUEGO_RECOMPENSA_MS`. Apagar y volver a encender: mantener a la vez los botones de `JUEGO_COMBO_ONOFF` durante `JUEGO_COMBO_MS`; ese par sostenido no cuenta como jugadas.
- `src/firmware/juego/setup_juego.py`: crea el hardware solo desde `config.py`, rechaza pines repetidos o reservados del WiFi y reutiliza `BuzzerPasivo` del colchón. No toca ningún pin al importarse.
- `src/firmware/common/utilities/entrada.py`: antirrebote compartido (`EntradaEstable`). La habitación lo usa ahora en lugar de su copia.
- `config.py`: `JUEGO_HABILITADO = False`, botones GP2 a GP6 con pull-up, LED GP7 a GP11, buzzer GP14 (los de `diseno-fisico.md` §3.5, **propuestos y sin revisión eléctrica**).
- `modulo.py`: módulo `juego` y `requiere_red()`. `main.py`: con el juego no se conecta al WiFi, no abre el hilo de red y no atiende órdenes; un fallo del juego lo apaga y deja LED y buzzer en bajo.
- Prueba de pines: ahora incluye el grupo `juego` y los exige únicos dentro de ese módulo (GP2 y GP3 coinciden con los de la cuna, aceptable porque la Pico atiende un módulo por vez).

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `python -m unittest discover -s src/firmware/tests` | **322 pruebas, OK** (284 previas + 38) |
| `npm.cmd test` (`supabase`) | **120 pruebas, 120 pasan** (sin cambios) |
| `npm.cmd test` (`src/frontend`) | **26 archivos, 330 pruebas, todas pasan** (sin cambios) |
| `git grep` de patrones de secretos | Sin coincidencias |

La fase no toca Supabase ni la web; esas dos suites se corrieron solo para confirmar que no hubo regresión.

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `test_juego.py` (CPython, pines y buzzer simulados) | Reglas, un objetivo distinto tras cada pulsación, una pulsación por acción física, recompensa solo en acierto, apagado con salidas en bajo, combo, botones activos en alto o bajo | Botones, LED y buzzer reales; rebote real; aleatoriedad real; el ciclo de `main.py` (importa `machine` y no se puede cargar en CPython) |

Todo es evidencia simulada (S). Nada es físico (F).

## 4. Estado de los criterios

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-19.1 | parcial (S) | Un solo LED del objetivo elegido al azar | Hardware real |
| CA-19.2 | parcial (S) | Recompensa solo en acierto; una pulsación por acción | Buzzer real |
| CA-19.3 | parcial (S) | Otro objetivo, distinto del anterior, tras cada pulsación | Azar real en la Pico |
| CA-19.4 | parcial (S) | Sin límite; se apaga con el combo o al terminar el programa | Método de apagado definitivo |
| CA-19.5 | parcial (D) | `diseno-fisico.md` §3.5 (30 mm, piezas fijas) | Elegir y medir los botones; probar la fijación; confirmar la norma |

Ninguno se declara verificado.

## 5. Decisiones y límites

- **Apagado por combo.** El plan pide apagarlo sin fijar cómo. Se propone mantener dos botones durante 2 s porque la maqueta no tiene interruptor; la elección es provisional y está en `config.py`.
- **Arranque.** Con `JUEGO_INICIA_ENCENDIDO = True` el juego empieza al darle corriente.
- **Sin estado en la red.** Nada del juego se informa, por lo que HU-24 no lo incluye. Si el equipo quiere historial del juego, es otra decisión.
- **Pines compartidos.** GP2 a GP6 y GP7 a GP11 se solapan con pines de otros módulos; solo es válido conectando un módulo por vez.
- **Corriente.** Cinco LED con resistencia más el buzzer, alimentados por USB: sin cálculo ni medición eléctrica; falta la revisión del equipo.
- **Prueba B10** de [`protocolo-banco.md`](protocolo-banco.md): sin ejecutar.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Hardware | Cinco pulsadores arcade, cinco LED con resistencia, buzzer pasivo con NPN y 1 kΩ, y cableado revisado |
| Diseño | Dimensiones y fijación de los botones del producto comercial |
| Equipo | Confirmar los pines y el método de apagado |

## 7. Archivos

Creados: `src/firmware/juego/{logica_juego.py, control_juego.py, setup_juego.py}`, `src/firmware/common/utilities/entrada.py`, `src/firmware/tests/test_juego.py`.

Modificados: `src/firmware/main.py`, `src/firmware/common/utilities/{config.py, modulo.py}`, `src/firmware/habitacion/control_habitacion.py` (usa `entrada.py`), `src/firmware/tests/{_ruta, test_config_y_comandos, test_modulo}.py` y `docs/Sprint4/matriz-hu-ca.md` (HU-19: 3 verificados, 105 parciales, 37 pendientes).

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
