begin;

-- =============================================================================
-- Migración: eventos_colchon, ordenes_colchon y funciones asociadas
-- =============================================================================

-- 1. Tabla de eventos del colchón (si no existe o para asegurar estructura)
create table if not exists public.eventos_colchon (
    event_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id),
    bebe_id uuid not null references cuna_private.bebes(id),
    ts timestamptz not null check (isfinite(ts)),
    recibido_en timestamptz not null check (isfinite(recibido_en)),
    tipo text not null check (tipo in ('monitoring_started', 'alarm_started', 'alarm_stopped', 'monitoring_stopped')),
    datos jsonb not null default '{}'::jsonb
);

create index if not exists eventos_colchon_por_dispositivo
    on public.eventos_colchon (device_id, ts desc, recibido_en desc, event_id desc);

-- Seguridad RLS para eventos_colchon
alter table public.eventos_colchon enable row level security;
revoke all on public.eventos_colchon from public, anon, authenticated, service_role;
grant select on public.eventos_colchon to authenticated;
grant all on public.eventos_colchon to service_role;

drop policy if exists colchon_lectura_dueno on public.eventos_colchon;
create policy colchon_lectura_dueno on public.eventos_colchon
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));


-- 2. Tabla de órdenes / comandos para el colchón
create table if not exists public.ordenes_colchon (
    command_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id),
    command text not null check (command in (
        'scale_tare',
        'scale_calibrate',
        'mattress_reference',
        'mattress_start',
        'mattress_stop',
        'alarm_stop',
        'get_status'
    )),
    solicitante_id uuid not null,
    params jsonb not null default '{}'::jsonb,
    creado_en timestamptz not null check (isfinite(creado_en)),
    vence_en timestamptz not null check (isfinite(vence_en)),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'confirmado', 'error')),
    entregado_en timestamptz,
    confirmado_en timestamptz,
    error text
);

create index if not exists ordenes_colchon_por_dispositivo
    on public.ordenes_colchon (device_id, creado_en desc, command_id desc);

-- Seguridad RLS para ordenes_colchon
alter table public.ordenes_colchon enable row level security;
revoke all on public.ordenes_colchon from public, anon, authenticated, service_role;
grant select, insert on public.ordenes_colchon to authenticated;
grant all on public.ordenes_colchon to service_role;

drop policy if exists ordenes_colchon_lectura_dueno on public.ordenes_colchon;
create policy ordenes_colchon_lectura_dueno on public.ordenes_colchon
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

drop policy if exists ordenes_colchon_insercion_dueno on public.ordenes_colchon;
create policy ordenes_colchon_insercion_dueno on public.ordenes_colchon
    for insert to authenticated
    with check (cuna_private.es_dueno_activo(device_id));


-- 3. Función RPC para que los cuidadores soliciten comandos desde la web
create or replace function public.solicitar_comando_colchon(
    p_command_id uuid,
    p_device_id text,
    p_command text,
    p_params jsonb default '{}'::jsonb
)
returns public.ordenes_colchon
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    creada timestamptz;
    orden public.ordenes_colchon%rowtype;
begin
    if usuario is null or p_device_id is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    -- Validar que el dispositivo existe y está activo
    perform 1 from cuna_private.dispositivos as dispositivo
    where dispositivo.id = p_device_id and dispositivo.activo
    for share;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    -- Validar que el usuario es dueño activo
    perform 1 from cuna_private.duenos_dispositivo as dueno
    where dueno.dispositivo_id = p_device_id
      and dueno.usuario_id = usuario
      and dueno.activo
    for share;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    if p_command_id is null then
        raise exception 'command_id_requerido' using errcode = '22023';
    end if;

    creada := clock_timestamp();

    insert into public.ordenes_colchon (
        command_id,
        device_id,
        command,
        solicitante_id,
        params,
        creado_en,
        vence_en,
        estado
    ) values (
        p_command_id,
        p_device_id,
        p_command,
        usuario,
        coalesce(p_params, '{}'::jsonb),
        creada,
        creada + interval '30 seconds',
        'pendiente'
    ) on conflict (command_id) do nothing
    returning * into orden;

    if found then
        return orden;
    end if;

    select * into orden from public.ordenes_colchon where command_id = p_command_id;
    return orden;
end;
$$;

revoke all on function public.solicitar_comando_colchon(uuid, text, text, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.solicitar_comando_colchon(uuid, text, text, jsonb)
    to authenticated;


-- 4. Función RPC para que la Pico consulte y tome órdenes pendientes
create or replace function public.tomar_ordenes_colchon(
    p_device_id text,
    p_token_sha256 text
)
returns table (
    command_id uuid,
    command text,
    params jsonb
)
language plpgsql security definer
set search_path = ''
as $$
begin
    -- Validar token del microcontrolador
    perform 1 from cuna_private.dispositivos as dispositivo
    where dispositivo.id = p_device_id
      and dispositivo.token_sha256 = p_token_sha256
      and dispositivo.activo
    for share;

    if not found then
        return;
    end if;

    return query
    update public.ordenes_colchon as o
    set estado = 'enviado',
        entregado_en = clock_timestamp()
    where o.command_id in (
        select sub.command_id
        from public.ordenes_colchon as sub
        where sub.device_id = p_device_id
          and sub.estado = 'pendiente'
          and sub.vence_en > clock_timestamp()
        order by sub.creado_en asc
        limit 5
        for update skip locked
    )
    returning o.command_id, o.command, o.params;
end;
$$;

revoke all on function public.tomar_ordenes_colchon(text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.tomar_ordenes_colchon(text, text)
    to anon, authenticated, service_role;


-- 5. Función RPC para que la Pico confirme la ejecución de una orden
create or replace function public.confirmar_orden_colchon(
    p_command_id uuid,
    p_device_id text,
    p_token_sha256 text,
    p_ok boolean,
    p_error text default null
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    v_actualizado boolean;
begin
    perform 1 from cuna_private.dispositivos as dispositivo
    where dispositivo.id = p_device_id
      and dispositivo.token_sha256 = p_token_sha256
      and dispositivo.activo
    for share;

    if not found then
        return false;
    end if;

    update public.ordenes_colchon
    set estado = case when p_ok then 'confirmado' else 'error' end,
        confirmado_en = clock_timestamp(),
        error = p_error
    where command_id = p_command_id
      and device_id = p_device_id;

    return found;
end;
$$;

revoke all on function public.confirmar_orden_colchon(uuid, text, text, boolean, text)
    from public, anon, authenticated, service_role;
grant execute on function public.confirmar_orden_colchon(uuid, text, text, boolean, text)
    to anon, authenticated, service_role;

commit;
