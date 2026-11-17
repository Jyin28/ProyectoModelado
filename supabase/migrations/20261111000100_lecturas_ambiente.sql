begin;

create schema cuna_private;
revoke all on schema cuna_private from public, anon, authenticated, service_role;

create table cuna_private.bebes (
    id uuid primary key default gen_random_uuid(),
    nombre text not null check (btrim(nombre) <> '')
);

create table cuna_private.dispositivos (
    id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
    token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
    activo boolean not null default true
);

create table cuna_private.duenos_dispositivo (
    dispositivo_id text not null references cuna_private.dispositivos(id),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    activo boolean not null default true,
    primary key (dispositivo_id, usuario_id)
);

-- Cada cambio rige hasta el siguiente. Un bebe_id nulo cierra la asignación.
create table cuna_private.asignaciones_bebe (
    dispositivo_id text not null references cuna_private.dispositivos(id),
    desde timestamptz not null check (isfinite(desde)),
    bebe_id uuid references cuna_private.bebes(id),
    primary key (dispositivo_id, desde)
);

revoke all on all tables in schema cuna_private from public, anon, authenticated, service_role;

create table public.lecturas_ambiente (
    event_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id),
    bebe_id uuid not null references cuna_private.bebes(id),
    ts timestamptz not null check (isfinite(ts)),
    recibido_en timestamptz not null check (isfinite(recibido_en)),
    temperatura_c double precision not null check (
        temperatura_c > '-Infinity'::double precision
        and temperatura_c < 'Infinity'::double precision
    ),
    humedad_pct double precision not null check (humedad_pct between 0 and 100)
);

create index lecturas_ambiente_por_dispositivo
    on public.lecturas_ambiente (device_id, ts desc, recibido_en desc, event_id desc);

alter table public.lecturas_ambiente enable row level security;
revoke all on public.lecturas_ambiente from public, anon, authenticated, service_role;
grant select on public.lecturas_ambiente to authenticated;

create function cuna_private.es_dueno_activo(p_device_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
    select exists (
        select 1
        from cuna_private.duenos_dispositivo as dueno
        where dueno.dispositivo_id = p_device_id
          and dueno.usuario_id = (select auth.uid())
          and dueno.activo
    );
$$;

revoke all on function cuna_private.es_dueno_activo(text) from public, anon, authenticated, service_role;
grant execute on function cuna_private.es_dueno_activo(text) to authenticated;

create policy ambiente_lectura_dueno on public.lecturas_ambiente
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

create function public.ingestar_ambiente(
    p_event_id uuid,
    p_device_id text,
    p_token_sha256 text,
    p_ts timestamptz,
    p_recibido_en timestamptz,
    p_temperatura_c double precision,
    p_humedad_pct double precision
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
    bebe_asignado uuid;
    existente public.lecturas_ambiente%rowtype;
begin
    perform 1 from cuna_private.dispositivos as dispositivo
    where dispositivo.id = p_device_id
      and dispositivo.token_sha256 = p_token_sha256
      and dispositivo.activo
    for share;

    if not found then
        return 'no_autorizado';
    end if;

    select asignacion.bebe_id into bebe_asignado
    from cuna_private.asignaciones_bebe as asignacion
    where asignacion.dispositivo_id = p_device_id and asignacion.desde <= p_ts
    order by asignacion.desde desc
    limit 1;

    if bebe_asignado is not null then
        insert into public.lecturas_ambiente (
            event_id, device_id, bebe_id, ts, recibido_en, temperatura_c, humedad_pct
        ) values (
            p_event_id, p_device_id, bebe_asignado, p_ts, p_recibido_en, p_temperatura_c, p_humedad_pct
        ) on conflict (event_id) do nothing;

        if found then
            return 'creado';
        end if;
    end if;

    select lectura.* into existente from public.lecturas_ambiente as lectura
    where lectura.event_id = p_event_id;

    if found then
        if existente.device_id = p_device_id and existente.ts = p_ts
            and existente.temperatura_c = p_temperatura_c and existente.humedad_pct = p_humedad_pct then
            return 'duplicado';
        end if;
        return 'id_reutilizado';
    end if;

    return 'sin_asignacion';
end;
$$;

revoke all on function public.ingestar_ambiente(uuid, text, text, timestamptz, timestamptz, double precision, double precision)
    from public, anon, authenticated, service_role;
grant execute on function public.ingestar_ambiente(uuid, text, text, timestamptz, timestamptz, double precision, double precision)
    to service_role;

commit;
