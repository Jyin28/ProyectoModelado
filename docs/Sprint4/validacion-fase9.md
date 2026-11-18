# Validación de la fase 9 · Alimentación

**Resultados reales de la ejecución del 2026-11-18.** Fase 9 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-20 a HU-23.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase8-juego` |
| Rama de trabajo | `feat/fase9-alimentacion` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |

Commits: `git log feat/fase8-juego..feat/fase9-alimentacion`.

## 1. Qué se construyó

Decisión del plan: **la web conduce la toma y la Pico pesa cuando se lo piden**. El peso llega como evento, no como resultado de la orden. Las correcciones se auditan en la base.

**Base de datos** (`supabase/migrations/20261118000700_alimentacion.sql`, solo archivo local):

- `public.tomas`, `public.pausas_toma` y `public.correcciones_toma`, sin permisos directos: todo pasa por funciones con control de dueño.
- Funciones `crear_toma`, `pedir_peso_toma`, `iniciar_toma`, `pausar_toma`, `reanudar_toma`, `finalizar_toma`, `cerrar_toma`, `cancelar_toma`, `corregir_toma` y `mis_tomas` (con la hora del servidor para la duración activa).
- `feeding_weigh {toma_id, momento}` se agrega al catálogo de órdenes, pertenece a `cuna-alimentacion-NN` y **no** se puede pedir con `solicitar_orden`: solo la crea `pedir_peso_toma`, para que no existan órdenes de pesaje sueltas.
- `ingestar_alimentacion` recibe `peso_alimentacion`, `peso_alimentacion_fallido` y `temperatura_biberon`. Rechaza momentos que no corresponden al estado de la toma.
- Límites de frío y calor por módulo (`guardar_limites_biberon`, `mis_limites_biberon`) y `evaluar_biberon`: un episodio y un aviso por lado.
- La Edge Function `ingesta` acepta el tipo de alimentación (`handler.ts`, `index.ts`).

**Firmware** (`src/firmware/alimentacion/`):

- `logica_alimentacion.py`: validación pura de `toma_id`, momento, peso (con el mínimo y el máximo de la celda) y temperatura (rechaza 85,0 °C, valor de arranque del DS18B20).
- `control_alimentacion.py`: `feeding_weigh` responde `pendiente` y mide sin bloquear (promedio de `ALIMENTACION_MUESTRAS_PESO` lecturas); deja un evento con gramos o un fallo (`sin_calibracion`, `sin_lectura`). La temperatura se lee cada 30 s con conversión no bloqueante. La tara se toma al encender con la balanza vacía y el factor se guarda en un archivo propio. El control **no tiene ninguna salida**.
- `setup_alimentacion.py` (HX711 GP17/GP16, DS18B20 GP4) y `calibrar_alimentacion.py` (menú local de tara y calibración).
- Cableado: `comandos.py` (`feeding_weigh`), `modulo.py`, `ambiente.py` (credencial `cuna-alimentacion-NN`), `main.py`, `secrets.example.py` (sin valores). Apagado por defecto: `ALIMENTACION_HABILITADO = False`.

**Web** (`/alimentacion`):

- `PanelToma`: pasos según el estado, duración activa que avanza solo con la toma en curso, botones de pesaje solo con `VITE_ORDENES_HABILITADAS=true`, mensajes fijos para `toma_sin_peso_inicial`, `toma_incompleta`, `estado_toma_invalido`, etc.
- `HistorialTomas` y `FormularioCorreccionToma`: gramos, duración, pausas y correcciones con valor anterior, nuevo, autor («Tú» u «Otro dueño»), fecha de Costa Rica y motivo obligatorio.
- `PanelTemperaturaBiberon` («Sin datos» o «Desactualizado» a los 120 s) y `PanelLimitesBiberon`.
- `PanelHorarios` con `recordatorio_alimentacion`, ahora con la aclaración de que es solo un aviso.
- Contratos: nuevo [`alimentacion.md`](../../src/shared/contracts/alimentacion.md) y `feeding_weigh` en [`ordenes.md`](../../src/shared/contracts/ordenes.md).

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `python -m unittest discover -s src/firmware/tests` | **361 pruebas, OK** (322 previas + 39) |
| `npm.cmd test` (`supabase`) | **151 pruebas: 149 pasan y 2 fallan** (120 previas + 31). Las dos fallas son de `notificador.test.mjs`, ver §5. |
| `npm.cmd test` (`src/frontend`) | **28 archivos, 380 pruebas, todas pasan** (26 archivos y 330 pruebas previos + 2 archivos y 50 pruebas) |
| `npm.cmd run lint` y `npm.cmd run build` (`src/frontend`) | Sin errores |
| `git grep` de patrones de secretos | Sin coincidencias |

`alimentacion.test.mjs` aislado: 31 pruebas, todas pasan.

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `alimentacion.test.mjs` (PGlite) | Flujo completo de la toma, pausas que no suman, 13 min activos y 50 g del ejemplo del criterio, correcciones auditadas sin exponer al autor, cierre incompleto rechazado, pesos solo en el estado correcto, episodios de frío y de calor con un aviso cada uno, permisos | RLS ni funciones en un Supabase real; Telegram real |
| `test_alimentacion.py` (CPython, dobles de HX711, DS18B20 y almacén) | Pesaje por orden con evento de gramos o de fallo, sin calibración, sin lectura, un pesaje a la vez, tope de eventos, temperatura sin bloquear, 85,0 °C descartado, comandos y rechazo en otros módulos, control sin salidas | Celda de carga, HX711 ni sonda reales; el ciclo de `main.py` (importa `machine`) |
| `alimentacion-fase9.test.tsx` y `alimentacion-servicios.test.ts` (Supabase simulado) | Pasos, botones y mensajes por estado, correcciones con motivo, límites, temperatura, recordatorios, ausencia de controles de calor o frío, servicio y validaciones | Una sesión ni una base reales |

Todo es evidencia simulada (S). Nada es físico (F).

## 4. Estado de los criterios

Detalle en [`matriz-hu-ca.md`](matriz-hu-ca.md): los 19 criterios de HU-20 a HU-23 quedan **parciales (S)**; ninguno se declara verificado. Conteo global: verificado 3, parcial 122, pendiente 20, bloqueado 0 (suma 145).

## 5. Decisiones y límites

- **CA-20.2, botón de inicio.** El criterio nombra un botón; la maqueta no lo tiene. La toma se inicia desde la web con la hora del servidor. Un botón físico requeriría pin, antirrebote y una orden hacia la web: queda como decisión del equipo.
- **Fallas de `notificador.test.mjs`.** Dos pruebas fallan en esta ejecución. Ya fallaban de forma intermitente antes de la fase 9: el archivo carga solo tres migraciones tempranas, así que no ve ningún cambio de esta fase, y la aserción compara el orden de avisos con la misma marca de tiempo. No se corrigió porque está fuera del alcance de la fase; hay que arreglarla en la fase 10 o antes.
- **Recipiente.** El mensaje de `toma_sin_peso_inicial` pide colocar el mismo recipiente del pesaje final (CA-20.4), pero el sistema no puede comprobar que lo sea.
- **Temperatura desactualizada a los 120 s.** La Pico mide cada 30 s; con el umbral de 30 s de las lecturas de ambiente, la lectura parpadearía entre «al día» y «Desactualizado». El umbral es una constante (`TEMP_BIBERON_UMBRAL_S`).
- **Pesaje sin resultado.** El peso solo aparece en la toma cuando su evento llega al servidor; la confirmación de la orden («Confirmada por la Pico») significa que la Pico la recibió, no que midió.
- **Balanza.** Tara al encender con la balanza vacía y factor guardado en un archivo propio (no el del colchón). Sin pesa conocida ni medición real, el factor es el único dato pendiente.
- **Pines compartidos.** GP4, GP16 y GP17 se solapan con pines de otros módulos; solo es válido conectando un módulo por vez. Sin revisión eléctrica.
- **Pruebas B1 a B3 (pesaje, con la celda de 1 kg propuesta) y B7 (temperatura del biberón)** de [`protocolo-banco.md`](protocolo-banco.md): sin ejecutar.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Hardware | Celda de carga con HX711, pesa de peso conocido, sonda DS18B20 con resistencia de 4,7 kΩ y soporte de biberón |
| Calibración | Factor real, estabilidad de la lectura y fijación del recipiente |
| Supabase | Autorización para aplicar la migración en `cuna-inteligente-dev` y probar contra la API real |
| Equipo | Decidir el botón físico de inicio y el umbral de temperatura desactualizada |

## 7. Archivos

Creados: `supabase/migrations/20261118000700_alimentacion.sql`, `supabase/tests/alimentacion.test.mjs`, `src/firmware/alimentacion/{logica_alimentacion.py, control_alimentacion.py, setup_alimentacion.py, calibrar_alimentacion.py}`, `src/firmware/tests/test_alimentacion.py`, `src/frontend/src/{models/alimentacion.ts, utils/alimentacion.ts, services/alimentacion.ts, hooks/useTomas.ts, pages/PaginaAlimentacion.tsx}`, `src/frontend/src/components/{PanelToma, HistorialTomas, FormularioCorreccionToma, EstadoPesaje, PanelLimitesBiberon, PanelTemperaturaBiberon}.tsx`, `src/frontend/tests/{alimentacion-fase9.test.tsx, alimentacion-servicios.test.ts}`, `src/shared/contracts/alimentacion.md`.

Modificados: `supabase/functions/ingesta/{handler.ts, index.ts}`, `supabase/package.json`, `src/firmware/main.py`, `src/firmware/secrets.example.py`, `src/firmware/common/communication/ambiente.py`, `src/firmware/common/utilities/{comandos.py, config.py, modulo.py}`, `src/firmware/tests/{_ruta, test_config_y_comandos, test_modulo}.py`, `src/frontend/src/{App.tsx, vite-env.d.ts, models/ordenes.ts}`, `src/frontend/src/components/{Layout, PanelHorarios, ProveedorServicios}.tsx`, `src/frontend/src/services/{configuracion, noConfigurado, ordenes, tipos}.ts`, `src/frontend/{.env.example, tests/rutas.test.tsx}`, `src/shared/contracts/ordenes.md` y `docs/Sprint4/matriz-hu-ca.md`.

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
