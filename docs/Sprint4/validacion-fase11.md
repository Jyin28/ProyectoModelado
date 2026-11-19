# Validación de la fase 11 · Recuperación, rendimiento, privacidad y uso web

**Resultados reales de la ejecución del 2026-11-18.** Fase 11 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-28, HU-30, HU-34 y HU-35.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase10-historial` |
| Rama de trabajo | `feat/fase11-recuperacion` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |

Commits: `git log feat/fase10-historial..feat/fase11-recuperacion`.

## 1. Qué se construyó

**Backend (`supabase/migrations/20261118000900_recuperacion.sql`, probada con PGlite):**

- `public.reportar_estado_modulo(p_estado jsonb)`: la cuenta de dispositivo informa el estado real de su módulo al conectarse o reconectarse. Antes, tras reiniciar la Pico, el servidor seguía mostrando el último estado confirmado (por ejemplo «monitoreo activo») y seguía aceptando eventos de un monitoreo que ya no existía. Solo acepta las claves `monitoreo`, `monitoreo_puerta`, `monitoreo_movimiento`, `secuencia` y `colchon`; cualquier otra cosa se rechaza entera con `estado_invalido`. Contrato en [`ordenes.md`](../../src/shared/contracts/ordenes.md).
- `cuna_private.actualizar_episodio`: una lectura de ambiente anterior o igual a lo último que se sabe de esa variable ya no cierra ni reabre un episodio (corrige un defecto que existía desde la fase 4).
- `public.avisos_pendientes`: orden de entrega estable (antes el desempate era un UUID aleatorio, de ahí la falla intermitente de `notificador.test.mjs` que en la fase 10 se arregló solo en la prueba).

**Migración sin probar (`20261118001000_notificador_inmediato.sql`):** disparador por sentencia con `pg_net` que invoca al notificador cuando se crean avisos, para no depender del cron de 1 minuto (HU-30 pide 5 s). Necesita `pg_net` y Vault, que PGlite no tiene: **no se ejecutó en ninguna prueba**. El cron queda como respaldo.

**Firmware (`src/firmware/`):** `comandos.estado_para_nube()` arma el estado reportable; `OrdenesRemotas` lo informa antes de tomar órdenes tras cada unión al canal (hasta 3 intentos; si fallan, no bloquea las órdenes). Un corte durante el reporte lo deja pendiente para la sesión siguiente.

**Web:** el panel del colchón entiende el motivo `reinicio` («Monitoreo detenido al reiniciarse o reconectarse el módulo») y su aviso explica que la Pico informa su estado real al reconectarse.

**Pruebas nuevas:** `supabase/tests/recuperacion.test.mjs` (12), `supabase/tests/privacidad.test.mjs` (8), `src/firmware/tests/test_recuperacion_firmware.py` (17 pruebas) y una fila nueva en `tests/colchon-fase6.test.tsx`. `supabase/scripts/rendimiento.mjs` es una medición fuera de la suite (`npm run rendimiento`).

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm test` en `supabase` | 184 pruebas, 184 correctas |
| `python -m unittest discover -s src/firmware/tests` | 378 pruebas, correctas |
| `npx vitest run` en `src/frontend` | 32 archivos, 434 pruebas, correctas |
| `npm run lint` en `src/frontend` | sin errores |
| `npm run build` en `src/frontend` | compila; el paquete principal pesa 797 kB (232 kB comprimido) y `write-excel-file` se carga aparte (70 kB) |
| `git grep` de patrones de secretos | solo el token ficticio de `notificador.test.mjs` (de prueba, ya existente) |

### Medición de rendimiento (`node scripts/rendimiento.mjs`)

Escenario: 2 cuentas, 2 bebés, 6 módulos y 1000 registros (ingesta de los 1000 en 1.3 s). Consultas hechas dos a la vez, una por cuenta.

| Medida | Objetivo | Resultado |
|---|---|---|
| 100 consultas de `historial_bebe` (400 a 1000 registros cada una) | al menos 95 en 3000 ms o menos | 100 de 100; mediana 32.8 ms, p95 42.5 ms, máximo 55.7 ms |
| 100 solicitudes de envío desde la recepción del evento hasta la llamada al envío | al menos 95 en 5000 ms o menos | 100 de 100; mediana 2.6 ms, p95 4.7 ms, máximo 37.1 ms |

## 3. Qué acreditan estas ejecuciones

Acreditan la lógica y el costo de las consultas **en PGlite**: base en memoria, un solo proceso y una sola conexión, sin red, sin PostgREST, sin `pg_net`, sin Telegram y sin una Pico. **No son tiempos del Supabase real ni de la demostración.** La solicitud a Telegram se midió con un envío simulado: la entrega externa no se midió. Todas las pruebas de firmware usan dobles y reloj simulado.

## 4. Estado de los criterios

Ver [`matriz-hu-ca.md`](matriz-hu-ca.md). Resumen tras esta fase: 3 verificados (solo documentales), 135 parciales, 7 pendientes, 0 bloqueados; total 145.

- **CA-28.2 a CA-28.4:** parcial (S). Sin reinicio ni corte real.
- **CA-30.1 y CA-30.2:** parcial (S y D). CA-30.2 depende de un disparador que nunca se ejecutó.
- **CA-30.3 y CA-30.4:** parcial (S): simulación del ciclo, no medición en la Pico.
- **CA-34.1 a CA-34.5:** parcial (S). Falta la API real.
- **CA-35.1 y CA-35.3:** siguen **pendientes**. No se hizo el recorrido en un navegador a 360 y 1280 px. Lista de comprobación manual en §6.
- **CA-35.2:** parcial, sin cambios.

## 5. Decisiones, defectos y límites

- **Defecto encontrado y corregido:** una lectura atrasada dentro de rango cerraba un episodio fuera de rango con una hora anterior a su apertura, y una atrasada fuera de rango abría uno ya cerrado (con un aviso de más). Cubierto por `recuperacion.test.mjs`.
- **Defecto encontrado y corregido:** el orden de los avisos de un mismo evento cambiaba entre ejecuciones.
- **Decisión:** un colchón informado `detenido` al reconectar queda con motivo `reinicio` sin tocar `colchon_ts`, de modo que un evento de parada anterior que llegue tarde todavía puede precisar el motivo real; si ya figuraba detenido, se conserva su motivo. `activo` y `alarma` no se escriben desde el reporte.
- **Límite:** la Pico informa su estado, pero el servidor no sabe si una Pico dejó de conectarse sin avisar; eso lo cubre el aviso «Desactualizado» de la web a los 30 s (CA-28.4), no esta función.
- **Límite:** el reporte lo hace el hilo de red y lee el estado del hilo principal sin bloqueo; son lecturas de valores simples, sin comprobar en una Pico real.
- **A confirmar con el equipo:** si el disparador con `pg_net` es aceptable como mecanismo del aviso inmediato, y si la creación del disparador cabe dentro de lo autorizado sobre `cuna-inteligente-dev`.

## 6. HU-35 · Lista de comprobación manual pendiente

Abrir la web con `npm.cmd run dev` y revisar a 360 px y a 1280 px de ancho (herramientas de desarrollo del navegador):

1. Iniciar sesión, elegir un bebé y abrir cada pantalla (`/cuna`, `/bebes`, `/colchon`, `/figuras`, `/habitacion`, `/habitacion/camara`, `/alimentacion`, `/historial`).
2. Sin desplazamiento horizontal de la página en ninguna de ellas.
3. Tablas y gráficos del historial legibles; la tabla desplaza dentro de su contenedor.
4. Botones y campos con tamaño táctil usable a 360 px.
5. Un error de red muestra el mensaje fijo, sin datos inventados.

Hasta que alguien lo haga, CA-35.1 y CA-35.3 no se declaran cumplidos.

## 7. Bloqueos y recursos que faltan

- Acceso autorizado a `cuna-inteligente-dev` para aplicar las migraciones 000900 y 001000 y repetir las mediciones.
- Una Pico real para comprobar el reporte de estado tras un reinicio.
- Una persona que haga el recorrido de HU-35 en un navegador.

## 8. Archivos

- `supabase/migrations/20261118000900_recuperacion.sql`, `20261118001000_notificador_inmediato.sql`
- `supabase/tests/recuperacion.test.mjs`, `privacidad.test.mjs`, `_base.mjs` (ayudas `tokenDe` y `cuentaDispositivo`)
- `supabase/scripts/rendimiento.mjs`, `supabase/package.json`
- `src/firmware/common/utilities/comandos.py`, `common/communication/ordenes_remotas.py`, `main.py`, `tests/test_recuperacion_firmware.py`
- `src/frontend/src/models/colchon.ts`, `components/PanelColchon.tsx`, `tests/colchon-fase6.test.tsx`
- `src/shared/contracts/ordenes.md`, `docs/Sprint4/matriz-hu-ca.md`
