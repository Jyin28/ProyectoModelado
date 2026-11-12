# Contrato de control de la lámpara

Contrato de la fase local 1 de RF-11 / CA-11.1 («la lámpara permite encendido, apagado y cambio de intensidad») según la [especificación](../../../docs/Requerimientos/EspecificacionRequerimientos.md). Los nombres `command_id`, `command` y `params` son los del comando `lamp_set` de `src/firmware/common/utilities/comandos.py`. Los de la base corresponden a la migración `20261111000200_comandos_lampara.sql`. La propuesta general de comandos sigue en [contrato-web-propuesta.md](../../../docs/Sprint3/contrato-web-propuesta.md), todavía provisional.

## Primer recorrido de RF-11.1

1. El cuidador autenticado, dueño activo del módulo `cuna-lampara-01`, elige un nivel entero de 0 a 100. El nivel 0 apaga la lámpara y 100 es la intensidad máxima.
2. La web genera un `command_id` UUID y llama al RPC `public.solicitar_lampara` con su sesión de Supabase Auth.
3. La base comprueba sesión, dueño activo, módulo activo y nivel. Si todo es válido, guarda la orden en `public.ordenes_lampara` con estado `pendiente`.
4. La web consulta la orden con RLS de dueño activo.

El módulo de la maqueta es `cuna-lampara-01`, pero la base admite cualquier identificador con formato `cuna-lampara-NN` (dos dígitos) sin otra migración. Un módulo distinto, como `cuna-lampara-02`, se rechaza mientras no esté registrado y activo.

Fin de la fase local: la solicitud queda registrada y es consultable. Todavía no llega a la Pico ni cambia la luz. `cuna-lampara-01` es un módulo lógico distinto de `cuna-ambiente-01`. Su alta real es una fase posterior, y las pruebas locales suponen que ya existe junto con su dueño activo.

## API disponible en esta fase

Solo existen PostgreSQL con RLS y el RPC. No hay Realtime, Edge Function de comandos ni confirmación.

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

`params.level` sale de la columna `nivel`. El firmware acepta cualquier número de 0 a 100. La base solo admite enteros, de modo que toda orden guardada es válida para la Pico. La confirmación que genera el firmware, que la Pico enviará en una fase posterior, tiene esta forma:

```json
{ "command_id": "3b8f6c1e-5d2a-4f7b-9c3e-0a1b2c3d4e5f", "command": "lamp_set", "ok": true, "result": { "level": 40 } }
```

En caso de error: `"ok": false, "error": "fuera_de_rango:level"`.

`ok` solo reporta el nivel que el firmware aplicó a su salida. No demuestra que la luz sea visible: eso lo valida la prueba física en la maqueta.

## Solicitud registrada y nivel confirmado

| Concepto | Qué demuestra | Fuente |
| --- | --- | --- |
| Solicitud registrada | La base aceptó la orden del cuidador. No prueba que la Pico la recibió ni que la luz cambió. | Fila en `ordenes_lampara` con `estado = 'pendiente'` |
| Nivel físico confirmado | La Pico ejecutó `lamp_set` y reportó `ok` con `result.level` (nivel aplicado por el firmware; la luz visible se valida con prueba física). | Confirmación posterior, aún inexistente |

Mientras no exista la confirmación, la web debe mostrar «solicitud registrada» o «pendiente» y nunca un nivel actual de la lámpara.

## Expiración y reconexión

`vence_en` es `creado_en` más 15 segundos, un valor inicial de trabajo que puede ajustarse. En esta fase el estado no cambia: una orden vencida sigue como `pendiente` y se reconoce porque la hora del servidor superó `vence_en`. Al reconectarse, la Pico no debe aplicar órdenes vencidas. La validación de vigencia la hace el servidor con su propio reloj, no el reloj de la Pico. Una orden vencida sin confirmación se presenta en la web como `sin-respuesta`.

## Próximo paso: Realtime/WSS privado

RLS debe estar vigente antes de habilitar el control desde la web, y el navegador nunca publica órdenes a la Pico directamente. La fase siguiente entrega las órdenes por un canal privado de Supabase Realtime sobre WSS, con una credencial limitada al módulo `cuna-lampara-01`. La Pico envía la confirmación después de ejecutar. El servidor debe fijar `confirmado_en` y validar identidad, vigencia e idempotencia de esa confirmación. Una confirmación no puede venir del cliente web. La autorización de canales privados se basa en políticas RLS sobre `realtime.messages`, según [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization).

La identidad de Realtime en la Pico y TLS 1.3 con la Pico 2 W requieren una prueba dedicada en la maqueta antes de habilitar controles reales. Hasta entonces la web no debe presentar controles que parezcan operar la lámpara.

## Verificación local

`npm test` en `supabase/` ejecuta `tests/lampara.test.mjs` sobre PGlite junto con la suite de Ingesta. Cubre los niveles 0 y 100, entradas inválidas (-1, 101, fracción, nulo), idempotencia y colisión, rechazos de autorización y de formato de módulo, RLS, ausencia de escritura directa y retención de órdenes tras eliminar la cuenta solicitante. Esto no comprueba nada de la Pico ni de Realtime.
