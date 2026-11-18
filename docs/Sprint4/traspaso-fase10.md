# Traspaso para las fases 10 a 12

**Estado al cierre de la fase 9, 2026-11-18.** Continúa a [`traspaso-fase7.md`](traspaso-fase7.md): lo que allí sigue vigente (decisiones, deuda, bloqueos) no se repite, salvo lo que cambió. Indica desde dónde seguir con las fases 10 a 12 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md).

## 1. Ramas y orden de revisión

Todos los commits de las fases 3 a 9 son **locales**: no se hizo push. Las ramas están encadenadas y las migraciones tienen numeración consecutiva, así que los pull requests deben abrirse y fusionarse en orden.

| Rama | Base | Commits propios | Validación |
|---|---|---|---|
| `feat/fase7-habitacion` | `feat/fase6-colchon` | 4 (`da99fac`, `3cc38d6`, `23ec3ed`, `28c7462`) | [`validacion-fase7.md`](validacion-fase7.md) |
| `feat/fase8-juego` | fase 7 | 2 (`5f5b271`, `c04da6b`) | [`validacion-fase8.md`](validacion-fase8.md) |
| `feat/fase9-alimentacion` | fase 8 | 4 (`b6d014f`, `c598ef0`, `77c765c`, `60b0da5`) | [`validacion-fase9.md`](validacion-fase9.md) |

Para seguir: `git switch feat/fase9-alimentacion` y crear `feat/fase10-historial` desde ahí. Las fases 3 a 6 están en `feat/fase3-cuentas` a `feat/fase6-colchon` (ver el traspaso anterior).

Resultado de las suites al cierre de la fase 9:

| Suite | Resultado |
|---|---|
| `npm.cmd test` en `supabase` | 151 pruebas: **149 pasan, 2 fallan** (ver §4, punto 1) |
| `npm.cmd test` en `src/frontend` | 28 archivos, 380 pruebas; lint y build sin hallazgos |
| `python -m unittest discover -s src/firmware/tests` (raíz) | 361 pruebas |

La matriz [`matriz-hu-ca.md`](matriz-hu-ca.md) quedó en **3 verificados, 122 parciales, 20 pendientes**. Los 20 pendientes son de las fases 10 a 12. Todo lo parcial tiene evidencia simulada (S); **nada tiene evidencia física (F) ni se probó contra Supabase real.**

## 2. Qué quedó hecho en las fases 7 a 9

| Fase | Resultado | Límite principal |
|---|---|---|
| 7 · Habitación | Puerta y PIR con monitoreo por sensor y por horario, evento y aviso por cada acción, fotos privadas con teléfono como cámara (`/habitacion/camara`) | Bucket sin crear en un Supabase real (prueba P3); reed y PIR reales sin probar |
| 8 · Juego | Cinco botones y LED, solo local y sin red | Sin web ni backend por decisión; hardware y fijación sin medir |
| 9 · Alimentación | Tomas conducidas desde la web, pesaje por orden, correcciones auditadas, temperatura del biberón, límites de frío y calor, recordatorios | Balanza y sonda reales sin probar; sin botón físico de inicio (CA-20.2) |

## 3. Piezas que la fase 10 debe usar

**Eventos unificados.** `public.eventos` (migración 2 de la fase 4) ya recibe los eventos de colchón, habitación y alimentación, con `bebe_id`, `tipo`, `descripcion`, `valor`, `unidad` y `datos`. Ambiente y movimiento siguen en sus tablas propias (`lecturas_ambiente`, `eventos_movimiento`): la fase 10 debe unificarlos para el historial. Tipos de la fase 7 a 9: `puerta`, `movimiento_habitacion`, `foto_tomada`, `toma_iniciada`, `toma_completa`, `peso_alimentacion`, `peso_alimentacion_fallido`, `temperatura_biberon`, `biberon_fuera_rango`.

**Tomas para la exportación (CA-27.3).** `public.mis_tomas(p_device_id, p_limite)` devuelve la toma con `peso_inicial_g`, `peso_final_g`, `ingerido_g` (la cantidad), `inicio`, `fin`, `duracion_activa_s`, pausas y correcciones. Las columnas adicionales del `.xlsx` (`peso_inicial_g`, `peso_final_g`, `cantidad_g`, `duracion_s`) salen de ahí. `tomas`, `pausas_toma` y `correcciones_toma` no tienen permisos directos: la exportación necesita una función nueva con control de dueño o ampliar `mis_tomas` con un rango de fechas.

**Fotos (CA-24.x y CA-27.2).** `public.fotos` guarda estado, ruta y motivo por evento; la imagen se ve con una URL firmada de 60 s (`services/habitacion.ts: urlFoto`). El historial puede mostrar la foto de un evento de habitación solo a un dueño. La exportación **no** lleva fotos ni enlaces.

**Intervalos por hora (CA-26.3).** Los eventos se cuentan en [inicio, fin): 08:15 y 08:59 caen en [08:00, 09:00), y 09:00 en [09:00, 10:00). La zona es siempre `America/Costa_Rica` (`utils/tiempo.ts`, `formatearHoraCR`).

**Duración activa de una toma.** La calcula el servidor (`cuna_private.duracion_activa_s`); la web solo suma el tiempo transcurrido desde que llegó la consulta, y solo con la toma en curso. No recalcular pausas en el cliente.

**Patrón de servicio web.** `services/alimentacion.ts` y `services/habitacion.ts` son los modelos más recientes: validan la forma de cada respuesta y devuelven mensajes fijos; los errores del servidor se traducen en `MENSAJES_ORDENES` de `services/ordenes.ts`.

## 4. Deuda y riesgos nuevos o que cambiaron

1. **`notificador.test.mjs` falla de forma intermitente.** Dos pruebas («notificador: texto, autenticación, reintentos…» y «recorrido completo…») comparan el orden de avisos que comparten la misma marca de tiempo. El archivo carga solo tres migraciones tempranas, así que no depende de las fases 7 a 9. Falló en las dos ejecuciones completas de la fase 9. Arreglar el orden (por ejemplo con un segundo criterio estable) antes de que oculte una falla real.
2. **Pines compartidos entre módulos.** Resuelto con agrupación por módulo en la prueba, pero GP2 a GP6, GP4, GP16 y GP17 se reutilizan entre módulos: solo es válido conectando uno por vez. Sin revisión eléctrica de ningún módulo.
3. **Botón físico de inicio (CA-20.2).** No existe; la toma se inicia desde la web. Decisión del equipo.
4. **Umbral de temperatura desactualizada.** 120 s para el biberón (la Pico mide cada 30 s), frente a 30 s para el ambiente. Confirmar.
5. **Prueba P3 de fotos.** Falta un bucket real: requiere autorización para crear `fotos-habitacion` en `cuna-inteligente-dev`.
6. **Estado tras reiniciar la Pico** (punto 4 del traspaso anterior): ahora también aplica a habitación y alimentación. Una toma en curso no se pierde (vive en el servidor), pero un pesaje pedido durante el reinicio vence a los 15 s.
7. Siguen vigentes los puntos 2, 3, 5, 6, 7, 8 y 9 de la sección 5 del traspaso anterior.

## 5. Bloqueos y recursos que faltan

Sin cambios respecto al traspaso anterior, más:

| Elemento | Qué falta | Fases que afecta |
|---|---|---|
| Supabase real | Aplicar las migraciones 000100 a 000700 (la 000600 crea un bucket y la 000700 tablas de tomas) | Todas |
| Hardware nuevo | Reed, PIR, cinco botones arcade con LED, celda de 1 kg con HX711 y DS18B20 | 7 a 9 y 12 |
| Pruebas de banco | B1 a B3 (pesaje), B7 (temperatura), B9 (puerta y PIR), B10 (juego): sin ejecutar | 12 |

## 6. Qué hacer en cada fase que sigue

- **Fase 10 · Historial (HU-24 a HU-27).** Unificar ambiente y movimiento en `eventos`; historial por bebé con separación estricta entre bebés; resumen de noche con inicio y fin elegibles (incluso al cruzar medianoche) y mensaje explícito para un intervalo sin registros; histogramas por hora y líneas con fecha, hora y unidad; exportación `.xlsx` con las columnas de DEC-06 y las de tomas, sin fotos ni enlaces; intervalo vacío con encabezados y ninguna fila. `PaginaHistorial.tsx` sigue siendo un marcador. Conciliar registros, gráficos y filas del Excel con datos conocidos (cambio de día, hueco, reasignación de bebé).
- **Fase 11 · Recuperación y privacidad (HU-28, HU-30, HU-34, HU-35).** Los puntos 2 a 7 del traspaso anterior; medir tiempos y probar a 360 y 1280 px.
- **Fase 12 · Demostración (HU-29).** Guion de la maqueta modular con las pruebas físicas pendientes (B1 a B10).

## 7. Indicación lista para continuar

> Ejecutá las fases 10 a 12 de `docs/Sprint4/PLAN-PROYECTO.md`. Partí de la rama `feat/fase9-alimentacion`, creá una rama por fase encadenada (`feat/fase10-historial`, etc.) y hacé commits locales, sin push. Leé primero `docs/Sprint4/traspaso-fase10.md` y la `validacion-fase9.md`. Seguí las reglas de los `CLAUDE.md` (raíz y `src/frontend`): no crear nada en `cuna-inteligente-dev`, no leer ni mostrar credenciales, no declarar verificado lo que no se comprobó, controles de hardware solo detrás de banderas `VITE_*_HABILITADA`, no modificar la documentación protegida, usar `npm.cmd` en PowerShell. Al cerrar cada fase corré las tres suites (anotá la falla intermitente de `notificador.test.mjs` o corregila), buscá secretos con `git grep`, escribí `validacion-faseN.md` con los comandos y resultados reales, actualizá `matriz-hu-ca.md` con un recuento que dé 145 criterios, y cerrá con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Todo lo probado con dobles queda como parcial (S).
