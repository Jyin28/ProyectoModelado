# Validación de la fase 4 · Eventos, Telegram y horarios compartidos

**Resultados reales de la ejecución del 2026-11-17.** Fase 4 de [PLAN-PROYECTO.md](PLAN-PROYECTO.md): HU-06, HU-07 y base de HU-24.

| Dato | Valor |
|---|---|
| Rama base | `feat/fase3-cuentas` |
| Rama de trabajo | `feat/fase4-avisos` (commits locales, sin push) |
| Sistema | Windows 11 Pro 10.0.26200 |
| Node.js / Python | 26.13.1 / 3.15.2 |

Commits: `git log feat/fase3-cuentas..feat/fase4-avisos`.

## 1. Qué se construyó

**Base de datos** (`supabase/migrations/20261118000200_avisos_telegram.sql`; solo archivo local):

- `public.eventos`: registro unificado (tipo, descripción, valor, unidad, datos) con bebé y módulo, RLS de dueño activo y sin escritura directa. `cuna_private.registrar_evento` es idempotente por `event_id` y crea un aviso por destinatario vinculado.
- `destinatarios_telegram`, `codigos_vinculacion` (solo se guarda el hash; 15 minutos; un código nuevo invalida el anterior), `avisos` con unicidad `(event_id, destinatario_id)`, `intentos_aviso` con cada intento, `horarios`, `ejecuciones_horario` y `episodios`.
- RPC web: `crear_destinatario`, `generar_codigo_vinculacion`, `retirar_destinatario`, `mis_destinatarios`, `reemplazar_horarios`, `mis_horarios`.
- RPC de servicio: `ingestar_evento`, `vincular_telegram`, `avisos_pendientes` (reserva 2 minutos para evitar envíos dobles), `registrar_intento_aviso` (hasta 5 intentos con espera creciente; error no reintentable falla de inmediato), `procesar_horarios`.

**Edge Functions** (`supabase/functions/`): `notificador` (autenticada con secreto compartido) y `telegram-webhook` (valida `X-Telegram-Bot-Api-Secret-Token`; atiende `/start <código>` en chats privados). Cliente de Telegram compartido en `_shared/telegram.ts`: solo envía texto, guarda códigos de error fijos y nunca el texto de respuesta.

**Cron** (`20261118000300_cron.sql`): programa `procesar_horarios` y el notificador cada minuto con Vault. **No se ejecutó ni se probó.**

**Web**: sección «Destinatarios de Telegram» dentro de cada módulo en `/bebes`.

## 2. Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm.cmd test` (`supabase`) | **66 pruebas, 66 pasan** (39 previas + 12 de `avisos.test.mjs` + 15 de `notificador.test.mjs`) |
| `npm.cmd test` (`src/frontend`) | **19 archivos, 199 pruebas, todas pasan** |
| `npm.cmd run lint` / `npm.cmd run build` (`src/frontend`) | Sin hallazgos / correcto |
| `python -m unittest discover -s src/firmware/tests` | 171 pruebas, OK (sin cambios de firmware) |

## 3. Qué acreditan estas ejecuciones

| Ejecución | Acredita | No acredita |
|---|---|---|
| `avisos.test.mjs` (PGlite) | Lógica SQL: avisos por destinatario, idempotencia, códigos, reintentos, horarios, episodios, permisos por rol | Concurrencia real; `pg_cron`; Supabase real |
| `notificador.test.mjs` | Funciones con dependencias inyectadas; recorrido evento → aviso → notificador → registro de intentos con la base simulada y Telegram simulado | **Ninguna entrega real a Telegram.** No hay bot ni token en esta sesión |
| Pruebas web | Pantalla y validaciones con servicios simulados | Conexión con Supabase real |

## 4. Estado de los criterios

| CA | Estado | Evidencia | Pendiente |
|---|---|---|---|
| CA-06.1 | parcial (S) | Más de un destinatario por módulo; sección en la web | Prueba con Supabase real |
| CA-06.2 | parcial (S) | La lista es del módulo y la ven los dos dueños; otro módulo no la ve | |
| CA-06.3 | parcial (S) | Código de un solo uso con hash, vencimiento y reemplazo; retirar evita avisos futuros y no toca a los dueños | Vinculación con un bot real |
| CA-07.1 | parcial (S) | Un evento genera un aviso por destinatario vinculado | Entrega real |
| CA-07.2 | parcial (S) | El envío depende de `pg_cron` y del notificador, no de la web | **Sin verificar**: `20261118000300_cron.sql` no se aplicó ni se probó; requiere la prueba con la web cerrada |
| CA-07.3 | parcial (S) | Reenvío del mismo `event_id` no duplica eventos ni avisos; eventos distintos con la misma hora se conservan | Aplicarlo a cada productor de eventos (fases 5 a 9) |
| CA-07.4 | parcial (S) | El aviso se arma solo con tipo y descripción; las pruebas verifican que `datos` (por ejemplo una ruta de foto) no llega al texto | Revalidar con fotos reales (fase 7) |
| CA-07.5 | parcial (S) | `actualizar_episodio`: un aviso por episodio, otro tras volver al rango | Conectarlo a la ingesta de ambiente (fase 5) |
| CA-24.1, CA-24.2, CA-24.5, CA-24.6 | parcial (S) | `eventos` con fecha, hora, tipo, descripción, bebé, módulo y datos | Unificar ambiente y movimiento y el resto de productores (fase 10) |
| CA-22.3, CA-22.4 | parcial (S) | `procesar_horarios`: 08:00 y 11:00 en `America/Costa_Rica` generan un recordatorio por día; ninguno en horas intermedias ni en horas vencidas | La pantalla de horarios y los módulos de alimentación (fase 9) |
| CA-34.2 | parcial (S) | Un destinatario no es dueño; un retiro no cambia los dueños | Flujo de revocación completo (fase 11) |

Ninguno se declara verificado.

## 5. Decisiones y límites

- **Entrega al menos una vez.** Si el mensaje sale y `registrar_intento_aviso` falla, la reserva vence a los 2 minutos y el aviso se repite. Se contó en la respuesta (`sin_registrar`). Evitar duplicados exactos no es posible con la API de Telegram sin otra clave de idempotencia.
- **Recordatorios vencidos se omiten** (DEC-04, DEC-10): solo se ejecuta la hora del minuto en curso. Una demora de `pg_cron` mayor a un minuto pierde ese recordatorio.
- **Latencia.** Con `pg_cron` cada minuto, la solicitud a Telegram puede tardar hasta 60 s en salir. El objetivo de HU-30 (5 s desde la recepción en el backend) exige invocar el notificador en cuanto se crea el aviso (por ejemplo, un disparador con `pg_net`). Queda para la fase 11.
- **Chats privados solamente** en el webhook; un grupo no se puede vincular.

## 6. Bloqueos y recursos que faltan

| Elemento | Qué falta |
|---|---|
| Entrega real | Un bot de Telegram de prueba, su token como secreto de Supabase y `setWebhook` con `secret_token` |
| `pg_cron` y Vault | Autorización para aplicar la migración en `cuna-inteligente-dev` y crear los secretos `project_url` y `notificador_secret` |
| CA-07.2 con la web cerrada | Prueba real con cuentas configuradas |

## 7. Archivos

Creados: `supabase/migrations/20261118000200_avisos_telegram.sql`, `…000300_cron.sql`, `supabase/functions/_shared/{telegram.ts, supabase.ts}`, `supabase/functions/notificador/{handler.ts, index.ts}`, `supabase/functions/telegram-webhook/{handler.ts, index.ts}`, `supabase/tests/{avisos.test.mjs, notificador.test.mjs}`, `src/frontend/src/{models/telegram.ts, services/telegram.ts, components/DestinatariosTelegram.tsx}` y dos archivos de prueba web.

Modificados: `supabase/config.toml`, `supabase/package.json`, `src/frontend/src/{components/TarjetaModulo.tsx, components/ProveedorServicios.tsx, services/{tipos,noConfigurado,configuracion}.ts, vite-env.d.ts}`, `src/frontend/.env.example` (`VITE_TELEGRAM_BOT`, sin valor) y `tests/noConfigurado.test.ts`.

No se creó nada en `cuna-inteligente-dev`. No se leyó ni guardó ningún secreto. No se modificó documentación protegida. No se hizo push.
