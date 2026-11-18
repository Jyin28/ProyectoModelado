# Validación de la fase 10 · Historial, resumen nocturno, gráficos y Excel

**Resultados reales de la ejecución del 2026-11-18.** Fase 10 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-24 a HU-27.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase9-alimentacion` (con `development` fusionado, ver §6) |
| Rama de trabajo | `feat/fase10-historial` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |

Commits: `git log feat/fase9-alimentacion..feat/fase10-historial`.

## 1. Qué se construyó

**Base de datos** (`supabase/migrations/20261118000800_historial.sql`, solo archivo local):

- `public.historial_bebe(bebe, desde, hasta)`: una consulta de lectura que une `eventos`, `lecturas_ambiente` (dos registros por lectura) y `eventos_movimiento` (solo los que no están ya en `eventos`). Filtra por `bebe_id`, exige poder ver al bebé, usa el intervalo `[desde, hasta)`, rechaza intervalos de más de 31 días y limita la respuesta a 20000 registros con un indicador `truncado`.
- Agrega a cada registro los datos de la toma (pesos, cantidad corregida y duración activa del servidor) y la foto, esta última solo para dueños del módulo.
- Contrato: [`historial.md`](../../src/shared/contracts/historial.md).

**Web** (`/historial`, antes un marcador):

- Formulario con bebé, fecha y horas de inicio y fin de Costa Rica; el fin cae al día siguiente si no es posterior al inicio. Atajos «Última noche (19:00 a 07:00)» y «Últimas 24 horas».
- `ResumenNoche`: registros, movimientos y hora de mayor actividad, rangos de temperatura y humedad, tomas y fotos. Un intervalo sin registros dice «No hay registros entre … y …» y no muestra ceros.
- `GraficoEventosPorHora` (barras recharts y tabla equivalente): intervalos `[inicio, fin)`, «Sin datos» distinto de «0».
- `GraficoMediciones` (líneas recharts por tipo, con fecha, hora y unidad): la línea se corta ante huecos de más de 30 minutos y se reduce a 600 puntos conservando mínimos y máximos.
- `ListaRegistros` con «Ver foto» (enlace firmado de 60 s, solo si el servidor entregó la foto) y `BotonExportar` (.xlsx con `write-excel-file`, cargada solo al exportar; no exporta un resultado truncado).
- Dependencias nuevas: `recharts` y `write-excel-file`.

**Corrección de deuda:** la falla intermitente de `notificador.test.mjs` venía de comparar el orden de dos avisos con la misma marca de tiempo (el desempate era un UUID aleatorio). La prueba compara ahora el conjunto de la primera pasada y la tercera por separado. No cambia el código del notificador (el orden estable en SQL queda para la fase 11).

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `python -m unittest discover -s src/firmware/tests` | **361 pruebas, OK** (sin cambios) |
| `npm test` (`supabase`) | **164 pruebas, todas pasan** (151 previas + 13 de `historial.test.mjs`) |
| `npm test` en `supabase/tests/notificador.test.mjs`, tres ejecuciones seguidas | 15 pruebas, todas pasan las tres veces |
| `npx vitest run` (`src/frontend`) | **32 archivos, 433 pruebas, todas pasan** (28 archivos y 380 pruebas previos + 4 archivos y 53 pruebas) |
| `npm run lint` y `npm run build` (`src/frontend`) | Sin errores |
| `git grep` de patrones de secretos | Sin credenciales; solo texto de documentos que nombra los patrones y contraseñas de ejemplo de `secrets.example.py` |

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `historial.test.mjs` (PGlite) | Permisos (sin sesión, ajeno, bebé inexistente), intervalo inválido, intervalo vacío, dos bebés separados, reasignación a mitad del intervalo, ambiente en dos registros con unidad, límites del intervalo, movimiento sin doble conteo, datos de toma con corrección, foto solo para dueño, noche que cruza la medianoche en Costa Rica, tope de 20000 con `truncado`, solo lectura | RLS ni funciones en un Supabase real; rendimiento (fase 11) |
| `historial-utils.test.ts` | Conversión de Costa Rica a UTC, noche que cruza la medianoche, conteo por hora con el caso 08:15, 08:59 y 09:00, «sin datos» frente a «0», cortes de línea, reducción que conserva extremos, resumen, filas y encabezados del Excel | — |
| `historial-excel.test.ts` | Un .xlsx real generado con la librería, descomprimido y leído: encabezados de DEC-06, una fila por registro, valores de toma, fecha y hora de Costa Rica, solo encabezados en un período vacío, sin fotos ni enlaces | Que Excel o LibreOffice lo abran; la descarga en un navegador real |
| `historial-servicio.test.ts` y `historial-pagina.test.tsx` | Llamada con el intervalo en UTC, mensajes fijos, descarte de respuestas mal formadas, bebé elegido y sus datos, intervalo vacío, resultado parcial sin exportar, foto con enlace, botón de exportar | Una sesión ni una base reales; el dibujo de los gráficos en un navegador (en jsdom solo se verifica la tabla equivalente) |

Todo es evidencia simulada (S). Nada es físico (F).

## 4. Estado de los criterios

Detalle en [`matriz-hu-ca.md`](matriz-hu-ca.md): los 16 criterios de HU-24 a HU-27 quedan **parciales (S)**; 11 de ellos estaban pendientes (CA-25.3, CA-25.4, CA-26.1 a CA-26.4 y CA-27.1 a CA-27.5). Conteo global: verificado 3, parcial 133, pendiente 9, bloqueado 0 (suma 145).

## 5. Decisiones y límites

- **Tope de 20000 registros.** Una noche de 12 h con ambiente cada 10 s son unos 8700 registros (dos por lectura). Con más de 20000 el resultado se marca parcial y no se exporta.
- **Hueco de 30 minutos.** Una línea se corta cuando dos lecturas están separadas por más de 30 minutos. Es una decisión de esta fase; conviene confirmarla con el equipo.
- **Valor de una toma completa.** En el historial y en el Excel sale de la toma (con correcciones), no del evento original, para que coincida con `cantidad_g`. El evento original conserva su valor en `eventos`.
- **Quién ve qué.** Quien es tutor de un bebé ve su historial aunque ya no sea dueño del módulo; quien es dueño de un módulo ve solo al bebé que tiene asignado hoy. La foto solo la recibe una dueña activa del módulo.
- **Gráficos.** Reducen cada serie a 600 puntos para dibujarla; la lista muestra los primeros 500 eventos. El Excel siempre lleva todos los registros consultados.
- **Carga de la pantalla.** `recharts` aumenta el paquete principal (de 0,34 MB a 0,80 MB sin comprimir). Se probó cargarla de forma perezosa, pero rompe pruebas síncronas existentes de rutas y sesión; queda como mejora.
- **Reconciliación con datos conocidos.** Cambio de día (noche en hora de Costa Rica), hueco (línea cortada y hora «Sin datos») y reasignación (dos bebés) están cubiertos con datos fijos; la conciliación con datos reales de un Supabase real sigue pendiente.

## 6. Resolución de la PR #16

`development` recibió un commit de otra persona del equipo que movió `src/firmware/` a `src/firmware/pico_(ignorar)/` y agregó `src/firmware/pico/`, lo que dejó en conflicto la PR #16. Se fusionó `origin/development` en `feat/fase9-alimentacion`: el firmware completo sigue en `src/firmware/` (con sus 361 pruebas), `src/firmware/pico/` queda intacto y la copia duplicada `pico_(ignorar)/` se elimina. El README del firmware explica la diferencia. La rama debe publicarse para que GitHub actualice la PR.

## 7. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Supabase real | Autorización para aplicar la migración 000800 y probar `historial_bebe` contra la API real |
| Navegador | Abrir el .xlsx en Excel o LibreOffice y revisar los gráficos a 360 y 1280 px (fase 11) |
| Datos reales | Registros de dispositivos físicos para la conciliación final |

## 8. Archivos

Creados: `supabase/migrations/20261118000800_historial.sql`, `supabase/tests/{_base.mjs, historial.test.mjs}`, `src/frontend/src/{models/historial.ts, utils/historial.ts, utils/excel.ts, services/historial.ts, hooks/useHistorial.ts, pages/historial.css}`, `src/frontend/src/components/{FormularioIntervaloHistorial, ResumenNoche, GraficoEventosPorHora, GraficoMediciones, ListaRegistros, BotonExportar}.tsx`, `src/frontend/tests/{historial-utils.test.ts, historial-excel.test.ts, historial-servicio.test.ts, historial-pagina.test.tsx}`, `src/shared/contracts/historial.md`.

Modificados: `supabase/package.json`, `supabase/tests/notificador.test.mjs`, `src/frontend/{package.json, package-lock.json}`, `src/frontend/src/pages/PaginaHistorial.tsx`, `src/frontend/src/components/ProveedorServicios.tsx`, `src/frontend/src/services/{noConfigurado, ordenes, tipos}.ts`, `src/frontend/src/utils/tiempo.ts`, `docs/Sprint4/matriz-hu-ca.md`.

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
