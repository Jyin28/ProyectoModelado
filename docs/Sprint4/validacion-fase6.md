# Validación de la fase 6 · Colchón independiente

**Resultados reales de la ejecución del 2026-11-17.** Fase 6 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-14, HU-15 y HU-16.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase5-cuna-figuras` |
| Rama de trabajo | `feat/fase6-colchon` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |
| Node.js / Python | 26.13.1 / 3.15.2 |

Commits: `git log feat/fase5-cuna-figuras..feat/fase6-colchon`.

## 1. Qué se construyó

**Base de datos** (`supabase/migrations/20261118000500_colchon.sql`; solo archivo local):

- `cuna_private.config_colchon` (duración, tolerancia, alarma) con `guardar_config_colchon` y `mi_config_colchon`. Un valor inválido se rechaza con `22023` y conserva lo anterior. Sin valores por defecto.
- `public.ingestar_colchon` (solo `service_role`): recibe `colchon_armado`, `alarma_colchon` y `colchon_detenido` con la credencial del módulo `cuna-colchon-NN`. Valida la forma exacta de cada evento, los guarda en `eventos` (idempotente por `event_id`) y crea aviso por Telegram en la alarma y en la parada.
- El estado visible (`estado_de_modulo`) sale del **último evento** recibido; un evento más antiguo no lo cambia. Una orden `mattress_*` confirmada no cambia el estado: la Pico confirma que acepta medir y el estado llega después con su evento.
- No existe ninguna tabla ni columna de lecturas de peso. Una prueba de esquema lo comprueba.

**Ingesta** (`supabase/functions/ingesta/`): acepta los tres tipos de colchón, los valida antes de la base y traduce `evento_invalido` (400). Se corrigió además `index.ts`: la respuesta `monitoreo_inactivo` de la fase 5 no estaba en su lista de resultados aceptados y habría terminado en 503.

**Contrato**: `src/shared/contracts/colchon.md`.

**Firmware** (`src/firmware/`):

- `mattress_arm` y `mattress_rearm` aceptan `tolerance_pct` y `alarm_s` (sin ellos usan `config.py`); se validan antes de medir (`tolerancia_invalida`, `alarma_invalida`).
- `ControlColchon` anota un evento por cada cambio de estado que hay que informar y los entrega con `sacar_eventos()`. El apagado del programa no se informa. Nunca incluye lecturas de peso.
- `cola_eventos.py` (lógica pura): cola de 8 eventos con `event_id` fijo, reintento con el mismo `event_id`, vencimiento a los 5 minutos y orden de envío. `EnvioAmbiente` la envía desde su único hilo de red y calcula la hora UTC al enviar, restando lo que pasó desde el evento (así un corte de WiFi no pierde ni falsea la hora).
- Credencial `COLCHON_DEVICE_ID` y `COLCHON_TOKEN` en `secrets.example.py` (solo ejemplo, sin valores).
- **Mapa de pines (hallazgo 2 de la fase 2).** El mapa del módulo integrado es el de `config.py` (DT GP17, SCK GP16, buzzer GP14, botón GP15) y es el único que usa `main.py`. El de banco (GP12, GP13, GP18, GP19) queda marcado en `prueba_colchon.py` como solo de banco y no se copió a `config.py`.

**Web** (`src/frontend/`): `/colchon` con configuración, estado según lo que informa la Pico, eventos recientes (consulta cada 5 s) y, solo con `VITE_ORDENES_HABILITADAS=true`, activar, detener y rearmar con referencia nueva. La web no muestra pesos. Módulo configurable con `VITE_COLCHON_DEVICE_ID` (por defecto `cuna-colchon-01`).

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm.cmd test` (`supabase`) | **97 pruebas, 97 pasan** (80 previas + 17 de `colchon.test.mjs`) |
| `npm.cmd test` (`src/frontend`) | **24 archivos, 289 pruebas, todas pasan** |
| `npm.cmd run lint` / `npm.cmd run build` (`src/frontend`) | Sin hallazgos / correcto |
| `python -m unittest discover -s src/firmware/tests` | **257 pruebas, OK** (226 previas + 31 nuevas) |
| `git grep` de patrones de secretos | Solo el token ficticio de `supabase/tests/notificador.test.mjs` |

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `colchon.test.mjs` (PGlite) | Configuración, validación de eventos, avisos, idempotencia, estado por último evento, permisos por rol, ausencia de tablas de peso, manejador de ingesta | Supabase real, concurrencia real, entrega a Telegram |
| `test_colchon_fase6.py`, `test_cola_eventos.py` | Parámetros por armado, motivos de parada, eventos en orden y con tope, cola con reintento y vuelta del contador | HX711, buzzer, botón, TLS ni red reales |
| Pruebas web | Pantalla, validaciones, el estado solo con datos informados, controles tras bandera | Supabase real, hardware |

Todo es evidencia simulada (S). Nada es físico (F).

## 4. Estado de los criterios

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-14.1 | parcial (S) | `colchon_armado` informa la referencia que midió la Pico; la web la muestra solo entonces | Prueba física con HX711 y pesos reales |
| CA-14.2 | parcial (S) | `mattress_stop` desde la web y evento `colchon_detenido` | Supabase y Pico reales |
| CA-14.3 | parcial (S) | Módulo `cuna-colchon-NN` separado, con su pantalla | Alimentación independiente comprobada (HU-29) |
| CA-14.4 | parcial (S) | Sin tablas ni columnas de lecturas de peso; la web no muestra pesos | La alarma envía **un** valor (`ultimo_peso_g`), no una serie |
| CA-14.5 | parcial (S) | Duración, tolerancia y alarma validadas en web, base y firmware | Supabase real |
| CA-15.1 | parcial (S) | Tolerancia editable, guardada y enviada en `mattress_arm` | Pico real |
| CA-15.2 | parcial (S) | `alarma_colchon` crea un aviso por destinatario | Entrega real a Telegram; buzzer sin prueba física con evidencia |
| CA-15.3 | parcial (S) | Sin monitoreo activo no hay evento de alarma | |
| CA-15.4 | parcial (S) | 890 g × 3 dispara y 900 g × 3 no, con tolerancia de config o pedida | Pesos reales en banco y HX711 real |
| CA-16.1 | parcial (S) | Detener desde la app y por botón, con `colchon_detenido` y su motivo | Pico real |
| CA-16.2 | parcial (S) | `mattress_rearm` desde la web, con referencia nueva | Pico real |
| CA-16.3 | parcial (S) | Alarma editable hasta 60 s; se apaga por botón, app o temporizador | Pico real |
| CA-28.4 | parcial (S) | La web muestra el estado que informa la Pico | Corte real |

Ninguno se declara verificado.

## 5. Decisiones y límites

- **El estado viene de eventos, no de confirmaciones de órdenes.** La orden `mattress_arm` devuelve «pendiente» porque la medición de la referencia tarda unas vueltas del ciclo. Por eso el estado se fija con el evento `colchon_armado`, que lleva la referencia ya medida.
- **Estado desactualizado tras un reinicio.** Si la Pico se reinicia con un monitoreo activo, el servidor sigue mostrando el último estado informado. La web lo rotula como «el último estado informado» con su hora. Informar el estado al reconectar queda para la fase 11.
- **Alarma máxima de 60 s.** Es el tope de `config.py` (`COLCHON_ALARMA_MAX_S`); la configuración y la orden lo respetan.
- **Reintento de eventos.** Un evento se reintenta con el mismo `event_id` durante 5 minutos como máximo, con una cola de 8. Pasado ese tiempo o con la cola llena se descarta el más antiguo. Un rechazo definitivo del servidor (por ejemplo, `sin_asignacion`) no se reintenta.
- **Pérdida de WiFi.** El colchón se detiene solo (como antes); el evento `colchon_detenido` con motivo `wifi` sale al reconectar, con su hora real.
- **Memoria y pila del hilo de red.** El hilo de red ahora también envía eventos del colchón; la pila de 12 KiB y la memoria no se midieron en hardware.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Supabase real | Autorización para aplicar las migraciones en `cuna-inteligente-dev` |
| Colchón en banco | HX711, celda de carga, buzzer y botón cableados con el mapa de `config.py`, más `secrets.py` con `COLCHON_DEVICE_ID` y `COLCHON_TOKEN` |
| Entrega de alarmas | Bot de Telegram real y vinculación |

## 7. Archivos

Creados: `supabase/migrations/20261118000500_colchon.sql`, `supabase/tests/colchon.test.mjs`, `src/shared/contracts/colchon.md`, `src/firmware/common/communication/cola_eventos.py`, `src/firmware/tests/{test_colchon_fase6.py, test_cola_eventos.py}`, `src/frontend/src/{models/colchon.ts, utils/colchon.ts, services/colchon.ts, hooks/useEventosColchon.ts, components/PanelColchon.tsx, components/FormularioConfigColchon.tsx}` y dos archivos de prueba web.

Modificados: `supabase/functions/ingesta/{handler.ts, index.ts}`, `supabase/package.json`, `src/firmware/{main.py, secrets.example.py, colchon/{control_colchon,logica_colchon,prueba_colchon}.py, common/communication/ambiente.py, common/utilities/comandos.py}`, `src/firmware/tests/test_config_y_comandos.py` (el doble acepta los parámetros nuevos), `src/frontend/src/{pages/PaginaColchon.tsx, models/ordenes.ts, utils/ordenes.ts, services/{tipos,noConfigurado,configuracion,ordenes}.ts, components/ProveedorServicios.tsx, vite-env.d.ts}`, `src/frontend/.env.example` (`VITE_COLCHON_DEVICE_ID`, sin secretos) y `docs/Sprint4/matriz-hu-ca.md` (HU-01 a HU-16 y filas relacionadas: 3 verificados, 91 parciales, 51 pendientes).

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
