# Validación de la fase 5 · Cuna y figuras

**Resultados reales de la ejecución del 2026-11-17.** Fase 5 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-08 a HU-13 y las partes de HU-07 que dependen de los límites.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase4-avisos` |
| Rama de trabajo | `feat/fase5-cuna-figuras` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |
| Node.js / Python | 26.13.1 / 3.15.2 |

Commits: `git log feat/fase4-avisos..feat/fase5-cuna-figuras`.

## 1. Qué se construyó

**Base de datos** (`supabase/migrations/20261118000400_ordenes_modulo.sql`; solo archivo local):

- `public.ordenes_modulo`: una tabla de órdenes para todos los módulos de la cuna. Ciclo pendiente → enviado → confirmado o error, vencimiento a los 15 s. Comandos: `led_set`, `led_all`, `led_sequence`, `led_stop`, `audio_play`, `audio_stop`, `motion_set` y los de colchón (`mattress_*`, que se completan en la fase 6). Los parámetros se validan en la base con los mismos rangos que `comandos.py`.
- Entrega por canal de producto `modulo:<producto_id>`. La Pico toma la orden más antigua vigente con `tomar_orden_modulo` y la confirma con `confirmar_orden_modulo`.
- `cuna_private.estado_modulo`: último estado que la Pico confirmó. Es lo único que la web muestra como aplicado.
- `cuna_private.limites_ambiente`, `guardar_limites`, `mis_limites`; `evaluar_limites` abre un episodio al salir del rango y avisa una vez por episodio (CA-07.5, CA-10.2).
- Monitoreo de movimiento: `ingestar_movimiento` responde `monitoreo_inactivo` si la última confirmación dice que está apagado, y crea evento y aviso al registrar un movimiento.
- `procesar_horarios` también genera órdenes para los horarios de figuras (`figuras_encender`, `figuras_apagar`) y de monitoreo (`movimiento_activar`, `movimiento_desactivar`).
- Voz: canal privado `voz:<producto>` con políticas de `realtime.messages` (solo dueños activos envían; solo la cuenta del módulo recibe). Nada se persiste. `registrar_actividad_voz` guarda solo el inicio y el fin como actividad.

**Contratos** (`src/shared/contracts/`): `ordenes.md`, `voz.md`, `limites.md`.

**Firmware** (`src/firmware/`):

- `ordenes_remotas.py`: cliente WSS por producto, `Grupo` con la lámpara bajo un solo hilo de red. El hilo de red no toca actuadores.
- `comandos.py`: `motion_set` (error `movimiento_no_habilitado` si la bandera local está apagada) y `audio_play` rechazado mientras hay voz.
- `cuna/voz.py`: recibe fragmentos PCM, los amplía y los entrega; se detiene con `voz_fin`, a los 2 s sin datos o al perder la conexión.
- `figuras.py`: PWM con rampas de 400 ms (sin destellos). `rampa.py` nuevo.
- Parada segura al perder la conexión: figuras apagan la secuencia; cuna detiene el audio.

**Web** (`src/frontend/`):

- Servicios `ordenes`, `limites`, `horarios` y `voz` (`services/ordenes.ts`), hook `useOrdenModulo` (consulta cada 2 s, sin estado optimista) y `useVoz`.
- `/figuras`: encender y apagar todos, un LED, secuencia con intervalo de 2 a 3600 s, detener, horarios.
- `/cuna`: límites de ambiente, monitoreo de movimiento (manual y por horario), audio y voz.
- Los controles que operan hardware están detrás de `VITE_ORDENES_HABILITADAS` (figuras, audio, monitoreo) y `VITE_VOZ_HABILITADA` (voz). Ambas están apagadas por defecto y solo el valor exacto `true` las activa.
- Los límites se muestran con backend y sesión, sin valores por defecto.

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm.cmd test` (`supabase`) | **80 pruebas, 80 pasan** (66 previas + 13 de `ordenes-modulo.test.mjs` + 1 de manejador) |
| `npm.cmd test` (`src/frontend`) | **22 archivos, 247 pruebas, todas pasan** |
| `npm.cmd run lint` / `npm.cmd run build` (`src/frontend`) | Sin hallazgos / correcto |
| `python -m unittest discover -s src/firmware/tests` | **226 pruebas, OK** (171 previas + 55 nuevas) |
| `git grep` de patrones de secretos | Solo el token ficticio de `supabase/tests/notificador.test.mjs` |

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `ordenes-modulo.test.mjs` (PGlite) | Ciclo de la orden, validación de parámetros, permisos por rol, límites, episodios, monitoreo, horarios de figuras, políticas de canal | Realtime real, concurrencia real, `pg_cron`, Supabase real |
| Pruebas de firmware | Lógica con dobles: validación, confirmación, rampas, voz, parada segura | I²S, PWM, memoria con dos clientes WSS, TLS en la Pico |
| Pruebas web | Pantallas y servicios con dobles; el estado solo cambia con confirmación; validaciones; conversión de voz a PCM de 8 kHz | Micrófono y AudioWorklet reales, Supabase real, hardware |

Todo lo anterior es evidencia simulada (S). Nada es físico (F).

## 4. Estado de los criterios

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-08.1 | parcial (S) | Activación manual y por horario desde la web; `motion_set` en firmware; el backend omite movimientos con el monitoreo apagado | Prueba con PIR y Pico reales |
| CA-08.2 | parcial (S) | Un movimiento registrado crea evento y aviso con la hora | Entrega real a Telegram |
| CA-08.3 | parcial (S) | Apagado: no se registra ni se avisa (`monitoreo_inactivo`) | Si la Pico se reinicia vuelve a apagado sin avisar al backend (fase 11) |
| CA-09.1 a CA-09.3 | parcial (S) | Sin cambios respecto de la línea base | Supabase real y AM2301 real |
| CA-10.1 | parcial (S) | Límites por módulo; sin valores por defecto | Prueba con Supabase real |
| CA-10.2 | parcial (S) | Salir del rango abre un episodio y avisa una vez | Entrega real |
| CA-10.3 | parcial (S) | La web muestra los límites guardados en el servidor | |
| CA-10.4 | parcial (S) | Mínimo igual o mayor que máximo se rechaza en la web y en la base; se conserva el límite anterior | |
| CA-11.1 | parcial (S) | Ciclo de órdenes de lámpara intacto | Realtime real y Pico real |
| CA-11.2 | parcial (S) | `audio_play` por orden remota con confirmación | I²S real |
| CA-11.3 | parcial (S) | La confirmación de `audio_play` registra un evento de audio sin sonido | |
| CA-11.4 | parcial (S) | Selector con el catálogo real: **solo `tono_suave`** | No existen sonidos pregrabados; no se inventaron |
| CA-12.1 a CA-12.3 | parcial (S) | Canal privado, PCM de 16 bits a 8 kHz, fragmentos de 40 ms; solo se registra inicio y fin; la web avisa que no se graba | **Sin prueba con micrófono, red y parlante reales.** Latencia y memoria sin medir |
| CA-13.1, CA-13.2 | parcial (S) | Encender, apagar, un LED y secuencias desde la web | Pico y LED reales |
| CA-13.3 | parcial (S) | Figuras separadas de los otros módulos | Demostración física |
| CA-13.4 | parcial (S) | Intervalo menor que 2 s se rechaza en web, base y firmware; rampas de 400 ms | Transiciones sin medir en LED reales |

Ninguno se declara verificado.

## 5. Decisiones y límites

- **Una cuenta por Pico, un canal por producto.** Todos los módulos lógicos de un producto reciben por `modulo:<producto_id>`; la orden lleva el `device_id` del módulo.
- **Voz por Realtime, PCM.** Es una suposición sin probar que los mensajes de difusión de los clientes no se guardan en `realtime.messages` (anotado en `voz.md`). Hay que confirmarlo con Supabase real.
- **Latencia de voz.** Mientras la voz está activa, el ciclo principal pasa de pausas de 50 ms a 20 ms. Es una hipótesis para el banco.
- **Memoria.** Con lámpara y órdenes la Pico mantiene dos clientes; `Grupo` los une bajo un hilo. Riesgo de memoria sin comprobar.
- **Catálogo de audio.** Solo `tono_suave` (sintetizado). Agregar canciones o ruido blanco requiere archivos reales que el proyecto no tiene.
- **Lecturas fuera de orden.** Una lectura de ambiente atrasada puede cerrar un episodio antes de tiempo.
- **Horarios vencidos se omiten** (DEC-04, DEC-10), como en la fase 4.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Realtime real | Aplicar las migraciones en `cuna-inteligente-dev` (requiere autorización) |
| Pico | `secrets.py` con las claves `ORDENES_*` (ver `secrets.example.py`) y prueba en banco |
| Voz | Micrófono del navegador, parlante I²S y medición de latencia (prueba P2) |
| Audio | Sonidos pregrabados, si se quieren más que el tono |

## 7. Archivos

Creados: `supabase/migrations/20261118000400_ordenes_modulo.sql`, `supabase/tests/ordenes-modulo.test.mjs`, `src/shared/contracts/{ordenes,voz,limites}.md`, `src/firmware/common/communication/ordenes_remotas.py`, `src/firmware/common/utilities/rampa.py`, `src/firmware/cuna/voz.py`, cuatro archivos de prueba de firmware, `src/frontend/src/{models,utils}/ordenes.ts`, `src/frontend/src/utils/voz.ts`, `src/frontend/src/services/ordenes.ts`, `src/frontend/src/hooks/{useOrdenModulo,useVoz}.ts`, siete componentes (`EstadoOrdenModulo`, `PanelAudio`, `PanelFiguras`, `PanelHorarios`, `PanelLimites`, `PanelMonitoreoMovimiento`, `PanelVoz`) y tres archivos de prueba web.

Modificados: `supabase/functions/ingesta/handler.ts`, `supabase/package.json`, `src/firmware/{main.py, common/utilities/{config,modulo,comandos}.py, figuras-led/figuras.py, secrets.example.py}`, `src/frontend/src/{pages/PaginaCuna.tsx, pages/PaginaFiguras.tsx, components/ProveedorServicios.tsx, services/{tipos,noConfigurado,configuracion}.ts, vite-env.d.ts}`, `src/frontend/.env.example` y dos pruebas web existentes (ahora simulan los límites, que la pantalla Cuna consulta).

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
