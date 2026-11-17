begin;

-- Fase local 1 de RF-11.1: registro de solicitudes lamp_set del cuidador.
-- Supone que cuna_private.dispositivos y cuna_private.duenos_dispositivo existen
-- (migración 20261111000100) y que el módulo cuna-lampara-01 se da de alta aparte.
-- En este incremento todas las órdenes quedan en estado 'pendiente'. La
-- confirmación física llegará en una fase posterior.

create table public.ordenes_lampara (
    command_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id)
        check (device_id ~ '^cuna-lampara-[0-9]{2}$'),
    command text not null default 'lamp_set' check (command = 'lamp_set'),
    -- Dato histórico fijado por auth.uid(). Sin FK a auth.users a propósito:
    -- eliminar una cuenta no borra las órdenes previas ni bloquea la baja.
    solicitante_id uuid not null,
    nivel integer not null check (nivel between 0 and 100),
    creado_en timestamptz not null check (isfinite(creado_en)),
    vence_en timestamptz not null check (isfinite(vence_en)),
    estado text not null default 'pendiente' check (estado = 'pendiente'),
    check (vence_en = creado_en + interval '15 seconds')
);

create index ordenes_lampara_por_dispositivo
    on public.ordenes_lampara (device_id, creado_en desc, command_id desc);

alter table public.ordenes_lampara enable row level security;
revoke all on public.ordenes_lampara from public, anon, authenticated, service_role;
grant select on public.ordenes_lampara to authenticated;

create policy ordenes_lampara_lectura_dueno on public.ordenes_lampara
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

create function public.solicitar_lampara(
    p_command_id uuid,
    p_device_id text,
    p_level numeric
)
returns public.ordenes_lampara
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    creada timestamptz;
    orden public.ordenes_lampara%rowtype;
begin
    -- Autorización primero: un mismo error para sesión ausente, módulo ajeno,
    -- inexistente o inactivo y dueño inactivo, sin revelar cuál fue.
    -- El formato se valida antes de consultar nada. El módulo de la maqueta es
    -- cuna-lampara-01; otros siguen rechazados mientras no estén registrados.
    if usuario is null
        or p_device_id is null
        or p_device_id !~ '^cuna-lampara-[0-9]{2}$' then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    -- Bloquea módulo y dueño hasta el fin de la transacción para que una baja
    -- concurrente no invalide la comprobación.
    perform 1 from cuna_private.dispositivos as dispositivo
    where dispositivo.id = p_device_id and dispositivo.activo
    for share;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    perform 1 from cuna_private.duenos_dispositivo as dueno
    where dueno.dispositivo_id = p_device_id
        and dueno.usuario_id = usuario
        and dueno.activo
    for share;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    -- Sin redondeo: el nivel debe ser entero y estar en 0..100. NaN e
    -- infinitos caen en la comparación de rango (NaN ordena como mayor).
    if p_command_id is null then
        raise exception 'command_id_requerido' using errcode = '22023';
    end if;

    if p_level is null or p_level <> trunc(p_level) or p_level < 0 or p_level > 100 then
        raise exception 'nivel_invalido' using errcode = '22023';
    end if;

    creada := clock_timestamp();

    insert into public.ordenes_lampara (
        command_id, device_id, solicitante_id, nivel, creado_en, vence_en
    ) values (
        p_command_id, p_device_id, usuario, p_level::integer, creada, creada + interval '15 seconds'
    ) on conflict (command_id) do nothing
    returning * into orden;

    if found then
        return orden;
    end if;

    select existente.* into orden
    from public.ordenes_lampara as existente
    where existente.command_id = p_command_id;

    if not found then
        raise exception 'reintentar' using errcode = '40001';
    end if;

    -- Reenvío idéntico: devuelve la fila original sin extender la vigencia.
    if orden.device_id = p_device_id and orden.solicitante_id = usuario
        and orden.nivel = p_level then
        return orden;
    end if;

    raise exception 'command_id_en_uso' using errcode = '23505';
end;
$$;

revoke all on function public.solicitar_lampara(uuid, text, numeric)
    from public, anon, authenticated, service_role;
grant execute on function public.solicitar_lampara(uuid, text, numeric) to authenticated;

commit;
