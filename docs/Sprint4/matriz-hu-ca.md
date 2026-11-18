# Matriz HU/CA · Línea base del Sprint 4

**Fase 1 del [plan de ejecución](PLAN-PROYECTO.md); actualizada en la fase 2 (filas CA-33.x y dos correcciones de pines).** Base: rama `development`, commit `386ca9a`. Fecha: 2026-11-17.
Fuente de aceptación: `docs/Sprint1/EntregableSprint1.pdf` (HU-01 a HU-35, 145 criterios). Los identificadores son los del PDF.

## Cómo leer la matriz

| Estado | Significado en esta matriz |
|---|---|
| **verificado** | Se comprobó el criterio completo con la evidencia indicada, del tipo indicado. |
| **parcial** | Existe una parte del criterio, o existe todo pero solo con prueba simulada o sin integración real. |
| **pendiente** | No hay código ni documento que lo cubra. |
| **bloqueado** | Falta un recurso o una decisión externa (se indica cuál). |

| Tipo de prueba | Significado |
|---|---|
| **S** | Simulada: prueba automática con Supabase en memoria (PGlite), Supabase simulado en la web o dispositivos simulados en el firmware. Acredita lógica. |
| **D** | Documental: revisión de código o documentos. |
| **F** | Física: ejecución con hardware real. **Ninguna existe todavía** para los criterios de esta matriz; las pruebas físicas requieren evidencia del equipo. |
| — | Sin prueba. |

Ningún criterio que dependa de Supabase real o de hardware figura como verificado. Los reportes del equipo anteriores (`docs/Sprint3/prueba-maqueta.md`) mencionan pruebas parciales del colchón en banco (HX711, buzzer, botón) sin evidencia reproducible versionada; aquí se tratan como no comprobadas.

Rutas relativas a la raíz. «Web» = `src/frontend/src`; «Firmware» = `src/firmware`; «Migración 1 a 4» = `supabase/migrations/20261111000{1,2,3,4}00_*.sql` (ambiente, lámpara, entrega de lámpara, movimiento).

## HU-01 a HU-05 · Cuentas, bebés y propiedad (fase 3)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-01.1 | `services/auth.ts:39` (`signInWithPassword`), `pages/PaginaLogin.tsx`, `tests/auth.test.ts`, `tests/sesion.test.tsx` (Web) | S | parcial | Sin prueba contra Supabase Auth real. |
| CA-01.2 | `PaginaLogin.tsx` muestra error de credenciales; `tests/auth.test.ts` | S | parcial | Igual. |
| CA-01.3 | `components/Layout.tsx:21-31` (`auth.signOut`); `tests/sesion.test.tsx` | S | parcial | Igual. |
| CA-01.4 | — (no hay pantalla ni llamada de registro) | — | pendiente | Falta registro y manejo de correo repetido. |
| CA-02.1 | `bebe_id` en `lecturas_ambiente` y `eventos_movimiento` (Migración 1 y 4); `supabase/tests/ingesta.test.mjs` | S | parcial | Solo modelo de datos. No hay alta de bebés ni vista por bebé. |
| CA-02.2 | `asignaciones_bebe.bebe_id` admite nulo (Migración 1) | S | parcial | Sin RPC ni web para asociar accesorios sin cuna. |
| CA-02.3 | `cuna_private.bebes(id, nombre)` (Migración 1) | — | pendiente | Sin formulario; falta fecha de nacimiento opcional. |
| CA-03.1 | `cuna_private.dispositivos` y `duenos_dispositivo` (Migración 1) | — | parcial | Sin RPC ni web. El alta es por SQL manual (`supabase/README.md`). |
| CA-03.2 | — | — | pendiente | No hay restricción de una cuna por bebé. |
| CA-03.3 | `components/Layout.tsx` muestra navegación fija, no módulos asociados | — | pendiente | La interfaz no lista módulos de la cuenta. |
| CA-03.4 | — | — | pendiente | Sin regla de rechazo. |
| CA-04.1 | `cuna_private.es_dueno_activo()` y políticas `select` (Migración 1); `supabase/tests/lampara.test.mjs` («RLS: solo el dueño activo lee») | S | parcial | Falta probar dos dueños simultáneos y configuración compartida. |
| CA-04.2 | — | — | pendiente | No existe «Administrar dueños». |
| CA-04.3 | `duenos_dispositivo.activo` (Migración 1) | — | pendiente | Sin invitación, aceptación, revocación ni regla del último dueño. |
| CA-05.1 | La ingesta usa la asignación vigente en `ts` (Migración 1; `supabase/tests/movimiento.test.mjs` «conserva la asignación histórica») | S | parcial | Sin RPC ni web de reasignación. |
| CA-05.2 | Igual: la fila conserva su `bebe_id` | S | parcial | Igual. |
| CA-05.3 | No hay permiso de borrado para roles de API en las migraciones | S | parcial | Falta probar un flujo real de reasignación. |

## HU-06 y HU-07 · Telegram y avisos (fase 4)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-06.1 | — (`src/backend/Integrations/Telegram/` vacío) | — | pendiente | Todo HU-06. |
| CA-06.2 | — | — | pendiente | |
| CA-06.3 | — | — | pendiente | |
| CA-07.1 | — | — | pendiente | No hay notificador. |
| CA-07.2 | — | — | pendiente | Depende del servicio en Supabase. |
| CA-07.3 | La idempotencia por `event_id` existe en ingesta, no en avisos | — | pendiente | Falta registro de avisos por evento y destinatario. |
| CA-07.4 | — | — | pendiente | Depende de fotos (fase 7). |
| CA-07.5 | — | — | pendiente | Sin límites ni episodios. Diseño en `arquitectura.md` §6.3. |

## HU-08 a HU-13 · Cuna y figuras (fase 5)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-08.1 | PIR en GP3 (`config.py:20`; se crea en `common/sensors/sensores.py:17`); envío en `main.py:133-139` y `common/communication/ambiente.py`; Migración 4; `supabase/tests/movimiento.test.mjs`; `components/PanelMovimiento.tsx` | S | parcial | El monitoreo se activa por bandera de configuración (`config.py:28`, apagada). No hay activación manual ni por horario desde la web. Sin prueba física. |
| CA-08.2 | `src/shared/contracts/movimiento.md` lo excluye | — | pendiente | Depende de HU-06 y HU-07. |
| CA-08.3 | Con la bandera apagada el firmware no envía (`ambiente.py:206`) | S | parcial | Control solo local, no desde la web. |
| CA-09.1 | `pages/PaginaCuna.tsx`, `services/lecturas.ts:74-92`, `tests/paginaCuna.test.tsx`, `tests/lecturas.test.ts` | S | parcial | Nunca verificado con Supabase real ni con un AM2301 real. |
| CA-09.2 | `bebe_id` y `device_id` en `lecturas_ambiente` (Migración 1); `supabase/tests/ingesta.test.mjs` | S | parcial | Igual. |
| CA-09.3 | `INTERVALO_AMBIENTE_S = 10` (`config.py:87`); unidades °C y % HR en `PaginaCuna`; `ts` UTC guardado | S | parcial | La cadencia de 10 s no se midió con marcas reales (fase 11). |
| CA-10.1 | — | — | pendiente | Sin tabla de límites ni pantalla. |
| CA-10.2 | — | — | pendiente | Depende de HU-07. |
| CA-10.3 | — | — | pendiente | |
| CA-10.4 | — | — | pendiente | Regla mínimo < máximo solo en DEC-13. |
| CA-11.1 | Ciclo completo web → `solicitar_lampara` → Realtime → Pico → `confirmar_orden_lampara`: Migraciones 2 y 3; `common/communication/lampara_remota.py`; `components/PanelLampara.tsx`; `supabase/tests/lampara*.test.mjs`; `firmware/tests/test_lampara_remota.py` | S | parcial | Funciona solo con `VITE_LAMPARA_HABILITADA=true`. Nunca probado con Realtime real ni con la Pico. Pantalla solicita nivel 0–100; no hay botones de encender y apagar separados. |
| CA-11.2 | `cuna/audio.py` (tono sintético, MAX98357A); `firmware/tests/test_audio.py` | S | parcial | Solo local. Sin web. Sin prueba de I²S real. |
| CA-11.3 | — | — | pendiente | No se registra la reproducción como actividad. |
| CA-11.4 | `audio_play` y `audio_stop` locales (`comandos.py`) | S | pendiente | No hay catálogo; un solo tono. Sin selección desde la web. |
| CA-12.1 | — | — | pendiente | Voz sin diseño de transporte. Ver `arquitectura.md` §8. |
| CA-12.2 | — | — | pendiente | |
| CA-12.3 | — | — | pendiente | |
| CA-13.1 | `figuras-led/figuras.py` (6 LED en GP18–22 y GP26) | S | parcial | Solo demostración local. Sin canal de red, sin web, sin horario. `pages/PaginaFiguras.tsx` es un marcador sin controles. |
| CA-13.2 | `led_sequence` con `step_s` en `comandos.py` | S | parcial | Sin web. |
| CA-13.3 | `MODULO = "figuras"` aísla el módulo (`common/utilities/modulo.py:16-32`); `firmware/tests/test_modulo.py` | S | parcial | Falta demostración física modular. |
| CA-13.4 | Mínimo de 2 s en firmware (`figuras.py`, `comandos.py`) y `models/validarComando.ts` (sin uso en pantallas) | S | parcial | Sin rechazo desde la web. Transiciones suaves sin medir. |

## HU-14 a HU-16 · Colchón independiente (fase 6)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-14.1 | `Monitor.armar` (`colchon/logica_colchon.py:120`); `firmware/tests/test_control_colchon.py` («referencia_valida_positiva_tras_calibrar») | S | parcial | Referencia solo local; no se guarda en la nube ni se configura desde la web. |
| CA-14.2 | `mattress_stop` en `comandos.py`; botón físico | S | parcial | Sin web. |
| CA-14.3 | `MODULO = "colchon"` | S | parcial | Falta alimentación independiente comprobada (HU-29). |
| CA-14.4 | El peso se mide y procesa solo en la Pico; no se envía | D | parcial | Verificar al integrar que no se persistan lecturas de peso como movimientos. |
| CA-14.5 | `logica_colchon.py:116-135`; `test_logica_colchon.py` (líneas 103–111); `test_control_colchon.py` («duracion_del_monitoreo_lo_detiene») | S | parcial | Sin validación desde la web. |
| CA-15.1 | `COLCHON_TOLERANCIA_PCT = 10` (`config.py:49`) | S | parcial | Fija en configuración; no editable desde la web. |
| CA-15.2 | Buzzer integrado en GP14 (`config.py:44`, PWM 2 kHz); GP18 es el pin del montaje de banco (`colchon/prueba_colchon.py:117`) | S | parcial | Aviso a Telegram pendiente (HU-07). Sin prueba física con evidencia. |
| CA-15.3 | `registrar_lectura` no alarma si no está ACTIVO (`logica_colchon.py:161-162`) | S | parcial | |
| CA-15.4 | `test_logica_colchon.py:30-66` y `test_control_colchon.py:173-188` (890 g × 3 dispara; 900 g × 3 no; 890 g y 1000 g no completan) | S | parcial | Falta con pesos reales en banco y con HX711 real. |
| CA-16.1 | Botón y `mattress_stop` (`test_control_colchon.py:261-308`) | S | parcial | Detención desde la app pendiente. |
| CA-16.2 | `mattress_rearm` local (`test_control_colchon.py:314-331`) | S | parcial | Sin web. |
| CA-16.3 | `COLCHON_ALARMA_MAX_S = 60` (`config.py:54`); `test_control_colchon.py:293-331` | S | parcial | Duración editable solo en configuración, no desde la app. |

## HU-17 a HU-19 · Habitación y juego (fases 7 y 8)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-17.1 a CA-17.5 | — (el firmware no tiene sensor de puerta ni módulo de habitación) | — | pendiente | HU-17 completa. El PIR existente pertenece a la cuna (HU-08). |
| CA-18.1 a CA-18.4 | — (sin Storage ni cámara) | — | pendiente | HU-18 completa. |
| CA-19.1 a CA-19.5 | — (sin botones ni juego en el firmware) | — | pendiente | HU-19 completa. |

Los 14 criterios CA-17.1 a CA-17.5, CA-18.1 a CA-18.4 y CA-19.1 a CA-19.5 comparten estado y brecha; se agrupan aquí y se cuentan uno a uno en el resumen.

## HU-20 a HU-23 · Alimentación (fase 9)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-20.1 a CA-20.4 | — (el HX711 existente sirve al colchón, no a una balanza de alimentación) | — | pendiente | HU-20 completa. |
| CA-21.1 a CA-21.7 | — (estados de toma solo en `arquitectura.md` §6.2) | — | pendiente | HU-21 completa. |
| CA-22.1 a CA-22.4 | — (sin planificador; la zona horaria de presentación sí existe en `utils/tiempo.ts`) | — | pendiente | HU-22 completa. |
| CA-23.1 a CA-23.4 | — | — | pendiente | HU-23 completa. |

Son 4 + 7 + 4 + 4 = 19 criterios (CA-20.x: 4, CA-21.x: 7, CA-22.x: 4, CA-23.x: 4), todos pendientes.

## HU-24 a HU-27 · Historial, gráficos y exportación (fase 10)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-24.1 | `ts`, `recibido_en` y datos en `lecturas_ambiente` y `eventos_movimiento` | S | parcial | Sin tipo ni descripción unificados; faltan los demás eventos. |
| CA-24.2 | Mediciones de ambiente y movimientos (Migraciones 1 y 4); órdenes de lámpara (Migración 2) | S | parcial | Faltan activaciones, alertas y el resto de módulos. |
| CA-24.3 | Sin permisos de borrado en las migraciones; no hay audio | S | parcial | Falta probar con el historial completo. |
| CA-24.4 | Igual que CA-05.2 | S | parcial | |
| CA-24.5 | `event_id` PK; `supabase/tests/ingesta.test.mjs` y `movimiento.test.mjs` («deduplica, rechaza colisiones…») | S | parcial | Falta demostrar dos eventos distintos con la misma hora en todos los tipos. |
| CA-24.6 | Datos por fila, bebé y dispositivo guardados | S | parcial | Sin descripción; fotos pendientes. |
| CA-24.7 | Ningún flujo de borrado; «eliminar la cuenta solicitante conserva la orden original» (`lampara.test.mjs`) | S | parcial | Falta cubrir retiro de dueño y reasignación. |
| CA-25.1 | `pages/PaginaCuna.tsx` lee la última lectura de la nube | S | parcial | `PaginaHistorial.tsx` es un marcador sin consulta. |
| CA-25.2 | RLS por dueño | S | parcial | Sin vista por bebé. |
| CA-25.3 | — | — | pendiente | |
| CA-25.4 | — | — | pendiente | |
| CA-26.1 | — | — | pendiente | Sin gráficos. |
| CA-26.2 | — | — | pendiente | |
| CA-26.3 | `utils/tiempo.ts` formatea en `America/Costa_Rica` | S | pendiente | Sin histogramas ni líneas. |
| CA-26.4 | — | — | pendiente | |
| CA-27.1 a CA-27.5 | — (sin dependencia `.xlsx` ni exportación) | — | pendiente | HU-27 completa. Columnas en DEC-06. |

## HU-28 a HU-30 · Recuperación, maqueta y rendimiento (fases 11 y 12)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-28.1 | Ni `docs/Sprint3/alcance.md` ni el firmware incluyen UPS | D | parcial | Confirmar con la lista de componentes (HU-33). |
| CA-28.2 | Perder Wi-Fi apaga la lámpara y detiene el colchón (`test_control_colchon.py:363-417`; `lampara_remota.py`) | S | parcial | Sin corte real. |
| CA-28.3 | Colchón detenido y rearme con referencia nueva (firmware); registros conservados por la base | S | parcial | Recordatorios inexistentes; sin prueba de corte real. |
| CA-28.4 | `/cuna` marca «Desactualizado» a los 30 s (`PaginaCuna.tsx`, `tests/paginaCuna.test.tsx`) | S | parcial | La web no muestra estado del colchón. |
| CA-29.1 a CA-29.4 | — | — | pendiente | Guion de demostración (fase 12) y diseño físico (fase 2). |
| CA-30.1 | — | — | pendiente | |
| CA-30.2 | — | — | pendiente | |
| CA-30.3 | `INTERVALO_AMBIENTE_S = 10`, `COLCHON_INTERVALO_MS = 1000` | D | parcial | Parámetros fijados; no hay medición con tiempos. |
| CA-30.4 | Igual | D | parcial | |

## HU-31 a HU-33 · Historias técnicas (fases 1 y 2)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-31.1 | [`arquitectura.md`](arquitectura.md) §1, §2 y §5 (componentes, responsabilidades, diagramas) | D | verificado | Falta revisión y aceptación del equipo. Lo no implementado figura como propuesta. |
| CA-31.2 | `arquitectura.md` §4 y §5; contratos vigentes en `src/shared/contracts/` | D | parcial | Los contratos de módulos futuros están a nivel de tabla, sin campos finales. |
| CA-31.3 | `arquitectura.md` §6 (alarma, toma, recuperación y horarios por módulo) | D | parcial | Varios comportamientos tras un corte quedan «a confirmar» (§8). |
| CA-31.4 | `arquitectura.md` §7 | D | parcial | Solo hay controles para HU-01 (parcial), HU-08, HU-09 y HU-11. |
| CA-32.1 | [`entorno.md`](entorno.md); 14 archivos web y 159 pruebas, 29 pruebas Supabase, 171 pruebas firmware: ver [`validacion-fase1.md`](validacion-fase1.md) | S | parcial | Backend en la nube no reproducido en local (sin Supabase CLI ni Docker). |
| CA-32.2 | `git ls-files`, `git check-ignore` y búsqueda de patrones en HEAD y en los 73 commits: sin credenciales | D | verificado | La búsqueda cubre patrones conocidos (JWT, `sb_secret_`, tokens de bot). No sustituye una revisión humana. |
| CA-32.3 | `supabase/tests/*.test.mjs` (simulado) | S | pendiente | Falta enviar un evento a Supabase real y leerlo. Guía en `entorno.md` §5. Requiere acceso al proyecto de desarrollo. |
| CA-32.4 | `arquitectura.md` §3; Supabase en uso (`supabase/`) | D | verificado | Falta revisión del equipo. |
| CA-33.1 | [`diseno-fisico.md`](diseno-fisico.md) §3 y §4: componentes de los seis módulos, ambas balanzas, cámara, luces, audio, botones y alimentación | D | parcial | Faltan confirmación del equipo y existencia de los componentes propuestos para habitación, juego y alimentación. |
| CA-33.2 | [`diseno-fisico.md`](diseno-fisico.md) §3: rango, precisión objetivo, calibración, método de temperatura, brillo, volumen y seguridad mecánica; [`protocolo-banco.md`](protocolo-banco.md) B1 a B8 | D | parcial | Las cifras son objetivos, no mediciones. Falta el banco y cotejar normas de cuna y juguetes. |
| CA-33.3 | [`diseno-fisico.md`](diseno-fisico.md) §2, §3.3, §3.5 y §7 | D | parcial | Sustituciones sin coordinar con el profesor. |
| CA-33.4 | [`diseno-fisico.md`](diseno-fisico.md) §2 y §3 | D | parcial | Sin maqueta construida que lo demuestre. |
| CA-33.5 | [`diseno-fisico.md`](diseno-fisico.md) §3.1 | D | parcial | Dimensiones de norma sin cotejar; sin plano de la maqueta a escala. |
| CA-33.6 | [`diseno-fisico.md`](diseno-fisico.md) §3.6 | D | parcial | Cable y conector sin elegir ni probar. |

## HU-34 y HU-35 · Privacidad y uso web (fase 11)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-34.1 | RLS y permisos de RPC (`supabase/tests/lampara.test.mjs`: usuario ajeno, módulo ajeno, sesión ausente) | S | parcial | Falta contra la API real y para fotos y controles futuros. |
| CA-34.2 | `duenos_dispositivo.activo` condiciona `select` y RPC | S | parcial | No existe flujo de revocación ni destinatarios. |
| CA-34.3 | Sin borrado; sin audio | S | parcial | |
| CA-34.4 | Igual que CA-05.1 y CA-05.2 | S | parcial | |
| CA-34.5 | No existe ninguna transmisión de voz | — | pendiente | Depende de HU-12. |
| CA-35.1 | — | — | pendiente | `docs/Sprint3/validacion-base.md` deja pendiente la revisión a 360 y 1280 px. |
| CA-35.2 | `/cuna` muestra °C, % HR y estados | S | parcial | Solo para las pantallas existentes. |
| CA-35.3 | — | — | pendiente | |

## Resumen por estado

Conteo de los 145 criterios del PDF, expandiendo las filas agrupadas (comprobado con un script que exige que cada CA del PDF aparezca una sola vez):

| Estado | Criterios |
|---|---|
| verificado | 3 (CA-31.1, CA-32.2, CA-32.4; los tres solo con evidencia documental) |
| parcial | 63 |
| pendiente | 79 |
| bloqueado | 0 |
| **Total** | **145** |

Los bloqueos aparecerán cuando se intente probar con hardware o con el Supabase real: CA-32.3 depende de acceso al proyecto de desarrollo y de un token propio, y la fase 2 depende de componentes que el equipo aún no ha confirmado (ver [`diseno-fisico.md`](diseno-fisico.md) §3 y [`protocolo-banco.md`](protocolo-banco.md) §5).

## Discrepancias detectadas

### Plan histórico del Sprint 3 y código integrado

| # | Documento | Dice | El código o los datos dicen | Acción propuesta |
|---|---|---|---|---|
| 1 | `Claude outputs/contexto-planificacion-frontend.md` (sin versionar) | Realtime, dato desactualizado a los 10 s | `src/shared/contracts/ambiente.md`: consulta periódica cada 10 s, desactualizado a los 30 s; implementado así en `PaginaCuna.tsx` | Tratar el contrato como vigente; archivar o actualizar ese plan. |
| 2 | `src/firmware/README.md:213` | La calibración vive solo en RAM | Se guarda en `calibracion.json` (`colchon/almacen_calibracion.py`; README `:26-28`; `firmware/tests/test_calibracion_guardada.py`) | Corregir el README del firmware. La tara no se guarda. |
| 3 | `src/frontend/PLAN.md` §10 | Lista de cierre de 11 puntos, todos sin marcar; fases 1–6 pendientes | La web real cubre solo la fase 0 (fundaciones), login, ambiente, lámpara y movimiento | Reemplazar por las fases del Sprint 4 o marcar el avance real. |
| 4 | `src/frontend/PLAN.md` | `docs/Sprint3/validacion-web.md` como entregable | El archivo no existe | Sustituir por `validacion-fase1.md` o crearlo. |
| 5 | `docs/Sprint3/contrato-web-propuesta.md` | Contrato provisional con `led_*` y `get_status` y siete preguntas abiertas | `models/contrato.ts` replica el contrato provisional; solo `lamp_set` tiene contrato vigente y canal real | Cerrar el contrato cuando se implementen figuras, colchón y audio. |
| 6 | `docs/Sprint3/alcance.md` | Firmware, HTTPS, Realtime, Auth/RLS «diferidos» | Ya existen para ambiente, movimiento y lámpara | Actualizar el alcance o remitir a `arquitectura.md`. |
| 7 | `docs/output/arquitecturas/` | Arquitectura de una plataforma de eventos con MEAN | No corresponde a este proyecto | No usar como referencia. No se modifica (documentación protegida). |
| 8 | `README.md` raíz y `docs/Sprint3/alcance.md` | Primer recorrido AM2301 → Supabase → web | Código presente; sin verificación real | Cerrar con CA-32.3. |
| 9 | `src/frontend/src/models/validarComando.ts` | Validación de los comandos del contrato provisional | Ninguna pantalla la usa | Conectarla o quitarla al implementar HU-13. |
| 10 | `src/frontend/src/components/ProveedorServicios.tsx:24` | TODO | `noConfigurado.ts` devuelve «Backend no configurado» para historial, peso, comandos y suscripciones | Sustituir al implementar cada HU. |

### Numeración HU del PDF y de Jira

`docs/Jira/BacklogCompleto.md` tiene 47 historias. HU-01 a HU-29 coinciden con el PDF. HU-30 a HU-39 de Jira son historias de documentación del Sprint 1. En el PDF, HU-30 a HU-35 son historias técnicas y de calidad (rendimiento, arquitectura, entorno, diseño físico, privacidad, uso web). Por los títulos, la correspondencia probable es la siguiente; **no está confirmada** y debe revisarla el equipo.

| PDF | Tema | Jira (probable) |
|---|---|---|
| HU-30 | Rendimiento y periodicidad | HU-45 |
| HU-31 | Arquitectura e interfaces | HU-40 |
| HU-32 | Entorno e infraestructura | HU-41 |
| HU-33 | Diseño físico de la maqueta | HU-42 |
| HU-34 | Acceso y privacidad | HU-43 |
| HU-35 | Uso en celular y computadora | HU-44 |

Las decisiones DEC-xx citan numeración de Jira (por ejemplo HU-40, HU-42). Use los identificadores del PDF al cruzar con esta matriz.
