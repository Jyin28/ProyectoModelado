# Integración del Sprint 3

Rama de trabajo: **`integracion/sprint3`**, creada desde `development` (0029f22). No se hizo push.

## 1. Qué se integró y de dónde

| Origen | Referencia revisada | Qué se tomó |
|---|---|---|
| `development` | `0029f22` | Base: fases 3 a 9 (cuentas, bebés, dueños, Telegram, límites, órdenes por módulo, voz, colchón fase 6, habitación, juego, alimentación). |
| `origin/feat/fase12-cierre` (= fases 10 a 12; `origin/feat/fase9-alimentacion` 7a0ab2e lo contiene) | `55e6a23` | Historial por bebé, resumen de noche, gráficos, Excel, estado informado. Merge `7191400`. No se reescribió nada: ya estaba. |
| `VersionFunc` — colchón de Kevin | `30af665` | Página, servicio, hook y modelo web del colchón, migraciones `eventos_colchon`/`ordenes_colchon`, cambios de `src/firmware/pico/`. Se adaptó (ver 2). Commit `d08fd21`. |
| `VersionFunc` — firmware | `659b98b` | Arreglo del TLS (`cadata`), `rutas.py`, PIR estabilizado, sonido WAV `prueba`, cableado real. Commit `6b5dc33`. |
| `src/firmware/codigo funcional/` (sin seguimiento de Git) | copia local | Solo se usó como referencia de cableado y comportamiento. **No se modificó ni se versionó.** |

### Lo que NO se llevó, y por qué
- El módulo `"completo"` y los efectos autónomos de `pico2` (patrones de LED y lámpara que respira): contradicen una Pico por módulo y el control remoto de la lámpara y las figuras.
- La carpeta `src/firmware/pico2/` de `VersionFunc`: es una copia antigua del firmware; sus arreglos se llevaron al firmware unificado.
- `main.py`, `mfrc522.py` y `dados.py` del código funcional (lector RFID y dados): otro proyecto, sin historia en este sprint, y usan los mismos GP2/GP3 que el AM2301 y el PIR.
- El dispositivo `pico2-cuna-01` que se probó con el firmware antiguo: la tabla `limites_ambiente` solo admite ids `cuna-ambiente-NN`, así que ese id **nunca tendría límites, episodios ni avisos de Telegram**. El módulo de ambiente real es `cuna-ambiente-01`.

## 2. Cambios principales

- **Colchón: conviven dos implementaciones.** La de `development` (fase 6, `cuna-colchon-NN`, órdenes por módulo) queda intacta en `/colchon`. La de Kevin (la terminada, la que usa la base desplegada) pasa a nombres propios: `colchonPico.ts`, `useColchonPico.ts`, `PaginaColchonPico.tsx`, ruta `/colchon-pico`, variable `VITE_COLCHON_PICO_DEVICE_ID`.
- **Migraciones.** Las de Kevin se renumeraron (`20261118001100`) porque chocaban con las de la fase 3, y se endurecieron sus permisos para cumplir CA-34.1 (ningún rol de la API escribe tablas). El alta de usuario de prueba pasó a `supabase/scripts/`. `ingestar_lote`, que solo existía en la base remota, se versionó (`20261118001300`).
- **Función `ingesta` (Edge Function).** Acepta el **lote** de la Pico del colchón y de la Pico 2 W y, además, el **evento único** de `development` (`enrutador.ts`, `lote.ts`). En lote, el ambiente va por `ingestar_ambiente` (límites, episodios y avisos) y el movimiento por `ingestar_movimiento`. Con el monitoreo apagado responde 409.
- **Firmware unificado.** TLS corregido, `rutas.py`, PIR estabilizado (60 s + 2 s), sonido `prueba` (WAV), LED en GP6–GP11 e I²S en GP18–GP20.
- **Pruebas del frontend independientes de `.env.local`** (`vite.config.ts`).

## 3. Las 20 historias

Estado: **Implementada** = código y pruebas con dobles (PGlite, Vitest, Python de escritorio). Ninguna está verificada contra Supabase real ni con hardware; el detalle por criterio está en `docs/Sprint4/matriz-hu-ca.md`.

| PM | HU | Estado | Archivos principales | Prueba realizada | Pendiente concreto |
|---|---|---|---|---|---|
| PM-55 | HU-01 | Implementada | `services/auth.ts`, `PaginaLogin.tsx`, `PaginaRegistro.tsx` | `auth.test.ts`, `sesion.test.tsx`, `paginaRegistro.test.tsx` | Supabase Auth real y confirmación por correo. |
| PM-59 | HU-02 | Implementada | `migrations/…000100_cuentas_propiedad.sql`, `services/cuentas.ts`, `PaginaBebesDispositivos.tsx` | `cuentas.test.mjs` (dos bebés separados) | Con Supabase real. |
| PM-63 | HU-03 | Implementada | idem (`reclamar_dispositivo`) | `cuentas.test.mjs` (código de un solo uso, una cuna por bebé) | El alta física del código la hace un administrador. |
| PM-67 | HU-04 | Implementada | idem | `cuentas.test.mjs`: la invitación concede acceso solo al aceptarla; retirar revoca; no se retira al último dueño | No se envía el correo de invitación (sin SMTP). |
| PM-71 | HU-05 | Implementada | idem | `cuentas.test.mjs`, `historial.test.mjs`: tras reasignar, cada registro conserva su bebé | Con Supabase real. |
| PM-75 | HU-06 | Implementada | `…000200_avisos_telegram.sql`, `services/telegram.ts`, `functions/telegram-webhook` | `avisos.test.mjs`, `notificador.test.mjs` (Telegram simulado) | Un bot real y una cuenta de Telegram. |
| PM-80 | HU-07 | Implementada | `functions/notificador`, `…000300_cron.sql`, `…001000_notificador_inmediato.sql` | `avisos.test.mjs`, `notificador.test.mjs`, `lote.test.mjs` (un aviso por destinataria y por episodio) | **`pg_cron` y `pg_net` no están activos en el Supabase remoto**; entrega real a Telegram. |
| PM-84 | HU-08 | Implementada | `firmware/common/sensors/pir.py`, `ambiente.py`, `ingestar_movimiento`, `PanelMovimiento.tsx` | `lote.test.mjs`, `ordenes-modulo.test.mjs`, `test_pir.py` | PIR real enviando a `cuna-movimiento-01` (módulo registrado y función desplegada; falta la prueba con la Pico). |
| PM-88 | HU-09 | Implementada | `ambiente.py`, `PaginaCuna.tsx`, `services/lecturas.ts` | `lote.test.mjs`, `test_ambiente_tls.py`, `paginaCuna.test.tsx`. **Prueba física previa** (2026-11-19, firmware antiguo `pico2`, dispositivo de prueba `pico2-cuna-01`): 3 lecturas con HTTP 200 y 3 filas en `lecturas_ambiente` | Repetir con `cuna-ambiente-01` y el firmware unificado. |
| PM-92 | HU-10 | Implementada | `guardar_limites`, `PanelLimites`, `…000400_ordenes_modulo.sql` | `ordenes-modulo.test.mjs`, `lote.test.mjs` (salir, seguir fuera, volver y salir de nuevo) | Telegram real. |
| PM-96 | HU-11 | Implementada | `lampara_remota.py`, `audio.py`, `PanelLampara.tsx`, `PanelAudio` | `lampara*.test.mjs`, `test_lampara_remota.py`, `test_audio.py` (incl. WAV) | Lámpara y I²S reales. Catálogo: `tono_suave` y `prueba` (antes solo el tono). |
| PM-100 | HU-12 | Implementada | `utils/voz.ts`, `useVoz.ts`, `services/ordenes.ts`, `firmware/cuna/voz.py` | `ordenes-modulo.test.mjs` (canal privado, voz sin guardar), `test_voz.py` | **Micrófono del celular, red y parlante reales.** `prueba.wav` no la demuestra. |
| PM-104 | HU-13 | Implementada | `figuras.py`, `comandos.py`, `PanelFiguras.tsx` | `ordenes-modulo.test.mjs`, `paneles-fase5.test.tsx`, **`test_figuras_intervalo.py`** (nueva: 1,9 s rechazado, 2 s aceptado, independiente de la lámpara) | LED reales. |
| PM-148 | HU-24 | Implementada | `…000800_historial.sql` (`historial_bebe`) | `historial.test.mjs`, `lote.test.mjs` (reenvío no duplica; misma hora, dos eventos) | Con Supabase real. |
| PM-152 | HU-25 | Implementada | `PaginaHistorial.tsx`, `ResumenNoche.tsx`, `utils/historial.ts` | `historial.test.mjs` (noche 19:00–07:00), `historial-utils.test.ts` | Con Supabase real. |
| PM-156 | HU-26 | Implementada | `GraficoMediciones.tsx`, `GraficoEventosPorHora.tsx` | `historial-utils.test.ts` (sin datos ≠ cero; hueco de 30 min) | Verlos dibujados en un navegador real. |
| PM-160 | HU-27 | Implementada | `BotonExportar.tsx`, `utils/excel.ts` | `historial-excel.test.ts` y un **`.xlsx` real abierto con `openpyxl`**: 12 columnas de DEC-06, una fila por registro, sin fotos ni enlaces, período vacío = solo encabezados | Abrirlo en Excel real (no hay Office instalado). |
| PM-112 | HU-14 | **Conservada** | `PaginaColchonPico.tsx`, `colchonPico.ts`, `src/firmware/pico/`, `…001100_eventos_y_ordenes_colchon.sql` | `colchonPico.test.ts`, `paginaColchonPico.test.tsx`, `lote.test.mjs` | `src/firmware/pico/` no tiene pruebas versionadas. |
| PM-116 | HU-15 | **Conservada** | idem | `lote.test.mjs` (los cuatro eventos del colchón, reenvío idempotente) | Balanza real. |
| PM-120 | HU-16 | **Conservada** | idem | `lote.test.mjs` (ciclo de órdenes: pedir, tomar una sola vez, confirmar; una persona ajena no puede) | Pico real. |

## 4. Comandos y resultados (2026-11-19)

| Comando | Resultado |
|---|---|
| `cd supabase; npm.cmd test` | 200 de 200 (base 184 + 16 nuevas) |
| `cd src\firmware; python -m unittest discover -s tests` | 410 OK (base 378 + 32 nuevas) |
| `cd src\frontend; npm.cmd run lint` | sin errores; **1 aviso**: `Date.now` durante el render en `useColchonPico.ts` (código de Kevin, sin tocar) |
| `cd src\frontend; npm.cmd run build` | OK (aviso de tamaño de bloque, ya existía) |
| `cd src\frontend; npm.cmd test` | 442 de 442 (base 434 + 8 nuevas) |

Fallos abiertos de pruebas: ninguno. Durante el trabajo salieron y se resolvieron: 8 fallos del frontend por mi `.env.local` (ahora las pruebas lo ignoran), 3 del backend por una migración de datos de prueba y 2 por permisos de tablas de Kevin.

## 5. Estado del Supabase remoto (`cuna-inteligente-dev`)

Aplicado el 2026-11-19 con autorización expresa:

| Qué | Resultado |
|---|---|
| Migraciones `historial`, `recuperacion`, `eventos_y_ordenes_colchon_endurecido`, `ingestar_lote` | Aplicadas. Existen `historial_bebe` y `reportar_estado_modulo`; `eventos_colchon` y `ordenes_colchon` quedan solo de lectura para `authenticated`; los 75 eventos del colchón siguen intactos. |
| Edge Function `ingesta` | Desplegada como **versión 6** (JWT desactivado). Probada con token falso en los diez caminos (lote de ambiente, movimiento y colchón; evento único; 400, 401, 405 y 413). |
| Módulos `cuna-ambiente-01` y `cuna-movimiento-01` | Con credencial nueva (tokens solo en `src/firmware/secrets.py`, ignorado por Git), bebé y dueño asignados. No tenían datos. |

Aplicado después, también con autorización expresa:

| Qué | Resultado |
|---|---|
| Módulos `cuna-audio-01` y `cuna-figuras-01` | Registrados (producto `cuna-01`, bebé y dueña asignados). `cuna-movimiento-01` pasó a tener producto `cuna-01`. |
| Cuenta de dispositivo de la Pico | `pico.cuna@example.com`, vinculada a `cuna-lampara-01` (producto `cuna-01`). Reemplaza a `elmenma1890@gmail.com`, que era la cuenta anterior de ese módulo. Inicia sesión y el sistema la reconoce (`tomar_orden_modulo` responde 200). Su contraseña solo está en `src/firmware/secrets.py`. |
| Telegram | Funciones `notificador` y `telegram-webhook` desplegadas (JWT desactivado), `pg_cron` y `pg_net` activos, trabajos `notificador` y `procesar-horarios` cada minuto, disparador de aviso inmediato, secretos de Vault `project_url` y `notificador_secret`, webhook del bot `@cunabot_bot` registrado. |
| Aviso de `aura@gmail.com` como dueña | Dueña de ambiente, movimiento, lámpara, audio, figuras y colchón. Una cuenta no puede ser a la vez cuidadora y dispositivo (disparador `separar_cuenta_dispositivo`). |

**Sigue pendiente**
1. Vincular un chat de Telegram desde la web (Destinatarios de Telegram). Los secretos de las funciones están en Vault (`public.leer_secreto_funcion`, migración `20261119001400`) porque el panel de secretos no estaba disponible; si luego se crean como secretos de Edge Functions, estos tienen prioridad.
2. Prueba positiva con la Pico real. Ningún dato falso se envió a los módulos reales.
3. `pico2-cuna-01` es un dispositivo de prueba antiguo; se puede desactivar.
4. Quien despliegue otra versión de `ingesta` sobrescribe a la anterior.
5. El token del bot se compartió en un chat: conviene regenerarlo con BotFather (`/revoke`) cuando termine la puesta en marcha.

## 6. Levantar el proyecto en Windows

```powershell
# Web (Node 24; si npm no se reconoce, activa fnm: fnm env --use-on-cd --shell power-shell | Out-String | Invoke-Expression; fnm use 24.22.2)
Set-Location .\src\frontend
npm.cmd ci
Copy-Item .env.example .env.local     # completa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY
npm.cmd run dev                        # abre http://localhost:5173
# Pruebas
Set-Location ..\..\supabase;  npm.cmd ci; npm.cmd test
Set-Location ..\src\firmware; python -m unittest discover -s tests
```

Si `npm ci` falla con `EPERM` sobre `rolldown-binding…node`, un servidor de Vite sigue abierto: ciérralo y repite.

## 7. Demostrar lo que requiere hardware

Para cada prueba: **Pico 2 W con MicroPython 1.28**, hotspot del teléfono (2,4 GHz) y Thonny. Sube el **contenido de `src/firmware/`** a la raíz de la Pico (`main.py`, `secrets.py` y las carpetas) y copia aparte `prueba.wav` (de `codigo funcional/`) a la raíz. `secrets.py` sale de `secrets.example.py`; no se versiona. Solo se conecta **un módulo por vez** (`MODULO` en `common/utilities/config.py`) y los pines siguen **sin revisión eléctrica** del equipo.

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Ambiente (HU-09) | `MODULO = "cuna"`; `AMBIENTE_*` en `secrets.py`; ejecutar `main.py` | «hora UTC sincronizada» y `Ambiente: HTTP 201` cada 10 s (evento único; el 200 es del formato de lote); la fila aparece en `/cuna` y en `lecturas_ambiente`. |
| Límites y Telegram (HU-10, HU-07) | Guardar límites en `/cuna`; calentar el sensor con la mano | Un aviso por destinataria al salir del rango, ninguno más mientras siga fuera, otro si vuelve y sale. Requiere `pg_cron`/notificador desplegados y un bot real. |
| Movimiento (HU-08) | `MONITOREO_MOVIMIENTO_HABILITADO = True`; esperar «PIR listo» (≈62 s); pasar la mano | `Movimiento: HTTP 201`; evento y aviso. Con el monitoreo apagado desde la web, 409 y nada se guarda. |
| Lámpara (HU-11) | `LAMPARA_*`; `/cuna` con `VITE_LAMPARA_HABILITADA=true` | La luz cambia solo con la confirmación de la Pico. |
| Audio (HU-11) | `AUDIO_HABILITADO = True`; `audio_play` con `prueba` o `tono_suave` | Suena en el parlante; la web registra el evento. |
| Voz (HU-12) | `VOZ_HABILITADA = True` y `AUDIO_HABILITADO = True`; `/cuna`, botón «Hablar» (`VITE_VOZ_HABILITADA=true`) | La voz sale por el parlante mientras se habla; no queda ningún audio guardado. |
| Figuras (HU-13) | `MODULO = "figuras"`; `/figuras` con `VITE_ORDENES_HABILITADAS=true` | Encender/apagar, secuencia con intervalo ≥ 2 s; 1,9 s se rechaza. |
| Colchón (HU-14 a 16) | `src/firmware/pico/` (Pico del colchón) y `/colchon-pico` | Monitoreo, alarma por pérdida de peso y rearme, como antes de integrar. |

Guion completo: `docs/Sprint4/guion-demostracion.md`; pruebas de banco: `docs/Sprint4/protocolo-banco.md`.
