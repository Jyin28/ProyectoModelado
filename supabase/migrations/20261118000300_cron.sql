-- Tareas programadas de la fase 4. NO se ejecuta en las pruebas locales con
-- PGlite (necesita pg_cron, pg_net y Vault de Supabase): sin verificar en un
-- proyecto real. Aplicar solo con autorización sobre cuna-inteligente-dev.
--
-- Antes de aplicarla, crea en Vault (sin guardar valores en el repositorio):
--   project_url        URL del proyecto, por ejemplo https://<ref>.supabase.co
--   notificador_secret mismo valor que el secreto NOTIFICADOR_SECRET de la función
--
-- pg_cron evalúa cada minuto. Los recordatorios usan la hora local de
-- America/Costa_Rica dentro de public.procesar_horarios; la zona del servidor
-- no influye. Un minuto perdido (por ejemplo, una caída) no se recupera.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
    'procesar-horarios',
    '* * * * *',
    $$select public.procesar_horarios(now())$$
);

select cron.schedule(
    'notificador',
    '* * * * *',
    $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/notificador',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' ||
                (select decrypted_secret from vault.decrypted_secrets where name = 'notificador_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
    );
    $$
);

commit;
