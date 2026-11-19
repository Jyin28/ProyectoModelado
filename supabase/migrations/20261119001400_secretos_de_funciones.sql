-- Respaldo para los secretos de las Edge Functions de Telegram.
-- Las funciones leen primero la variable de entorno (Edge Functions > Secrets) y,
-- si no existe, este secreto de Vault. Vault los guarda cifrados. Solo se pueden
-- leer estos tres nombres, y solo con la clave de servidor (service_role).
begin;

create or replace function public.leer_secreto_funcion(p_nombre text)
returns text
language sql stable security definer
set search_path = ''
as $$
    select s.decrypted_secret
    from vault.decrypted_secrets as s
    where s.name = lower(p_nombre)
      and lower(p_nombre) in ('telegram_bot_token', 'telegram_webhook_secret', 'notificador_secret')
$$;

revoke all on function public.leer_secreto_funcion(text)
    from public, anon, authenticated, service_role;
grant execute on function public.leer_secreto_funcion(text) to service_role;

commit;
