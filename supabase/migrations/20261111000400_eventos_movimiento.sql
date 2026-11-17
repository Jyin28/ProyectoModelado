begin;

-- Un evento por flanco ascendente del PIR. No guarda alertas ni su envío.
create table public.eventos_movimiento (
    event_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id)
        check (device_id ~ '^cuna-movimiento-[0-9]{2}$'),
    bebe_id uuid not null references cuna_private.bebes(id),
    ts timestamptz not null check (isfinite(ts)),
    recibido_en timestamptz not null check (isfinite(recibido_en))
);

create index eventos_movimiento_por_dispositivo
    on public.eventos_movimiento (device_id, ts desc, recibido_en desc, event_id desc);

alter table public.eventos_movimiento enable row level security;
revoke all on public.eventos_movimiento from public, anon, authenticated, service_role;
grant select on public.eventos_movimiento to authenticated;

create policy movimiento_lectura_dueno on public.eventos_movimiento
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

create function public.ingestar_movimiento(
    p_event_id uuid,
    p_device_id text,
    p_token_sha256 text,
    p_ts timestamptz,
    p_recibido_en timestamptz
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
    bebe_asignado uuid;
    existente public.eventos_movimiento%rowtype;
begin
    if p_device_id !~ '^cuna-movimiento-[0-9]{2}$' then
        return 'no_autorizado';
    end if;

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
        insert into public.eventos_movimiento (event_id, device_id, bebe_id, ts, recibido_en)
        values (p_event_id, p_device_id, bebe_asignado, p_ts, p_recibido_en)
        on conflict (event_id) do nothing;

        if found then
            return 'creado';
        end if;
    end if;

    select evento.* into existente from public.eventos_movimiento as evento
    where evento.event_id = p_event_id;

    if found then
        if existente.device_id = p_device_id and existente.ts = p_ts then
            return 'duplicado';
        end if;
        return 'id_reutilizado';
    end if;

    return 'sin_asignacion';
end;
$$;

revoke all on function public.ingestar_movimiento(uuid, text, text, timestamptz, timestamptz)
    from public, anon, authenticated, service_role;
grant execute on function public.ingestar_movimiento(uuid, text, text, timestamptz, timestamptz)
    to service_role;

commit;
