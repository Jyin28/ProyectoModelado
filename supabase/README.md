# supabase — Backend del proyecto

## Propósito

Backend del proyecto completo Cuna Inteligente IoT, basado en Supabase:

- **Auth**: autenticación de usuarios (familia/cuidadores).
- **PostgreSQL + RLS**: almacenamiento de lecturas y configuración, con
  seguridad a nivel de fila.
- **Ingesta**: recepción de datos del firmware por HTTPS.
- **Realtime (WSS)**: canal definitivo para el envío de comandos al
  firmware.
- **Notificador + Telegram**: alertas hacia los cuidadores.
- **Storage**: archivos asociados (p. ej. audio).
- **pg_cron**: tareas programadas (mantenimiento, resúmenes periódicos).

## Proyecto Supabase

- Nombre: `cuna-inteligente-dev`.
- Referencia: `tlbwsdnqhwvuvgjcxgsg`.
- Región: `us-west-2`.
- Estado comprobado por última vez: `ACTIVE_HEALTHY`.
- Esquema `public`: sin tablas en la comprobación inicial, previa a la implementación.
- Data API habilitada; exposición automática de tablas deshabilitada;
  RLS automático seleccionado al crear el proyecto.

Comprueba estos ajustes antes del primer despliegue.

## Primer recorrido de ambiente

El repositorio incluye la migración PostgreSQL y la función Edge `ingesta`. El flujo registra lecturas del AM2301, verifica la credencial del módulo, conserva la asignación histórica del bebé y permite leer los datos a dueños activos. El proyecto en la nube requiere aplicar la migración, configurar un dispositivo de prueba y desplegar la función antes de conectarlo con la Pico o la web.

- **C, firmware.** El envío parte de la lectura que ya devuelve `sensores.leer_ambiente()`. Usa el identificador lógico `cuna-ambiente-01` y el token del módulo en `secrets.py`. Prueba la hora UTC y el HTTPS sobre el hotspot antes de usar una lectura como evidencia. [Contrato de ingesta](../src/shared/contracts/ambiente.md#pico-a-supabase)
- **A, web.** Usa una sesión de Supabase Auth, la clave publicable y el módulo `cuna-ambiente-01`. El contrato indica la consulta y el mapeo al modelo web. [Consulta de la última lectura](../src/shared/contracts/ambiente.md#supabase-a-la-web)

### Preparar el proyecto de desarrollo

1. Confirma en el panel de Supabase que estás en `cuna-inteligente-dev`, que Data API está habilitada y que `public` está expuesto. La migración otorga de forma explícita los permisos de la tabla y la función.
2. Con Supabase CLI instalado, ejecuta desde la raíz del repositorio:

   ```powershell
   supabase login
   supabase link --project-ref tlbwsdnqhwvuvgjcxgsg
   supabase db push --dry-run
   supabase db push
   supabase functions deploy ingesta
   ```

3. Crea en Authentication un usuario de prueba y toma su UUID. Genera un token local de dispositivo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Guarda el token en el `secrets.py` de la Pico. Obtén su SHA-256 en PowerShell sin escribir el token en el comando ni en un archivo del repositorio:

   ```powershell
   $deviceToken = Read-Host 'Token del dispositivo'
   $tokenBytes = [Text.Encoding]::UTF8.GetBytes($deviceToken)
   $sha256 = [Security.Cryptography.SHA256]::Create()
   [BitConverter]::ToString($sha256.ComputeHash($tokenBytes)).Replace('-', '').ToLowerInvariant()
   $sha256.Dispose()
   Remove-Variable deviceToken, tokenBytes, sha256
   ```

4. Desde el editor SQL del proyecto, provisiona el módulo con el hash y el UUID de Auth. Usa un bebé de prueba y fija `desde` a una hora anterior o igual a la primera medición. Ejecuta este bloque una vez por alta de módulo, tras sustituir los dos marcadores:

   ```sql
   begin;
   insert into cuna_private.dispositivos (id, token_sha256)
   values ('cuna-ambiente-01', '<hash-sha256>');

   insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id)
   values ('cuna-ambiente-01', '<uuid-usuario-auth>');

   with bebe as (
       insert into cuna_private.bebes (nombre) values ('Bebé de prueba') returning id
   )
   insert into cuna_private.asignaciones_bebe (dispositivo_id, desde, bebe_id)
   select 'cuna-ambiente-01', now(), id from bebe;
   commit;
   ```

5. Envía una lectura real desde la Pico a la URL de la función y verifica `201`. Repite el mismo evento para verificar `409` y una sola fila. Inicia sesión en la web con el usuario asociado y comprueba temperatura, humedad y hora. Repite la consulta con un usuario sin acceso y comprueba que no obtiene la fila.

La función valida la credencial en la base. `verify_jwt = false` se aplica solo a `ingesta` para permitir el token de la Pico. El RPC de escritura se concede exclusivamente a `service_role`. Las variables de servidor `SUPABASE_URL` y `SUPABASE_SECRET_KEYS`, o `SUPABASE_SERVICE_ROLE_KEY` en entornos que usan claves heredadas, las aporta el entorno Edge. [Autenticación de funciones Edge](https://supabase.com/docs/guides/functions/auth) · [Variables de entorno](https://supabase.com/docs/guides/functions/secrets) · [Permisos de la Data API](https://supabase.com/docs/guides/api/securing-your-api)

### Prueba local del backend

Desde la raíz, con Node.js 24:

```powershell
npm.cmd ci --prefix supabase
npm.cmd test --prefix supabase
```

La prueba usa PostgreSQL en memoria para ejercitar la migración y las reglas de acceso desde el manejador HTTP. El paso 5 comprueba el despliegue y el hardware reales.
