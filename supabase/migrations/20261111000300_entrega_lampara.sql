begin;

-- Fase local 2 de RF-11.1: entrega de la orden a la Pico y confirmación.
-- Requiere las migraciones 20261111000100 y 20261111000200, el esquema auth y
-- el esquema realtime de Supabase (realtime.messages, realtime.topic,
-- realtime.send). No modifica políticas ni ajustes previos.
--
-- Diseño: la Pico abre un canal privado de Realtime (WSS) con el JWT de una
-- cuenta Auth exclusiva del dispositivo. La señal 'orden_disponible' solo
-- lleva command_id; la orden se toma con un RPC HTTPS (at-most-once) y se
-- confirma con otro. La cuenta del dispositivo no es cuidador.

-- Vínculo privado cuenta Auth -> módulo de lámpara. Solo lo escribe un
-- administrador (alta real pendiente); ningún rol de API tiene permisos.
create table cuna_private.cuentas_dispositivo (
    usuario_id uuid primary key references auth.users(id) on delete cascade,
    device_id text not null references cuna_private.dispositivos(id)
        check (device_id ~ '^cuna-lampara-[0-9]{2}$'),
    activo boolean not null default true,
    -- Una sola cuenta controla cada módulo.
    unique (device_id)
);

revoke all on cuna_private.cuentas_dispositivo from public, anon, authenticated, service_role;

-- Una cuenta no puede ser a la vez cuidador y dispositivo.
create function cuna_private.separar_cuenta_dispositivo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    -- Serializa ambas rutas por cuenta: el alta concurrente en los dos roles
    -- espera aquí y la segunda ve la fila de la primera al confirmarse.
    perform 1 from auth.users as u where u.id = new.usuario_id for update;

    if tg_table_name = 'cuentas_dispositivo' then
        if exists (select 1 from cuna_private.duenos_dispositivo as d
                   where d.usuario_id = new.usuario_id) then
            raise exception 'cuenta_con_rol_cuidador' using errcode = '23514';
        end if;
    elsif exists (select 1 from cuna_private.cuentas_dispositivo as c
                  where c.usuario_id = new.usuario_id) then
        raise exception 'cuenta_con_rol_dispositivo' using errcode = '23514';
    end if;
    return new;
end;
$$;

revoke all on function cuna_private.separar_cuenta_dispositivo()
    from public, anon, authenticated, service_role;

create trigger cuentas_dispositivo_sin_cuidador
    before insert or update on cuna_private.cuentas_dispositivo
    for each row execute function cuna_private.separar_cuenta_dispositivo();

create trigger duenos_dispositivo_sin_cuenta_modulo
    before insert or update on cuna_private.duenos_dispositivo
    for each row execute function cuna_private.separar_cuenta_dispositivo();

-- Ciclo de vida de la orden: pendiente -> enviado -> confirmado | error.
alter table public.ordenes_lampara drop constraint ordenes_lampara_estado_check;

alter table public.ordenes_lampara
    add column entregado_en timestamptz
        check (entregado_en is null or isfinite(entregado_en)),
    add column confirmado_en timestamptz
        check (confirmado_en is null or isfinite(confirmado_en)),
    add column nivel_confirmado integer
        check (nivel_confirmado is null or nivel_confirmado between 0 and 100),
    add column error text
        check (error is null or error ~ '^[a-z0-9_:-]{1,80}$'),
    add constraint ordenes_lampara_estado_valido
        check (estado in ('pendiente', 'enviado', 'confirmado', 'error')),
    add constraint ordenes_lampara_ciclo check (
        case estado
            when 'pendiente' then entregado_en is null and confirmado_en is null
                and nivel_confirmado is null and error is null
            when 'enviado' then entregado_en is not null and confirmado_en is null
                and nivel_confirmado is null and error is null
            when 'confirmado' then entregado_en is not null and confirmado_en is not null
                and coalesce(nivel_confirmado = nivel, false) and error is null
            when 'error' then entregado_en is not null and confirmado_en is not null
                and nivel_confirmado is null and error is not null
            else false
        end
    ),
    add constraint ordenes_lampara_tiempos check (
        (entregado_en is null or (entregado_en >= creado_en and entregado_en <= vence_en))
        and (confirmado_en is null
            or (confirmado_en >= entregado_en and confirmado_en <= vence_en))
    );

-- Las columnas nuevas heredan el grant de SELECT y la RLS de dueño activo de
-- la fase 1; no se concede ninguna escritura.

-- Señal de orden nueva. Solo se dispara en INSERT real: un reenvío idempotente
-- (on conflict do nothing) no ejecuta el trigger. El payload no lleva datos de
-- la orden; la Pico la obtiene con tomar_orden_lampara().
create function cuna_private.avisar_orden_lampara()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object('command_id', new.command_id),
        'orden_disponible',
        'lampara:' || new.device_id,
        true
    );
    return null;
end;
$$;

revoke all on function cuna_private.avisar_orden_lampara()
    from public, anon, authenticated, service_role;

create trigger ordenes_lampara_aviso
    after insert on public.ordenes_lampara
    for each row execute function cuna_private.avisar_orden_lampara();

-- ACL del canal: solo la cuenta vinculada y activa, sobre un módulo activo,
-- puede recibir el tópico exacto 'lampara:<device_id>'.
create function cuna_private.canal_lampara_autorizado(p_topic text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
    select p_topic is not null and exists (
        select 1
        from cuna_private.cuentas_dispositivo as cuenta
        join cuna_private.dispositivos as modulo on modulo.id = cuenta.device_id
        where cuenta.usuario_id = (select auth.uid())
          and cuenta.activo
          and modulo.activo
          and p_topic = 'lampara:' || cuenta.device_id
    );
$$;

revoke all on function cuna_private.canal_lampara_autorizado(text)
    from public, anon, authenticated, service_role;
grant execute on function cuna_private.canal_lampara_autorizado(text) to authenticated;

-- Solo SELECT. No se crea política de INSERT: esos clientes no publican.
create policy lampara_recibe_orden on realtime.messages
    for select to authenticated
    using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and cuna_private.canal_lampara_autorizado((select realtime.topic()))
    );

-- Módulo de la sesión: bloquea cuenta y módulo (FOR SHARE) hasta el fin de la
-- transacción. Devuelve null si no hay cuenta de dispositivo activa.
create function cuna_private.modulo_lampara_de_sesion()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    modulo text;
begin
    if usuario is null then
        return null;
    end if;

    select cuenta.device_id into modulo
    from cuna_private.cuentas_dispositivo as cuenta
    join cuna_private.dispositivos as disp on disp.id = cuenta.device_id
    where cuenta.usuario_id = usuario and cuenta.activo and disp.activo
    for share of cuenta, disp;

    return modulo;
end;
$$;

revoke all on function cuna_private.modulo_lampara_de_sesion()
    from public, anon, authenticated, service_role;

-- Toma atómica (at-most-once) de la última orden del módulo, si sigue
-- pendiente y vigente. Si no, devuelve null; nunca recupera una anterior.
create function public.tomar_orden_lampara()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    modulo text := cuna_private.modulo_lampara_de_sesion();
    orden public.ordenes_lampara%rowtype;
    ahora timestamptz;
begin
    if modulo is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    select o.* into orden
    from public.ordenes_lampara as o
    where o.device_id = modulo
    order by o.creado_en desc, o.command_id desc
    limit 1
    for update;

    -- Reloj del servidor, leído después del bloqueo.
    ahora := clock_timestamp();

    if not found or orden.estado <> 'pendiente' or ahora >= orden.vence_en then
        return null;
    end if;

    update public.ordenes_lampara
    set estado = 'enviado', entregado_en = ahora
    where command_id = orden.command_id;

    return jsonb_build_object(
        'command_id', orden.command_id,
        'command', 'lamp_set',
        'params', jsonb_build_object('level', orden.nivel),
        'vence_en', orden.vence_en
    );
end;
$$;

revoke all on function public.tomar_orden_lampara()
    from public, anon, authenticated, service_role;
grant execute on function public.tomar_orden_lampara() to authenticated;

-- Confirmación de la Pico sobre su orden enviada y vigente. Idempotente para
-- una confirmación terminal idéntica, incluso tras vencer.
create function public.confirmar_orden_lampara(
    p_command_id uuid,
    p_ok boolean,
    p_level numeric,
    p_error text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    modulo text := cuna_private.modulo_lampara_de_sesion();
    orden public.ordenes_lampara%rowtype;
    ahora timestamptz;
begin
    if modulo is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    if p_command_id is null then
        raise exception 'command_id_requerido' using errcode = '22023';
    end if;

    if p_ok is null then
        raise exception 'confirmacion_invalida' using errcode = '22023';
    elsif p_ok then
        -- NaN e infinitos caen en la comparación de rango.
        if p_error is not null or p_level is null
            or p_level <> trunc(p_level) or p_level < 0 or p_level > 100 then
            raise exception 'confirmacion_invalida' using errcode = '22023';
        end if;
    elsif p_level is not null or p_error is null
        or p_error !~ '^[a-z0-9_:-]{1,80}$' then
        raise exception 'confirmacion_invalida' using errcode = '22023';
    end if;

    -- Orden inexistente o de otro módulo: mismo error, sin revelar nada.
    select o.* into orden
    from public.ordenes_lampara as o
    where o.command_id = p_command_id and o.device_id = modulo
    for update;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    ahora := clock_timestamp();

    if orden.estado in ('confirmado', 'error') then
        if (p_ok and orden.estado = 'confirmado' and orden.nivel_confirmado = p_level)
            or (not p_ok and orden.estado = 'error' and orden.error = p_error) then
            return jsonb_build_object(
                'command_id', orden.command_id,
                'estado', orden.estado,
                'confirmado_en', orden.confirmado_en
            );
        end if;
        raise exception 'confirmacion_distinta' using errcode = '23505';
    end if;

    if orden.estado <> 'enviado' then
        raise exception 'orden_no_enviada' using errcode = '55000';
    end if;

    if ahora >= orden.vence_en then
        raise exception 'orden_vencida' using errcode = '55000';
    end if;

    if p_ok and p_level <> orden.nivel then
        raise exception 'nivel_no_coincide' using errcode = '22023';
    end if;

    update public.ordenes_lampara
    set estado = case when p_ok then 'confirmado' else 'error' end,
        confirmado_en = ahora,
        nivel_confirmado = case when p_ok then p_level::integer end,
        error = case when p_ok then null else p_error end
    where command_id = orden.command_id
    returning * into orden;

    return jsonb_build_object(
        'command_id', orden.command_id,
        'estado', orden.estado,
        'confirmado_en', orden.confirmado_en
    );
end;
$$;

revoke all on function public.confirmar_orden_lampara(uuid, boolean, numeric, text)
    from public, anon, authenticated, service_role;
grant execute on function public.confirmar_orden_lampara(uuid, boolean, numeric, text)
    to authenticated;

commit;
