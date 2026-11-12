# Contrato de control de la lámpara

Contrato de la fase local 1 de RF-11 / CA-11.1 («la lámpara permite encendido, apagado y cambio de intensidad») según la [especificación](../../../docs/Requerimientos/EspecificacionRequerimientos.md). Los nombres `command_id`, `command` y `params` son los del comando `lamp_set` de `src/firmware/common/utilities/comandos.py`. Los de la base corresponden a la migración `20261111000200_comandos_lampara.sql`. La propuesta general de comandos sigue en [contrato-web-propuesta.md](../../../docs/Sprint3/contrato-web-propuesta.md), todavía provisional.

## Primer recorrido de RF-11.1

1. El cuidador autenticado, dueño activo del módulo `cuna-lampara-01`, elige un nivel entero de 0 a 100. El nivel 0 apaga la lámpara y 100 es la intensidad máxima.
2. La web genera un `command_id` UUID y llama al RPC `public.solicitar_lampara` con su sesión de Supabase Auth.
3. La base comprueba sesión, dueño activo, módulo activo y nivel. Si todo es válido, guarda la orden en `public.ordenes_lampara` con estado `pendiente`.
4. La web consulta la orden con RLS de dueño activo.

El módulo de la maqueta es `cuna-lampara-01`, pero la base admite cualquier identificador con formato `cuna-lampara-NN` (dos dígitos) sin otra migración. Un módulo distinto, como `cuna-lampara-02`, se rechaza mientras no esté registrado y activo.

Fin de la fase 1: la solicitud queda registrada y es consultable. La fase local 2 añade la entrega a la Pico y su confirmación en la base; la luz física sigue sin verificarse. `cuna-lampara-01` es un módulo lógico distinto de `cuna-ambiente-01`. Su alta real es una fase posterior, y las pruebas locales suponen que ya existe junto con su dueño activo.

## API disponible en esta fase

Fase 1: PostgreSQL con RLS y el RPC `solicitar_lampara`. La entrega y la confirmación (fase local 2) se describen más abajo. No hay Edge Function de comandos.

**Escritura.** `POST /rest/v1/rpc/solicitar_lampara`, rol `authenticated`, clave publicable y sesión del usuario. `anon` y `service_role` no pueden ejecutarlo.

```json
{
  "p_command_id": "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f",
  "p_device_id": "cuna-lampara-01",
  "p_level": 40
}
```

| Parámetro | Regla |
| --- | --- |
| `p_command_id` | UUID obligatorio generado por la web. Sirve para reintentos. |
| `p_device_id` | Formato `^cuna-lampara-[0-9]{2}$` (en la maqueta, `cuna-lampara-01`), módulo registrado y activo, y el usuario como dueño activo. Ambas filas se bloquean con `FOR SHARE` durante la comprobación. |
| `p_level` | `numeric` entero de 0 a 100. Se rechaza `null`, negativos, mayores que 100, fracciones, `NaN` e infinitos. Nada se redondea. |

El servidor fija el solicitante (`auth.uid()`), `creado_en`, `vence_en` y `estado`. El cliente no puede elegirlos. `solicitante_id` se conserva como dato histórico sin clave foránea a `auth.users`: eliminar una cuenta no borra sus órdenes ni bloquea la baja, y los dueños activos del módulo siguen leyéndolas. La respuesta es la fila creada:

```json
{
  "command_id": "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f",
  "device_id": "cuna-lampara-01",
  "command": "lamp_set",
  "solicitante_id": "7d9e0f1a-2b3c-4d5e-8f60-718293a4b5c6",
  "nivel": 40,
  "creado_en": "2026-11-11T16:04:10.123Z",
  "vence_en": "2026-11-11T16:04:25.123Z",
  "estado": "pendiente"
}
```

**Lectura.** `GET /rest/v1/ordenes_lampara` con la misma sesión. RLS devuelve solo las órdenes de módulos de los que el usuario es dueño activo. Para ver la última orden: `device_id=eq.cuna-lampara-01&order=creado_en.desc,command_id.desc&limit=1`. No hay escritura directa: `insert`, `update`, `delete` y `truncate` están denegados para todos los roles de la API.

| Situación | Error |
| --- | --- |
| Sin sesión, usuario no dueño o dueño inactivo, formato de módulo inválido, módulo no registrado (p. ej. `cuna-lampara-02`) o inactivo | SQLSTATE `42501`, mensaje `no_autorizado` (igual en todos los casos) |
| `p_command_id` nulo o nivel inválido | `22023` (`command_id_requerido`, `nivel_invalido`) |
| `command_id` ya usado con otro solicitante, módulo o nivel | `23505` (`command_id_en_uso`), sin datos de la fila existente |

**Idempotencia.** Un reenvío con el mismo `command_id`, usuario, módulo y nivel devuelve la fila original, con `creado_en` y `vence_en` intactos, incluso si ya venció. La inserción usa `on conflict (command_id) do nothing`, así que dos reenvíos simultáneos producen una sola fila. Un usuario sin autorización recibe `42501` antes de cualquier consulta de la fila, también si el `command_id` existe.

## Correspondencia con el firmware

La orden guardada se reconstruye así, y `comandos.ejecutar` la acepta tal cual:

```json
{ "command_id": "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f", "command": "lamp_set", "params": { "level": 40 } }
```

`params.level` sale de la columna `nivel`. El firmware acepta cualquier número de 0 a 100. La base solo admite enteros, de modo que toda orden guardada es válida para la Pico. La confirmación que genera el firmware tiene esta forma; la Pico la traducirá a los parámetros de `confirmar_orden_lampara` (integración pendiente):

```json
{ "command_id": "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f", "command": "lamp_set", "ok": true, "result": { "level": 40 } }
```

En caso de error: `"ok": false, "error": "fuera_de_rango:level"`.

`ok` solo reporta el nivel que el firmware aplicó a su salida. No demuestra que la luz sea visible: eso lo valida la prueba física en la maqueta.

## Solicitud registrada, enviada y nivel confirmado

| Concepto | Qué demuestra | Fuente |
| --- | --- | --- |
| Solicitud registrada | La base aceptó la orden del cuidador. No prueba que la Pico la recibió ni que la luz cambió. | Fila con `estado = 'pendiente'` |
| Orden enviada | La base entregó la orden a la cuenta del dispositivo (una sola vez). No prueba que la Pico la aplicó. | `estado = 'enviado'`, `entregado_en` |
| Nivel confirmado por la Pico | La Pico reportó `ok` con el nivel que aplicó a su salida. **No prueba que la luz sea visible**: eso lo valida la prueba física en la maqueta. | `estado = 'confirmado'`, `nivel_confirmado`, `confirmado_en` |
| Error reportado | La Pico informó un error normalizado. | `estado = 'error'`, `error` |

La web debe mostrar «solicitud registrada», «enviada», «confirmada por la Pico» o «error», y nunca presentar el reporte de la Pico como luz física comprobada.

## Expiración y reconexión

`vence_en` es `creado_en` más 15 segundos, un valor inicial de trabajo que puede ajustarse. El estado no cambia solo por vencer: una orden vencida sigue como `pendiente` o `enviado` y se reconoce porque la hora del servidor superó `vence_en`. La vigencia la decide siempre el servidor con su reloj, después de bloquear la fila. Una orden vencida sin confirmación se presenta en la web como `sin-respuesta`. Las órdenes vencidas no se entregan al reconectar.

## Entrega a la Pico (fase local 2)

Migración `20261111000300_entrega_lampara.sql`. Diseño:

- La Pico se autentica con una **cuenta Auth exclusiva del dispositivo**, JWT normal y clave publicable. El navegador sigue usando la cuenta del cuidador. No se usa clave de servicio ni Edge Function.
- El vínculo `auth.uid` → `device_id` vive en `cuna_private.cuentas_dispositivo` (FK al módulo, formato `cuna-lampara-NN`, sin permisos para ningún rol de API). No se deriva de metadata editable. Cada módulo tiene una sola cuenta exclusiva (`unique(device_id)`) y un disparador, serializado por cuenta con bloqueo de `auth.users`, impide que sea a la vez cuidador y dispositivo. La cuenta del dispositivo no puede solicitar órdenes ni leer `ordenes_lampara`.
- **Canal privado** `lampara:<device_id>`, evento `orden_disponible`, payload `{ "command_id": "…" }` y nada más. Lo emite un trigger `AFTER INSERT` en `ordenes_lampara` con `realtime.send(…, true)`. Un reenvío idempotente no inserta, por lo que no genera otra señal. Una política `SELECT` en `realtime.messages` (`lampara_recibe_orden`) exige `extension = 'broadcast'` y que el `topic` de la fila sea `realtime.topic()` (filtro por tópico, sin depender del `WHERE` del cliente), y lo permite solo a la cuenta vinculada y activa de un módulo activo. No hay política de `INSERT`: ni la Pico ni la web publican. No se tocaron políticas ni ajustes previos. Referencias: [Broadcast](https://supabase.com/docs/guides/realtime/broadcast) y [Authorization](https://supabase.com/docs/guides/realtime/authorization).
- La señal es solo un aviso. La Pico llama a `tomar_orden_lampara` al suscribirse y al recibir `orden_disponible`, y procesa en secuencia.

### `POST /rest/v1/rpc/tomar_orden_lampara`

Sin parámetros. El módulo se deriva de `auth.uid()` en el servidor, con cuenta y módulo activos bloqueados. Toma con bloqueo de fila **únicamente la última orden del módulo** (`creado_en desc, command_id desc`) si está `pendiente` y vigente, la marca `enviado` y fija `entregado_en`. Si la última ya se tomó, venció o es terminal, devuelve `null`; nunca recupera una anterior.

```json
{
  "command_id": "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f",
  "command": "lamp_set",
  "params": { "level": 40 },
  "vence_en": "2026-11-11T16:04:25.123+00:00"
}
```

No incluye al solicitante.

### `POST /rest/v1/rpc/confirmar_orden_lampara`

```json
{ "p_command_id": "…", "p_ok": true, "p_level": 40, "p_error": null }
```

Solo la cuenta del dispositivo dueño de la orden, con la orden `enviado` y vigente según el reloj del servidor. Éxito: `p_ok = true`, `p_level` entero 0..100 igual al nivel solicitado y `p_error` nulo. Error: `p_ok = false`, `p_level` nulo y `p_error` de 1 a 80 caracteres `[a-z0-9_:-]`. El servidor fija `confirmado_en`. Respuesta: `{ "command_id", "estado", "confirmado_en" }`.

| Situación | Error |
| --- | --- |
| Sin cuenta de dispositivo activa (cuidador, anon, sin sesión), orden inexistente u orden de otro módulo | `42501` `no_autorizado` (igual en todos los casos) |
| `p_command_id` nulo, `p_ok` nulo, combinación de parámetros inválida o nivel distinto del solicitado | `22023` |
| Orden sin entregar o vencida | `55000` (`orden_no_enviada`, `orden_vencida`) |
| Confirmación terminal distinta de la ya guardada | `23505` `confirmacion_distinta`, sin mutar |

Una confirmación terminal idéntica devuelve la misma respuesta, incluso después de vencer.

### Compromisos explícitos

- **El RPC de entrega es at-most-once.** Si la respuesta de `tomar_orden_lampara` se pierde, no hay segunda entrega: sin confirmación la orden se verá `sin-respuesta` al vencer, y una orden nueva necesita otro UUID.
- **Solo la cuenta del dispositivo puede confirmar.** El cuidador no puede escribir estados ni confirmar.
- **El reporte de la Pico no prueba la luz física.** Solo dice qué nivel aplicó el firmware a su salida.
- Las filas devueltas por `solicitar_lampara` incluyen ahora las columnas nuevas (`entregado_en`, `confirmado_en`, `nivel_confirmado`, `error`), nulas al crear.

## Pendientes del proyecto (fuera de esta fase local)

- Alta real de la cuenta Auth del módulo y de su fila en `cuentas_dispositivo`; esta fase no crea usuarios ni datos.
- Prueba real de WSS/TLS de Realtime en la Pico 2 W en la maqueta. **No está verificada**; solo se probó la lógica de base en PGlite con stubs.
- Cableado de la lámpara y prueba física de la luz.
- Cliente de Realtime y de los dos RPC en el firmware, y controles y estados en la web.

Hasta entonces la web no debe presentar controles que parezcan operar la lámpara.

## Verificación local

`npm test` en `supabase/` ejecuta sobre PGlite la suite de Ingesta, `tests/lampara.test.mjs` (fase 1) y `tests/lampara-entrega.test.mjs` (fase 2, con stubs mínimos de `realtime.messages`, `realtime.topic` y `realtime.send`). La fase 2 cubre: señal privada única y sin datos de la orden, ACL por tópico y rol, ausencia de publicación, vínculo privado, entrega única de la última orden, no entrega de órdenes anteriores o vencidas, aislamiento de dos dispositivos, confirmación válida, de error e idempotente, y rechazo de la tardía, incorrecta, sin entrega y falsificada por el cuidador. Para no esperar 15 s se envejecen las filas como administrador conservando las restricciones. No se probó concurrencia real ni nada de la Pico o de un Realtime real.
