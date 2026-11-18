-- Fase 11 · Aviso inmediato a Telegram (HU-30, CA-30.2). NO se ejecuta en las
-- pruebas locales con PGlite (necesita pg_net y Vault de Supabase): sin
-- verificar en un proyecto real. Aplicar solo con autorización sobre
-- cuna-inteligente-dev, después de 20261118000300_cron.sql.
--
-- Problema: con solo el trabajo de pg_cron del notificador (cada minuto), un
-- aviso puede esperar hasta 60 s, y HU-30 pide que la solicitud a Telegram se
-- haga en 5 s desde que el backend recibe el evento.
--
-- Solución: al crearse avisos, un disparador por sentencia (una sola llamada
-- aunque haya varios destinatarios) invoca la función `notificador` con pg_net.
-- pg_net es asíncrono: la llamada sale después de confirmar la transacción y no
-- retrasa ni hace fallar el registro del evento. El trabajo de pg_cron queda
-- como respaldo para los reintentos. Dos ejecuciones simultáneas no envían el
-- mismo aviso: `avisos_pendientes` reserva cada aviso por 2 minutos.
--
-- Usa los mismos secretos de Vault que el trabajo de pg_cron (`project_url` y
-- `notificador_secret`). Si no existen, el disparador no hace nada y los avisos
-- siguen saliendo por el trabajo programado.

begin;

create function cuna_private.invocar_notificador()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
    v_url text;
    v_secreto text;
begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
    select decrypted_secret into v_secreto
    from vault.decrypted_secrets where name = 'notificador_secret';

    if v_url is null or v_secreto is null then
        return null;
    end if;

    perform net.http_post(
        url := v_url || '/functions/v1/notificador',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_secreto),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000);
    return null;
exception when others then
    -- Un fallo aquí nunca debe impedir que el evento quede registrado.
    return null;
end;
$$;

revoke all on function cuna_private.invocar_notificador()
    from public, anon, authenticated, service_role;

create trigger avisos_invocar_notificador
    after insert on cuna_private.avisos
    referencing new table as nuevos
    for each statement
    execute function cuna_private.invocar_notificador();

commit;
