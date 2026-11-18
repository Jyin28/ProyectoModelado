# Traspaso para las fases 7 a 12

**Estado al cierre de la fase 6, 2026-11-17.** Este documento deja listo el trabajo de las fases 7 a 12 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md). No sustituye al plan: indica desde dónde seguir, qué piezas se pueden reutilizar y qué quedó pendiente.

## 1. Ramas y orden de revisión

Las ramas están encadenadas y todas sus commits son **locales**: no se hizo push de las fases 3 a 6. Las fases 1 y 2 sí tienen rama remota.

| Rama | Base | Commits propios | Validación |
|---|---|---|---|
| `docs/fase1-linea-base` | `development` (`386ca9a`) | 6 | [`validacion-fase1.md`](validacion-fase1.md) |
| `docs/fase2-diseno-fisico` | fase 1 | 3 | [`validacion-fase2.md`](validacion-fase2.md) |
| `feat/fase3-cuentas` | fase 2 | 3 (`94b4624`, `aa9afa4`, `be2e0b3`) | [`validacion-fase3.md`](validacion-fase3.md) |
| `feat/fase4-avisos` | fase 3 | 3 (`363d50b`, `8e8b4ed`, `e70bbcf`) | [`validacion-fase4.md`](validacion-fase4.md) |
| `feat/fase5-cuna-figuras` | fase 4 | 5 (`8467d57`, `b9e4de9`, `42b9422`, `4d57d54`, `94abb8d`) | [`validacion-fase5.md`](validacion-fase5.md) |
| `feat/fase6-colchon` | fase 5 | 4 (`a3b9b55`, `5e15404`, `f6bfa2f`, `8eb8a00`) más el de este traspaso | [`validacion-fase6.md`](validacion-fase6.md) |

Para seguir: `git switch feat/fase6-colchon` y crear `feat/fase7-habitacion` desde ahí. Cada rama depende de la anterior (las migraciones tienen numeración consecutiva), así que los pull requests deben abrirse y fusionarse en orden, cada uno hacia la rama anterior o hacia `development` una vez fusionada la anterior. No fusionar una fase sin la anterior.

Resultado de las suites al cierre de la fase 6, todas verdes:

| Suite | Resultado |
|---|---|
| `npm.cmd test` en `supabase` | 97 pruebas |
| `npm.cmd test` en `src/frontend` | 24 archivos, 289 pruebas; lint y build sin hallazgos |
| `python -m unittest discover -s src/firmware/tests` (raíz) | 257 pruebas |

La matriz [`matriz-hu-ca.md`](matriz-hu-ca.md) quedó en **3 verificados, 91 parciales, 51 pendientes**. Todo lo parcial tiene evidencia simulada (S). **Nada tiene evidencia física (F) ni se probó contra Supabase real.**

## 2. Qué quedó hecho

| Fase | Resultado | Límite principal |
|---|---|---|
| 3 · Cuentas | Registro, bebés, módulos con código de reclamo, dueños compartidos, invitaciones, reasignación con vigencia | No se envía correo de invitación (sin SMTP) |
| 4 · Avisos | `eventos` unificado, destinatarios de Telegram con código, avisos idempotentes, horarios, episodios, Edge Functions `notificador` y `telegram-webhook` | Sin bot ni `pg_cron` reales; latencia de hasta 60 s |
| 5 · Cuna y figuras | `ordenes_modulo`, límites, monitoreo de movimiento, audio, voz por Realtime, figuras con rampas | Voz sin probar con hardware; catálogo de audio de un solo tono |
| 6 · Colchón | Configuración, eventos de alarma y parada, estado, `/colchon` | El estado viene del último evento; sin prueba con HX711 |

## 3. Piezas reutilizables para las fases 7 a 12

**Órdenes a un módulo nuevo** (por ejemplo, la cámara o los botones). Una orden nueva toca cuatro sitios y sus pruebas:

1. SQL: en `cuna_private.params_orden_validos` (rango de parámetros), en el `check` de `public.ordenes_modulo.command` y en la regla de `solicitar_orden` que liga cada comando con su patrón de módulo (`cuna-<tipo>-NN`). Si cambia el estado visible, también en `cuna_private.aplicar_confirmacion`. El patrón de `device_id` de la tabla ya admite `figuras|audio|movimiento|colchon`: **habrá que ampliarlo** para `habitacion`, `juego` y `alimentacion`.
2. Firmware: `common/utilities/comandos.py` (mismo nombre y rangos) y `common/utilities/modulo.py` (`_COMANDOS` y `PERIFERICOS`).
3. Web: `models/ordenes.ts` (tipo y lista de comandos) y `utils/ordenes.ts` (`comandoValido`).
4. Contrato: `src/shared/contracts/ordenes.md`.

**Eventos de un módulo nuevo.** El patrón del colchón (fase 6) es el modelo: validador por tipo en `supabase/functions/ingesta/handler.ts`, una RPC `ingestar_<modulo>` que valida la forma exacta, llama a `cuna_private.registrar_evento` (idempotente por `event_id`, con aviso opcional) y fija el estado visible si hace falta. Existe también la RPC genérica `public.ingestar_evento` (fase 4), que sirve para tipos simples sin estado propio. En firmware, `common/communication/cola_eventos.py` y `EnvioAmbiente.registrar_evento_colchon` muestran cómo encolar eventos con `event_id` fijo y enviarlos desde el único hilo de red; para otro módulo hay que agregar su credencial (`_credencial_<modulo>` en `ambiente.py`).

**Horarios y recordatorios.** `cuna_private.horarios` y `procesar_horarios` ya generan eventos `recordatorio_<algo>` con aviso a Telegram (hoy el texto de `recordatorio_alimentacion` está fijo) y órdenes para `figuras_*` y `movimiento_*` mediante `crear_orden_horario`. Los recordatorios de alimentación de la fase 9 solo necesitan su pantalla (el componente `PanelHorarios` recibe el tipo) y, si hace falta, otro texto. Un horario solo se ejecuta en el minuto exacto; los vencidos se omiten (DEC-04 y DEC-10).

**Web.** `useOrdenModulo` (consulta cada 2 s, sin estado optimista), `EstadoOrdenModulo` (estados del contrato), `PanelHorarios`, `useEventosColchon` (generalizable a otros tipos de evento), `services/ordenes.ts` (`llamar` y el mapa de mensajes seguros: el texto del servidor nunca se muestra) y las banderas `VITE_ORDENES_HABILITADAS` y `VITE_VOZ_HABILITADA` en `services/configuracion.ts`. Para un módulo nuevo: servicio en `services/`, interfaz en `services/tipos.ts`, stub en `noConfigurado.ts` y alta en `ProveedorServicios.tsx`.

**Cuentas de dispositivo.** Una cuenta de Auth por Pico, ligada a un `device_id` en `cuna_private.cuentas_dispositivo`, recibe las órdenes de todos los módulos de su `producto_id` por el canal `modulo:<producto_id>`. `dispositivos.tipo` ya admite `habitacion`, `juego` y `alimentacion`.

## 4. Decisiones tomadas que conviene confirmar

- **Una tabla de órdenes para todos los módulos** (decisión abierta 4 de `arquitectura.md` §8): `ordenes_modulo`. `ordenes_lampara` quedó intacta.
- **«Una cuna» es un `producto_id`** (fase 3). Falta confirmarlo con el equipo.
- **El estado del colchón viene de eventos**, no de confirmaciones de órdenes (fase 6).
- **La voz usa Realtime y PCM de 16 bits a 8 kHz** (decisión abierta 1). Es una suposición sin probar con hardware (prueba P2).
- **El mapa de pines del colchón es el de `config.py`**; el de banco quedó marcado como solo de banco.
- **Catálogo de audio:** solo `tono_suave`. No se inventaron sonidos.

Siguen abiertas las decisiones 2, 3, 5 y 6 de `arquitectura.md` §8: si el hueco de un corte cuenta en una toma, qué pasa con una ventana de monitoreo cuando el corte termina dentro de ella, la matriz de navegadores (HU-35) y cómo llegan las fotos (prueba P3).

## 5. Deuda y riesgos conocidos

1. **Pines únicos entre módulos** (hallazgo 1 de la fase 2). `src/firmware/tests/test_config_y_comandos.py:29-31` exige pines distintos entre todos los módulos. Habitación, juego y alimentación necesitan 17 GPIO y quedan 10 libres. Como la Pico atiende un módulo por vez, la unicidad debe exigirse **dentro de cada módulo**. Hay que cambiar esa prueba al empezar la fase 7.
2. **Latencia de los avisos.** Con `pg_cron` cada minuto, Telegram puede recibir el aviso hasta 60 s después. HU-30 pide 5 s desde la recepción en el backend. Propuesta para la fase 11: invocar el notificador desde un disparador con `pg_net` al crearse el aviso.
3. **`20261118000300_cron.sql` no se aplicó ni se probó.** El envío con la web cerrada (CA-07.2) está sin verificar.
4. **Estado tras reiniciar la Pico.** Con el monitoreo de movimiento o del colchón activo, un reinicio devuelve la Pico a apagado sin avisar; el servidor sigue mostrando el último estado informado. La Pico debería informar su estado al reconectar (fase 11).
5. **Lecturas de ambiente fuera de orden** pueden cerrar un episodio antes de tiempo.
6. **Memoria y pila del hilo de red** (WSS de órdenes, voz, eventos del colchón) sin medir en la Pico. Si hay fallos de memoria, el primer ajuste es el tamaño de la pila en `ambiente.iniciar`.
7. **Realtime y la voz.** Falta confirmar que los mensajes difundidos por los clientes no se guardan en `realtime.messages`.
8. **Una celda de 5 kg no sirve para un colchón comercial** (hallazgo 3 de la fase 2).
9. **Advertencias de fin de línea.** Git avisa «LF will be replaced by CRLF» en los archivos nuevos; es solo un aviso de esta máquina y no cambia el contenido.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta | Fases que afecta |
|---|---|---|
| Supabase real | Autorización para aplicar las migraciones 000100 a 000500 y desplegar las funciones en `cuna-inteligente-dev` | Todas (CA-32.3 sigue pendiente) |
| Telegram real | Un bot de prueba, su token como secreto y `setWebhook` con `secret_token` | 4, 5, 6, 9, 11 |
| `pg_cron` y Vault | Secretos `project_url` y `notificador_secret` | 4, 11 |
| Hardware | Pico, HX711, celdas, PIR, AM2301, MAX98357A, parlante, LED, buzzer, botón; cámara, reed, botones arcade y DS18B20 para las fases 7 a 9 | 5 a 12 |
| Fotos (prueba P3) | Autorización para crear un almacén de prueba en `cuna-inteligente-dev` | 7 |
| Normas y profesor | Cotejar normas de cuna y juguetes; coordinar sustituciones de sensores | 2, 12 |

## 7. Qué hacer en cada fase que sigue

- **Fase 7 · Habitación (HU-17, HU-18).** Sensor de puerta y movimiento con monitoreo manual o por horario, y fotografías. Reutilizar el monitoreo de movimiento de la cuna (`motion_set`, `ingestar_movimiento` y `estado_modulo`) para el patrón «activar, desactivar, omitir si está apagado». Fotos: decidir P3 antes de construir; el aviso de Telegram nunca lleva imagen (CA-07.4).
- **Fase 8 · Juego (HU-19).** Cinco botones. Es el módulo con más GPIO: resolver antes el hallazgo 1.
- **Fase 9 · Alimentación (HU-20 a HU-23).** Balanza (HX711 como en el colchón), estados de toma, correcciones, recordatorios (`procesar_horarios`) y temperatura del biberón. Las tomas necesitan su propio contrato; DAT-02 exige conservar las correcciones.
- **Fase 10 · Historial (HU-24 a HU-27).** Unificar ambiente y movimiento en `eventos` (hoy tienen sus tablas), historial por bebé, resumen de noche, gráficos y exportación `.xlsx` (sin fotos ni enlaces). `PaginaHistorial.tsx` sigue siendo un marcador.
- **Fase 11 · Recuperación y privacidad (HU-28, HU-30, HU-34, HU-35).** Los puntos 2 a 7 de la sección 5, medir tiempos, revisar el flujo de revocación y probar a 360 y 1280 px.
- **Fase 12 · Demostración (HU-29).** Guion de la maqueta modular, con las pruebas físicas que hoy faltan.

## 8. Indicación lista para continuar

> Ejecutá las fases 7 a 12 de `docs/Sprint4/PLAN-PROYECTO.md`. Partí de la rama `feat/fase6-colchon`, creá una rama por fase encadenada (`feat/fase7-habitacion`, etc.) y hacé commits locales, sin push. Leé primero `docs/Sprint4/traspaso-fase7.md` y la `validacion-fase6.md`. Seguí las reglas de los `CLAUDE.md` (raíz y `src/frontend`): no crear nada en `cuna-inteligente-dev`, no leer ni mostrar credenciales, no declarar verificado lo que no se comprobó, controles de hardware solo detrás de banderas `VITE_*_HABILITADA`, no modificar la documentación protegida, usar `npm.cmd` en PowerShell. Al empezar la fase 7, cambiá la prueba de pines únicos para que se exija dentro de cada módulo. Al cerrar cada fase corré las tres suites, buscá secretos con `git grep`, escribí `validacion-faseN.md` con los comandos y resultados reales, actualizá `matriz-hu-ca.md` con un recuento que dé 145 criterios, y cerrá con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Todo lo probado con dobles queda como parcial (S).
