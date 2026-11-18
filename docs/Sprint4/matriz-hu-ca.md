# Matriz HU/CA · Línea base del Sprint 4

**Fase 1 del [plan de ejecución](PLAN-PROYECTO.md); actualizada en la fase 2 (filas CA-33.x y dos correcciones de pines) y al cierre de la fase 6 (HU-01 a HU-16 y filas relacionadas, con prueba simulada; ver [`validacion-fase3.md`](validacion-fase3.md) a [`validacion-fase6.md`](validacion-fase6.md)), de la fase 7 (HU-17 y HU-18; ver [`validacion-fase7.md`](validacion-fase7.md)) de la fase 8 (HU-19; ver [`validacion-fase8.md`](validacion-fase8.md)) y de la fase 9 (HU-20 a HU-23; ver [`validacion-fase9.md`](validacion-fase9.md)) y de la fase 10 (HU-24 a HU-27; ver [`validacion-fase10.md`](validacion-fase10.md)), de la fase 11 (HU-28, HU-30 y HU-34; ver [`validacion-fase11.md`](validacion-fase11.md)) y de la fase 12 (HU-29; ver [`guion-demostracion.md`](guion-demostracion.md) y [`cierre.md`](cierre.md)).** Base: rama `development`, commit `386ca9a`. Fecha: 2026-11-17.
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
| CA-01.4 | Fase 3: `auth.registrarse`, `tests/paginaRegistro.test.tsx` (campos vacíos y correo repetido). | S | parcial | Prueba con Supabase Auth real y confirmación por correo configurada. |
| CA-02.1 | `bebe_id` en `lecturas_ambiente` y `eventos_movimiento` (Migración 1 y 4); `supabase/tests/ingesta.test.mjs` · Fase 3: `supabase/tests/cuentas.test.mjs`: dos bebés separados por cuenta. | S | parcial | Vista de historial por bebé (fase 10). |
| CA-02.2 | `asignaciones_bebe.bebe_id` admite nulo (Migración 1) · Fase 3: un colchón se asigna a un bebé sin cuna (`cuentas.test.mjs`). | S | parcial | Prueba con Supabase real. |
| CA-02.3 | `cuna_private.bebes(id, nombre)` (Migración 1) · Fase 3: nombre obligatorio y fecha opcional no futura, en RPC y en web. | S | parcial | Prueba con Supabase real. |
| CA-03.1 | `cuna_private.dispositivos` y `duenos_dispositivo` (Migración 1) · Fase 3: `reclamar_dispositivo` con código de un solo uso. | S | parcial | El alta física del módulo y de su código la sigue haciendo un administrador. |
| CA-03.2 | Fase 3: una cuna por bebé vía `producto_id`; la segunda se rechaza sin tocar la primera. | S | parcial | Confirmar con el equipo que «una cuna» equivale a un `producto_id`. |
| CA-03.3 | `components/Layout.tsx` muestra navegación fija, no módulos asociados · Fase 3: `/bebes` lista los módulos asociados con su bebé. | S | parcial | Prueba con Supabase real. |
| CA-03.4 | Fase 3: misma regla que CA-03.2. | S | parcial | Igual que CA-03.2. |
| CA-04.1 | `cuna_private.es_dueno_activo()` y políticas `select` (Migración 1); `supabase/tests/lampara.test.mjs` («RLS: solo el dueño activo lee») · Fase 3: dos dueños leen la misma fila por RLS. | S | parcial | Configuración compartida de módulos futuros. |
| CA-04.2 | Fase 3: «Administrar dueños» en cada módulo. | S | parcial | Prueba con Supabase real. |
| CA-04.3 | `duenos_dispositivo.activo` (Migración 1) · Fase 3: la invitación concede acceso solo al aceptarla; retirar revoca y conserva filas; no se retira al último dueño. | S | parcial | No existe el envío del correo de invitación (sin SMTP): la persona la ve al iniciar sesión con ese correo. |
| CA-05.1 | La ingesta usa la asignación vigente en `ts` (Migración 1; `supabase/tests/movimiento.test.mjs` «conserva la asignación histórica») · Fase 3: reasignación con vigencia (`cuentas.test.mjs`). | S | parcial | Prueba con Supabase real. |
| CA-05.2 | Igual: la fila conserva su `bebe_id` · Fase 3: las filas anteriores conservan su bebé. | S | parcial | Prueba con Supabase real. |
| CA-05.3 | No hay permiso de borrado para roles de API en las migraciones · Fase 3: `delete` y `update` rechazados con `42501`. | S | parcial | Prueba con Supabase real. |

## HU-06 y HU-07 · Telegram y avisos (fase 4)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-06.1 | Fase 4: varios destinatarios por módulo; sección en `/bebes` (`avisos.test.mjs`). | S | parcial | Prueba con Supabase real y un bot real. |
| CA-06.2 | Fase 4: la lista es del módulo y la ven los dos dueños. | S | parcial | Igual. |
| CA-06.3 | Fase 4: código de un solo uso con hash y vencimiento; retirar evita avisos futuros. | S | parcial | Vinculación con un bot real. |
| CA-07.1 | Fase 4: un evento crea un aviso por destinatario; `notificador.test.mjs` con Telegram simulado. | S | parcial | Ninguna entrega real a Telegram. |
| CA-07.2 | Fase 4: el envío depende de `pg_cron` y del notificador, no de la web. | S | parcial | **Sin verificar**: `20261118000300_cron.sql` no se aplicó ni se probó. |
| CA-07.3 | La idempotencia por `event_id` existe en ingesta, no en avisos · Fase 4: el reenvío del mismo `event_id` no duplica eventos ni avisos. | S | parcial | Aplicarlo a cada productor de eventos. |
| CA-07.4 | Fase 4: el aviso se arma solo con tipo y descripción; sin imagen. | S | parcial | Fase 7: el aviso `foto_tomada` lleva texto fijo, sin imagen ni ruta (PGlite). Revalidar con Telegram real. |
| CA-07.5 | Fase 4: `actualizar_episodio`; F5: conectado a la ingesta de ambiente. | S | parcial | Una lectura atrasada puede cerrar un episodio antes de tiempo. |

## HU-08 a HU-13 · Cuna y figuras (fase 5)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-08.1 | PIR en GP3 (`config.py:20`; se crea en `common/sensors/sensores.py:17`); envío en `main.py:133-139` y `common/communication/ambiente.py`; Migración 4; `supabase/tests/movimiento.test.mjs`; `components/PanelMovimiento.tsx` · Fase 5: activación manual y por horario (`motion_set`); el backend omite movimientos con el monitoreo apagado. | S | parcial | Prueba con PIR y Pico reales. Al reiniciarse, la Pico vuelve a apagado sin avisar. |
| CA-08.2 | `src/shared/contracts/movimiento.md` lo excluye · Fase 5: cada movimiento registrado crea un evento y un aviso con la hora. | S | parcial | Entrega real a Telegram. |
| CA-08.3 | Con la bandera apagada el firmware no envía (`ambiente.py:206`) · Fase 5: apagado: no se registra ni se avisa (`monitoreo_inactivo`). | S | parcial | Control confirmado solo por la Pico; sin prueba física. |
| CA-09.1 | `pages/PaginaCuna.tsx`, `services/lecturas.ts:74-92`, `tests/paginaCuna.test.tsx`, `tests/lecturas.test.ts` | S | parcial | Nunca verificado con Supabase real ni con un AM2301 real. |
| CA-09.2 | `bebe_id` y `device_id` en `lecturas_ambiente` (Migración 1); `supabase/tests/ingesta.test.mjs` | S | parcial | Igual. |
| CA-09.3 | `INTERVALO_AMBIENTE_S = 10` (`config.py:87`); unidades °C y % HR en `PaginaCuna`; `ts` UTC guardado | S | parcial | La cadencia de 10 s no se midió con marcas reales (fase 11). |
| CA-10.1 | Fase 5: `limites_ambiente`, `guardar_limites`, panel en `/cuna`. | S | parcial | Prueba con Supabase real. |
| CA-10.2 | Fase 5: salir del rango abre un episodio y avisa una vez (`ordenes-modulo.test.mjs`). | S | parcial | Entrega real a Telegram. |
| CA-10.3 | Fase 5: la web muestra los límites guardados en el servidor. | S | parcial | Prueba con Supabase real. |
| CA-10.4 | Fase 5: mínimo igual o mayor que máximo se rechaza en web y base; se conserva el límite anterior. | S | parcial | Prueba con Supabase real. |
| CA-11.1 | Ciclo completo web → `solicitar_lampara` → Realtime → Pico → `confirmar_orden_lampara`: Migraciones 2 y 3; `common/communication/lampara_remota.py`; `components/PanelLampara.tsx`; `supabase/tests/lampara*.test.mjs`; `firmware/tests/test_lampara_remota.py` · Fase 5: el ciclo de lámpara queda intacto junto a `ordenes_modulo`. | S | parcial | Funciona solo con `VITE_LAMPARA_HABILITADA=true`. Nunca probado con Realtime real ni con la Pico. Pantalla solicita nivel 0–100; no hay botones de encender y apagar separados. |
| CA-11.2 | `cuna/audio.py` (tono sintético, MAX98357A); `firmware/tests/test_audio.py` · Fase 5: `audio_play` por orden remota con confirmación. | S | parcial | I²S real sin probar. |
| CA-11.3 | Fase 5: la confirmación de `audio_play` registra un evento de audio, sin sonido. | S | parcial | Prueba con Supabase real. |
| CA-11.4 | `audio_play` y `audio_stop` locales (`comandos.py`) · Fase 5: selector con el catálogo real de la Pico. | S | parcial | El catálogo es **solo `tono_suave`**; no hay sonidos pregrabados. |
| CA-12.1 | Fase 5: canal privado `voz:<producto>` con PCM de 16 bits a 8 kHz (`voz.md`). | S | parcial | **Sin prueba con micrófono, red y parlante reales.** |
| CA-12.2 | Fase 5: botón «Hablar» y fragmentos de 40 ms; `useVoz`. | S | parcial | Latencia y memoria sin medir. |
| CA-12.3 | Fase 5: solo se registra el inicio y el fin; la voz no se guarda. | S | parcial | Falta confirmar que Realtime no guarda los mensajes difundidos. |
| CA-13.1 | `figuras-led/figuras.py` (6 LED en GP18–22 y GP26) · Fase 5: encender, apagar y un LED desde la web. | S | parcial | Pico y LED reales. |
| CA-13.2 | `led_sequence` con `step_s` en `comandos.py` · Fase 5: secuencias con intervalo desde la web. | S | parcial | Pico y LED reales. |
| CA-13.3 | `MODULO = "figuras"` aísla el módulo (`common/utilities/modulo.py:16-32`); `firmware/tests/test_modulo.py` · Fase 5: figuras separadas; horarios de figuras. | S | parcial | Demostración física modular. |
| CA-13.4 | Mínimo de 2 s en firmware (`figuras.py`, `comandos.py`) y `models/validarComando.ts` (sin uso en pantallas) · Fase 5: intervalo menor que 2 s rechazado en web, base y firmware; rampas de 400 ms. | S | parcial | Transiciones sin medir en LED reales. |

## HU-14 a HU-16 · Colchón independiente (fase 6)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-14.1 | `Monitor.armar` (`colchon/logica_colchon.py:120`); `firmware/tests/test_control_colchon.py` («referencia_valida_positiva_tras_calibrar») · Fase 6: `colchon_armado` informa la referencia que midió la Pico; la web la muestra solo entonces. | S | parcial | Prueba física con HX711 y pesos reales. |
| CA-14.2 | `mattress_stop` en `comandos.py`; botón físico · Fase 6: `mattress_stop` desde la web; evento `colchon_detenido`. | S | parcial | Prueba con Supabase real y con la Pico. |
| CA-14.3 | `MODULO = "colchon"` · Fase 6: módulo `cuna-colchon-NN` separado, con su propia pantalla. | S | parcial | Falta alimentación independiente comprobada (HU-29). |
| CA-14.4 | El peso se mide y procesa solo en la Pico; no se envía · Fase 6: ninguna tabla ni columna de lecturas de peso (prueba de esquema); la web no muestra pesos. | S | parcial | La alarma envía un solo valor (`ultimo_peso_g`), no una serie. |
| CA-14.5 | `logica_colchon.py:116-135`; `test_logica_colchon.py` (líneas 103–111); `test_control_colchon.py` («duracion_del_monitoreo_lo_detiene») · Fase 6: duración, tolerancia y alarma se validan en web, base y firmware antes de medir. | S | parcial | Prueba con Supabase real. |
| CA-15.1 | `COLCHON_TOLERANCIA_PCT = 10` (`config.py:49`) · Fase 6: tolerancia editable y guardada; viaja en `mattress_arm`. | S | parcial | Prueba con Supabase real y con la Pico. |
| CA-15.2 | Buzzer integrado en GP14 (`config.py:44`, PWM 2 kHz); GP18 es el pin del montaje de banco (`colchon/prueba_colchon.py:117`) · Fase 6: `alarma_colchon` crea un aviso por destinatario (`colchon.test.mjs`). | S | parcial | Entrega real a Telegram; buzzer sin prueba física con evidencia. |
| CA-15.3 | `registrar_lectura` no alarma si no está ACTIVO (`logica_colchon.py:161-162`) · Fase 6: sin monitoreo activo no hay evento de alarma. | S | parcial |  |
| CA-15.4 | `test_logica_colchon.py:30-66` y `test_control_colchon.py:173-188` (890 g × 3 dispara; 900 g × 3 no; 890 g y 1000 g no completan) · Fase 6: `test_colchon_fase6.py`: la tolerancia pedida decide la alarma. | S | parcial | Falta con pesos reales en banco y con HX711 real. |
| CA-16.1 | Botón y `mattress_stop` (`test_control_colchon.py:261-308`) · Fase 6: detener desde la app y por botón; `colchon_detenido` con motivo. | S | parcial | Prueba con la Pico real. |
| CA-16.2 | `mattress_rearm` local (`test_control_colchon.py:314-331`) · Fase 6: `mattress_rearm` desde la web con referencia nueva. | S | parcial | Prueba con la Pico real. |
| CA-16.3 | `COLCHON_ALARMA_MAX_S = 60` (`config.py:54`); `test_control_colchon.py:293-331` · Fase 6: duración de la alarma editable (hasta 60 s) y guardada. | S | parcial | Prueba con la Pico real. |

## HU-17 a HU-19 · Habitación y juego (fases 7 y 8)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-17.1 | Fase 7: `room_monitor_set {sensor, enabled}` y cuatro horarios (`habitacion_*_activar/desactivar`); `test_habitacion.py`, `habitacion.test.mjs`, `habitacion-fase7.test.tsx` | S | parcial | Reed y PIR reales; Supabase real y `pg_cron` (el horario corre en el minuto exacto). |
| CA-17.2 | Fase 7: `ControlHabitacion` informa un evento por apertura de puerta o flanco del PIR con el monitoreo de ese sensor activo; `ingestar_habitacion` lo guarda | S | parcial | Sensores reales y cableado sin revisar. |
| CA-17.3 | Fase 7: el evento crea un aviso por destinatario; el módulo no tiene buzzer ni salida sonora | S | parcial | Entrega real a Telegram. |
| CA-17.4 | Fase 7: el evento no lleva datos (`datos = {}`) y el firmware no distingue dirección | S | parcial | |
| CA-17.5 | Fase 7: puerta y movimiento con la misma hora son dos eventos y dos solicitudes de foto | S | parcial | Dos sensores reales a la vez. |
| CA-18.1 | Fase 7: cada evento nuevo crea una solicitud en `public.fotos` | S | parcial | Prueba P3 (teléfono) sin ejecutar; hace falta el almacén real. |
| CA-18.2 | Fase 7: la imagen se sube al almacén privado `fotos-habitacion` y se ve desde `/habitacion` con un enlace de 60 s | S | parcial | Almacén real en `cuna-inteligente-dev` (requiere autorización); tiempos medidos. |
| CA-18.3 | Fase 7: una foto por evento; acciones distintas no se agrupan; el reenvío no duplica la foto | S | parcial | |
| CA-18.4 | Fase 7: sin tablas ni columnas de video ni de imagen; el aviso lleva texto fijo, sin imagen ni ruta | S | parcial | Telegram real. |
| CA-19.1 | Fase 8: `Juego.encender` elige un objetivo al azar entre cinco y `ControlJuego` enciende solo su LED; `test_juego.py` | S | parcial | Botones, LED y cableado reales; pines propuestos sin revisión eléctrica. |
| CA-19.2 | Fase 8: acierto = recompensa sonora de `JUEGO_RECOMPENSA_MS`; error = sin sonido; una pulsación por acción física (antirrebote y flanco) | S | parcial | Buzzer real sin prueba física. |
| CA-19.3 | Fase 8: tras cada pulsación, acierto o error, se elige otro objetivo distinto del anterior (cubre los otros cuatro botones) | S | parcial | Azar real (`os.urandom`) sin medir en la Pico. |
| CA-19.4 | Fase 8: sin límite de pulsaciones; solo se detiene con el combo de apagado (`JUEGO_COMBO_ONOFF` mantenido `JUEGO_COMBO_MS`) o al terminar el programa, con LED y buzzer en bajo | S | parcial | El método de apagado es una propuesta; el diseño comercial puede usar un interruptor. |
| CA-19.5 | `diseno-fisico.md` §3.5: botones grandes (diámetro mínimo propuesto de 30 mm), piezas fijas, sin partes que quepan en el cilindro de partes pequeñas | D | parcial | Requisito de diseño, no verificación: falta elegir los botones, medirlos y probar la fijación; la norma de juguetes está por confirmar. |

El juego es local: no hay pantalla web, tabla ni evento (decisión de la fase 8).

## HU-20 a HU-23 · Alimentación (fase 9)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-20.1 | Fase 9: `feeding_weigh` pide el peso a la Pico (`control_alimentacion.py`, `test_alimentacion.py`); el peso llega como `peso_alimentacion` y `ingestar_alimentacion` lo guarda como peso inicial (`supabase/tests/alimentacion.test.mjs`); botón «Pesar biberón lleno» (`tests/alimentacion-fase9.test.tsx`) | S | parcial | HX711 y celda de carga reales sin calibrar ni probar; fijación del recipiente. |
| CA-20.2 | Fase 9: «Iniciar toma» llama `iniciar_toma`, que registra `inicio` con la hora del servidor y arranca la duración activa | S | parcial | El criterio habla de un botón; no hay botón físico (la toma se inicia desde la web). Requiere decisión del equipo. |
| CA-20.3 | Fase 9: `crear_toma` asocia el bebé vigente y el dispositivo (`alimentacion.test.mjs`) | S | parcial | Sin Supabase real. |
| CA-20.4 | Fase 9: `iniciar_toma` falla con `toma_sin_peso_inicial`; la web muestra «Pesa el biberón antes de iniciar la toma. Coloca el mismo recipiente que usarás para el pesaje final.» | S | parcial | Sin Supabase real. |
| CA-21.1 | Fase 9: `pausar_toma`, `reanudar_toma`, `finalizar_toma`; la misma toma continúa y la pausa no suma a la duración activa | S | parcial | Sin Supabase real. |
| CA-21.2 | Fase 9: `pedir_peso_toma(final)` solo con la toma `por_cerrar`; la Pico pesa y el peso final queda en la toma | S | parcial | Balanza real sin probar. |
| CA-21.3 | Fase 9: `corregir_toma` y duración final en el historial (`HistorialTomas`) | S | parcial | Sin Supabase real. |
| CA-21.4 | Fase 9: 08:00-08:15 con pausa 08:05-08:07 son 13 min activos; 200 g − 150 g = 50 g; la corrección conserva anterior, autor (solo como «Tú» u «Otro dueño»), fecha y motivo (`alimentacion.test.mjs`, `alimentacion-fase9.test.tsx`) | S | parcial | Sin Supabase real. |
| CA-21.5 | Fase 9: el pesaje de control es solo un evento y no cambia la toma; el cierre es siempre manual (`cerrar_toma`) | S | parcial | Sin Supabase real. |
| CA-21.6 | Fase 9: `cerrar_toma` falla con `toma_incompleta` si falta el peso final o supera al inicial; `corregir_toma` no admite consumo negativo | S | parcial | Sin Supabase real. |
| CA-21.7 | Fase 9: `mis_tomas` entrega pesos, ingerido, inicio, fin, pausas, duración y correcciones | S | parcial | Sin Supabase real. |
| CA-22.1 | Fase 9: `PanelHorarios tipo="recordatorio_alimentacion"` en `/alimentacion` (`alimentacion-fase9.test.tsx`) | S | parcial | Sin Supabase real. |
| CA-22.2 | Fase 4 y 9: `procesar_horarios` registra el recordatorio a diario y el notificador lo envía por Telegram (doble) | S | parcial | Sin Telegram real. |
| CA-22.3 | Fase 4: `procesar_horarios` genera un recordatorio por día a las horas configuradas, en `America/Costa_Rica`; fase 9: prueba específica con 08:00 y 11:00 | S | parcial | Sin Supabase real. |
| CA-22.4 | Fase 4: las horas vencidas se omiten (DEC-04, DEC-10). | S | parcial | Gráficos y exportación (fase 10). |
| CA-23.1 | Fase 9: la Pico mide el DS18B20 cada 30 s y envía `temperatura_biberon`; no informa 85,0 °C ni lecturas fuera de rango (`test_alimentacion.py`) | S | parcial | Sonda real sin probar. |
| CA-23.2 | Fase 9: `PanelLimitesBiberon` y `guardar_limites_biberon` (mínimo menor que máximo, -10 a 100 °C) | S | parcial | Sin Supabase real. |
| CA-23.3 | Fase 9: `evaluar_biberon` abre un episodio de frío o de calor y avisa una vez por episodio y destinatario | S | parcial | Sin Telegram real. |
| CA-23.4 | Fase 9: el control no tiene ninguna salida; la pantalla no ofrece calentar, enfriar ni dar de comer (prueba de ausencia en firmware y web) | S | parcial | Revisión eléctrica del montaje real. |

Son 4 + 7 + 4 + 4 = 19 criterios, todos con prueba simulada (S) y ninguno verificado. El botón físico de inicio (CA-20.2) no existe.

## HU-24 a HU-27 · Historial, gráficos y exportación (fase 10)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-24.1 | `ts`, `recibido_en` y datos en `lecturas_ambiente` y `eventos_movimiento` · Fase 4: `public.eventos` · Fase 10: `public.historial_bebe` (migración 000800) une `eventos`, `lecturas_ambiente` y `eventos_movimiento` por bebé; `supabase/tests/historial.test.mjs`. | S | parcial | Sin Supabase real ni productores reales. El juego es local y no genera registros (decisión de la fase 8). |
| CA-24.2 | Mediciones de ambiente y movimiento, órdenes de lámpara · Fases 5 a 9: movimiento, audio, voz, colchón, habitación y alimentación van a `eventos` · Fase 10: el historial los reúne y la web los lista (`tests/historial-pagina.test.tsx`). | S | parcial | Sin datos de dispositivos reales. Las órdenes de lámpara siguen en su tabla y no entran al historial. |
| CA-24.3 | Sin permisos de borrado en las migraciones; no hay audio · Fase 10: `historial_bebe` es de solo lectura (prueba «es de solo lectura»). | S | parcial | Falta probar con el historial completo de un Supabase real. |
| CA-24.4 | Igual que CA-05.2 | S | parcial | |
| CA-24.5 | `event_id` PK; `ingesta.test.mjs` y `movimiento.test.mjs` · Fase 4: idempotencia por `event_id` en `registrar_evento` · Fase 10: un movimiento presente en `eventos` y en `eventos_movimiento` se cuenta una sola vez (`historial.test.mjs`). | S | parcial | Sin prueba con reintentos reales de una Pico. |
| CA-24.6 | Datos por fila, bebé y dispositivo guardados · Fase 4: tipo, descripción y datos por evento · Fase 7: fotos ligadas a su evento · Fase 9: tomas con pesos y duración · Fase 10: cada registro del historial lleva bebé, dispositivo, tipo, valor, unidad, toma y foto (solo para dueños). | S | parcial | Sin Supabase real. |
| CA-24.7 | Ningún flujo de borrado; «eliminar la cuenta solicitante conserva la orden original» (`lampara.test.mjs`) · Fase 10: tras reasignar un módulo, cada registro conserva su bebé original (`historial.test.mjs`). | S | parcial | Falta cubrir el retiro de un dueño con registros (fase 11). |
| CA-25.1 | `PaginaHistorial.tsx` consulta `historial_bebe` con la sesión de la persona; mensajes fijos si falla (`tests/historial-pagina.test.tsx`, `tests/historial-servicio.test.ts`). | S | parcial | Sin Supabase real; la consulta es a pedido, no hay actualización periódica. |
| CA-25.2 | `historial_bebe` filtra por `bebe_id` y exige `puede_ver_bebe`; dos bebés separados y reasignación a mitad del intervalo (`historial.test.mjs`); la web consulta solo el bebé elegido. | S | parcial | Sin RLS ni API reales. |
| CA-25.3 | `ResumenNoche.tsx` se calcula en la web a partir del historial; no existe ningún envío a Telegram desde el historial. | S | parcial | Sin Supabase real. |
| CA-25.4 | `intervaloNoche` (inicio y fin elegibles; cruza la medianoche) y el mensaje «No hay registros entre … y …» sin ceros inventados (`tests/historial-utils.test.ts`, `tests/historial-pagina.test.tsx`); en SQL, intervalo vacío devuelve lista vacía y la noche 19:00 a 07:00 de CR reúne ambos días. | S | parcial | Sin datos reales. |
| CA-26.1 | Ambiente, temperatura del biberón y peso como líneas (`GraficoMediciones.tsx`); movimiento, puerta, habitación, colchón, tomas y fotos como eventos por hora y lista. | S | parcial | El juego es local y no tiene registros que graficar. Sin sensores reales. |
| CA-26.2 | `resumirNoche`: cantidad de movimientos y hora de mayor actividad (`tests/historial-utils.test.ts`). | S | parcial | Sin datos reales. |
| CA-26.3 | `conteoPorHora`: 08:15 y 08:59 cuentan en [08:00, 09:00) y 09:00 en [09:00, 10:00) (`tests/historial-utils.test.ts`); histograma (`GraficoEventosPorHora.tsx`) y líneas con fecha, hora y unidad (`GraficoMediciones.tsx`); el servidor entrega el intervalo [desde, hasta). | S | parcial | El dibujo en un navegador real no se comprobó (solo la tabla equivalente en jsdom). |
| CA-26.4 | Una hora sin ningún registro es «Sin datos» y una con mediciones y sin eventos es «0»; las líneas se cortan ante un hueco de más de 30 min (`tests/historial-utils.test.ts`). | S | parcial | El umbral de 30 min para un hueco es una decisión de la fase 10 que conviene confirmar. |
| CA-27.1 a CA-27.5 | `BotonExportar.tsx`, `utils/excel.ts` y `utils/historial.ts` (`filasExcel`); `tests/historial-excel.test.ts` genera el .xlsx con `write-excel-file`, lo descomprime y comprueba encabezados de DEC-06, una fila por registro, valores de toma, fecha y hora de Costa Rica, intervalo vacío con solo encabezados y ausencia de fotos y enlaces; no se exporta un resultado truncado. | S | parcial | El archivo no se abrió en Excel real ni se probó la descarga en un navegador real. Los valores de las filas salen de la misma consulta del historial. |

## HU-28 a HU-30 · Recuperación, maqueta y rendimiento (fases 11 y 12)

| CA | Evidencia | Prueba | Estado | Brecha |
|---|---|---|---|---|
| CA-28.1 | Ni `docs/Sprint3/alcance.md` ni el firmware incluyen UPS | D | parcial | Confirmar con la lista de componentes (HU-33). |
| CA-28.2 | Perder Wi-Fi apaga la lámpara y detiene el colchón (`test_control_colchon.py`; `lampara_remota.py`) · Fase 11: tras cada corte se descartan las órdenes pendientes y se vuelve a informar el estado (`test_recuperacion_firmware.py`). | S | parcial | Sin corte real de red ni de energía. |
| CA-28.3 | Colchón detenido y rearme con referencia nueva (firmware) · Fase 11: al conectar, la Pico informa su estado real con `reportar_estado_modulo` y el servidor deja de aceptar eventos de un monitoreo apagado; un colchón informado detenido exige armar de nuevo; un recordatorio vencido se omite y el siguiente horario futuro se ejecuta una vez; una lectura atrasada ya no cierra ni reabre un episodio (`supabase/tests/recuperacion.test.mjs`, `src/firmware/tests/test_recuperacion_firmware.py`). | S | parcial | Sin reinicio real de una Pico ni corte real contra Supabase. |
| CA-28.4 | `/cuna` marca «Desactualizado» a los 30 s (`PaginaCuna.tsx`) · Fase 11: el panel del colchón muestra «detenido al reiniciarse o reconectarse el módulo» (`tests/colchon-fase6.test.tsx`) y la web ya no queda con un monitoreo activo que la Pico perdió. | S | parcial | Sin prueba con una Pico real. |
| CA-29.1 a CA-29.4 | [`guion-demostracion.md`](guion-demostracion.md): guion por módulo (cuna, figuras, colchón independiente, habitación, juego y alimentación con pesaje), cuándo cambiar de protoboard, acción del adulto, respuesta física y registro esperado; baterías del juego y alimentación del colchón; dimensiones y materiales remitidos a [`diseno-fisico.md`](diseno-fisico.md). | D | parcial | El guion no se ha ejecutado con hardware ni con cuentas de demostración; la tabla de resultados está vacía. Las dimensiones son propuestas sin cotejar y una sustitución de sensor aún no se coordina con el profesor. |
| CA-30.1 | `supabase/scripts/rendimiento.mjs`: 100 consultas de `historial_bebe` con 2 cuentas, 2 bebés, 6 módulos y 1000 registros; ver [`validacion-fase11.md`](validacion-fase11.md) para los tiempos medidos. | S | parcial | Medido en PGlite (memoria, una conexión), no en el Supabase real ni con la red de la demostración. |
| CA-30.2 | Misma medición: 100 solicitudes de envío desde la recepción del evento hasta la llamada al envío, con un envío simulado · migración `20261118001000_notificador_inmediato.sql` (disparador con `pg_net`) para no esperar al cron de 1 minuto. | D | parcial | El disparador con `pg_net` no se ejecutó en ninguna prueba; la entrega real de Telegram no se midió. |
| CA-30.3 | `INTERVALO_AMBIENTE_S = 10` · Fase 11: simulación del ciclo con reloj simulado (`PeriodicidadTests`). | S | parcial | Sin medición en la Pico. |
| CA-30.4 | `COLCHON_INTERVALO_MS = 1000` · Fase 11: simulación del ciclo con reloj simulado (`PeriodicidadTests`). | S | parcial | Sin medición en la Pico ni con la celda de carga. |

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
| CA-34.1 | RLS y permisos de RPC · Fase 11: `privacidad.test.mjs`: una persona ajena y una destinataria de Telegram no ven eventos, lecturas, fotos ni objetos del almacén, y 8 funciones las rechazan; ningún rol de la API puede escribir ni borrar tablas del proyecto. | S | parcial | Falta contra la API real (PostgREST y Storage reales). |
| CA-34.2 | `duenos_dispositivo.activo` condiciona `select` y RPC · Fase 11: retirar a un dueño le quita datos, fotos, órdenes e historial y conserva los registros; una destinataria de Telegram no tiene control (`privacidad.test.mjs`). | S | parcial | Sin API real. |
| CA-34.3 | Sin borrado ni permisos de escritura en la API · Fase 11: reasignar un módulo conserva todos los registros (`privacidad.test.mjs`). | S | parcial | Sin Supabase real. |
| CA-34.4 | Igual que CA-05.1 y CA-05.2 · Fase 11: tras reasignar, lo nuevo se vincula al bebé nuevo y el historial de cada bebé muestra solo lo suyo (`privacidad.test.mjs`). | S | parcial | Sin Supabase real. |
| CA-34.5 | No existe ninguna transmisión de voz guardada · Fase 11: ninguna columna del esquema puede guardar sonido (`bytea`) y una sesión de voz deja solo los registros `voz_inicio` y `voz_fin` sin datos (`privacidad.test.mjs`). | S | parcial | Prueba con Realtime real y con el micrófono. |
| CA-35.1 | — | — | pendiente | `docs/Sprint3/validacion-base.md` deja pendiente la revisión a 360 y 1280 px. |
| CA-35.2 | `/cuna` muestra °C, % HR y estados | S | parcial | Solo para las pantallas existentes. |
| CA-35.3 | — | — | pendiente | |

## Resumen por estado

Conteo de los 145 criterios del PDF, expandiendo las filas agrupadas (comprobado con un script que exige que cada CA del PDF aparezca una sola vez):

| Estado | Criterios |
|---|---|
| verificado | 3 (CA-31.1, CA-32.2, CA-32.4; los tres solo con evidencia documental) |
| parcial | 139 |
| pendiente | 3 |
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
