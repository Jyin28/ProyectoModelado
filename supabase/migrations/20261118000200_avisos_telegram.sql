begin;

-- Fase 4 (HU-06, HU-07 y base de HU-24): registro unificado de eventos,
-- destinatarios de Telegram con código de un solo uso, avisos por evento y
-- destinatario con reintentos, horarios en America/Costa_Rica y episodios.
-- Requiere 20261111000100 y 20261118000100 (usa cuna_private.exigir_dueno y
-- cuna_private.bebe_vigente). No crea usuarios, bots ni secretos.
--
-- Telegram solo recibe texto: ningún aviso lleva imágenes (CA-07.4).

-- ---------------------------------------------------------------- eventos
-- Registro unificado de actividad (CA-24.1, CA-24.6). Ambiente y movimiento
-- conservan sus tablas; los tipos nuevos se escriben aquí.
create table public.eventos (
    event_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id),
    bebe_id uuid not null references cuna_private.bebes(id),
    tipo text not null check (tipo ~ '^[a-z][a-z0-9_]{1,40}$'),
    descripcion text check (descripcion is null or length(descripcion) <= 200),
    valor double precision check (
        valor is null or (valor > '-Infinity'::double precision and valor < 'Infinity'::double precision)
    ),
    unidad text check (unidad is null or length(unidad) between 1 and 16),
    ts timestamptz not null check (isfinite(ts)),
    recibido_en timestamptz not null check (isfinite(recibido_en)),
    datos jsonb not null default '{}'::jsonb
        check (jsonb_typeof(datos) = 'object' and length(datos::text) <= 2000)
);

create index eventos_por_dispositivo
    on public.eventos (device_id, ts desc, recibido_en desc, event_id desc);
create index eventos_por_bebe
    on public.eventos (bebe_id, ts desc, event_id desc);

alter table public.eventos enable row level security;
revoke all on public.eventos from public, anon, authenticated, service_role;
grant select on public.eventos to authenticated;

create policy eventos_lectura_dueno on public.eventos
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

-- ----------------------------------------------------------- destinatarios
create table cuna_private.destinatarios_telegram (
    id uuid primary key default gen_random_uuid(),
    dispositivo_id text not null references cuna_private.dispositivos(id),
    nombre text not null check (btrim(nombre) <> '' and length(nombre) <= 60),
    chat_id bigint,
    activo boolean not null default true,
    creado_en timestamptz not null default now()
);

-- Una conversación de Telegram no puede ser destinataria dos veces del mismo módulo.
create unique index destinatarios_chat_unico
    on cuna_private.destinatarios_telegram (dispositivo_id, chat_id)
    where chat_id is not null and activo;

create table cuna_private.codigos_vinculacion (
    codigo_sha256 text primary key check (codigo_sha256 ~ '^[0-9a-f]{64}$'),
    destinatario_id uuid not null references cuna_private.destinatarios_telegram(id),
    creado_en timestamptz not null default now(),
    vence_en timestamptz not null,
    usado_en timestamptz
);

-- ------------------------------------------------------------------ avisos
-- Un aviso por evento y destinatario (CA-07.1, CA-07.3). La unicidad impide
-- duplicados por reenvío del mismo evento.
create table cuna_private.avisos (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.eventos(event_id),
    destinatario_id uuid not null references cuna_private.destinatarios_telegram(id),
    estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido')),
    intentos integer not null default 0 check (intentos >= 0),
    creado_en timestamptz not null default now(),
    proximo_intento_en timestamptz not null default now(),
    enviado_en timestamptz,
    unique (event_id, destinatario_id)
);

create index avisos_pendientes_idx
    on cuna_private.avisos (proximo_intento_en, id) where estado = 'pendiente';

-- Cada intento queda registrado por aviso (evento y destinatario).
create table cuna_private.intentos_aviso (
    id uuid primary key default gen_random_uuid(),
    aviso_id uuid not null references cuna_private.avisos(id),
    intento_en timestamptz not null default now(),
    ok boolean not null,
    error text check (error is null or error ~ '^[a-z0-9_:. -]{1,80}$')
);

-- ---------------------------------------------------------------- horarios
-- hora_local es hora civil de America/Costa_Rica (sin horario de verano).
create table cuna_private.horarios (
    id uuid primary key default gen_random_uuid(),
    dispositivo_id text not null references cuna_private.dispositivos(id),
    tipo text not null check (tipo ~ '^[a-z][a-z0-9_]{1,40}$'),
    hora_local time not null check (date_part('second', hora_local) = 0),
    activo boolean not null default true,
    unique (dispositivo_id, tipo, hora_local)
);

-- Una ejecución por horario, día y hora: evita repetir un recordatorio.
create table cuna_private.ejecuciones_horario (
    horario_id uuid not null references cuna_private.horarios(id),
    fecha_local date not null,
    hora_local time not null,
    ejecutado_en timestamptz not null default now(),
    primary key (horario_id, fecha_local, hora_local)
);

-- ---------------------------------------------------------------- episodios
-- Un episodio es un tramo continuo fuera de rango (DEC-13, CA-07.5).
create table cuna_private.episodios (
    id uuid primary key default gen_random_uuid(),
    dispositivo_id text not null references cuna_private.dispositivos(id),
    variable text not null check (variable ~ '^[a-z][a-z0-9_]{1,40}$'),
    abierto_desde timestamptz not null,
    cerrado_en timestamptz,
    check (cerrado_en is null or cerrado_en >= abierto_desde)
);

create unique index episodios_abierto_unico
    on cuna_private.episodios (dispositivo_id, variable) where cerrado_en is null;

revoke all on cuna_private.destinatarios_telegram, cuna_private.codigos_vinculacion,
    cuna_private.avisos, cuna_private.intentos_aviso, cuna_private.horarios,
    cuna_private.ejecuciones_horario, cuna_private.episodios
    from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- internas
-- Un aviso por destinatario activo y vinculado, en el momento del evento.
create function cuna_private.crear_avisos(p_event_id uuid, p_device_id text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
    v_creados integer;
begin
    insert into cuna_private.avisos (event_id, destinatario_id)
    select p_event_id, dest.id
    from cuna_private.destinatarios_telegram as dest
    where dest.dispositivo_id = p_device_id and dest.activo and dest.chat_id is not null
    on conflict (event_id, destinatario_id) do nothing;
    get diagnostics v_creados = row_count;
    return v_creados;
end;
$$;

revoke all on function cuna_private.crear_avisos(uuid, text)
    from public, anon, authenticated, service_role;

-- Escribe un evento con el bebé asignado en su instante. Idempotente por
-- event_id: el mismo evento no duplica registros ni avisos; dos eventos
-- distintos con la misma hora se conservan (CA-24.5).
create function cuna_private.registrar_evento(
    p_event_id uuid,
    p_device_id text,
    p_tipo text,
    p_ts timestamptz,
    p_recibido_en timestamptz,
    p_descripcion text,
    p_valor double precision,
    p_unidad text,
    p_datos jsonb,
    p_avisar boolean
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
    v_bebe uuid;
    v_existente public.eventos%rowtype;
begin
    v_bebe := cuna_private.bebe_vigente(p_device_id, p_ts);

    if v_bebe is not null then
        insert into public.eventos (
            event_id, device_id, bebe_id, tipo, descripcion, valor, unidad, ts, recibido_en, datos
        ) values (
            p_event_id, p_device_id, v_bebe, p_tipo, p_descripcion, p_valor, p_unidad,
            p_ts, p_recibido_en, coalesce(p_datos, '{}'::jsonb)
        ) on conflict (event_id) do nothing;

        if found then
            if p_avisar then
                perform cuna_private.crear_avisos(p_event_id, p_device_id);
            end if;
            return 'creado';
        end if;
    end if;

    select ev.* into v_existente from public.eventos as ev where ev.event_id = p_event_id;

    if found then
        if v_existente.device_id = p_device_id and v_existente.tipo = p_tipo
            and v_existente.ts = p_ts
            and v_existente.descripcion is not distinct from p_descripcion
            and v_existente.valor is not distinct from p_valor
            and v_existente.unidad is not distinct from p_unidad
            and v_existente.datos = coalesce(p_datos, '{}'::jsonb) then
            return 'duplicado';
        end if;
        return 'id_reutilizado';
    end if;

    return 'sin_asignacion';
end;
$$;

revoke all on function cuna_private.registrar_evento(
    uuid, text, text, timestamptz, timestamptz, text, double precision, text, jsonb, boolean)
    from public, anon, authenticated, service_role;

-- Abre o cierra el episodio de una variable. Devuelve true solo cuando se abre
-- uno nuevo: ese es el único momento que genera aviso (CA-07.5).
create function cuna_private.actualizar_episodio(
    p_device_id text, p_variable text, p_fuera boolean, p_ts timestamptz)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    v_abierto uuid;
begin
    if p_fuera then
        insert into cuna_private.episodios (dispositivo_id, variable, abierto_desde)
        values (p_device_id, p_variable, p_ts)
        on conflict (dispositivo_id, variable) where cerrado_en is null do nothing
        returning id into v_abierto;
        return v_abierto is not null;
    end if;

    update cuna_private.episodios
    set cerrado_en = greatest(p_ts, abierto_desde)
    where dispositivo_id = p_device_id and variable = p_variable and cerrado_en is null;
    return false;
end;
$$;

revoke all on function cuna_private.actualizar_episodio(text, text, boolean, timestamptz)
    from public, anon, authenticated, service_role;

-- ------------------------------------------------------- RPC: ingesta
create function public.ingestar_evento(
    p_event_id uuid,
    p_device_id text,
    p_token_sha256 text,
    p_tipo text,
    p_ts timestamptz,
    p_recibido_en timestamptz,
    p_descripcion text default null,
    p_valor double precision default null,
    p_unidad text default null,
    p_datos jsonb default '{}'::jsonb,
    p_avisar boolean default false
)
returns text
language plpgsql security definer
set search_path = ''
as $$
begin
    perform 1 from cuna_private.dispositivos as disp
    where disp.id = p_device_id and disp.token_sha256 = p_token_sha256 and disp.activo
    for share;

    if not found then
        return 'no_autorizado';
    end if;

    return cuna_private.registrar_evento(
        p_event_id, p_device_id, p_tipo, p_ts, p_recibido_en,
        p_descripcion, p_valor, p_unidad, p_datos, p_avisar);
end;
$$;

-- ------------------------------------------------ RPC: destinatarios (web)
create function public.crear_destinatario(p_device_id text, p_nombre text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_nuevo cuna_private.destinatarios_telegram%rowtype;
begin
    perform cuna_private.exigir_dueno(p_device_id);
    if p_nombre is null or btrim(p_nombre) = '' or length(btrim(p_nombre)) > 60 then
        raise exception 'nombre_requerido' using errcode = '22023';
    end if;

    insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre)
    values (p_device_id, btrim(p_nombre))
    returning * into v_nuevo;

    return jsonb_build_object('id', v_nuevo.id, 'nombre', v_nuevo.nombre, 'vinculado', false);
end;
$$;

-- Devuelve el código una sola vez; la base guarda solo su hash.
create function public.generar_codigo_vinculacion(p_destinatario_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_dest cuna_private.destinatarios_telegram%rowtype;
    v_codigo text;
    v_vence timestamptz := now() + interval '15 minutes';
begin
    select d.* into v_dest from cuna_private.destinatarios_telegram as d
    where d.id = p_destinatario_id and d.activo for update;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    perform cuna_private.exigir_dueno(v_dest.dispositivo_id);

    -- Un código nuevo invalida los anteriores sin usar.
    update cuna_private.codigos_vinculacion
    set vence_en = least(vence_en, now())
    where destinatario_id = v_dest.id and usado_en is null;

    v_codigo := substring(replace(gen_random_uuid()::text, '-', '') from 1 for 20);
    insert into cuna_private.codigos_vinculacion (codigo_sha256, destinatario_id, vence_en)
    values (encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), v_dest.id, v_vence);

    return jsonb_build_object('codigo', v_codigo, 'vence_en', v_vence);
end;
$$;

-- Retirar al destinatario evita avisos futuros y no toca a los dueños (CA-06.3).
create function public.retirar_destinatario(p_destinatario_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_dest cuna_private.destinatarios_telegram%rowtype;
begin
    select d.* into v_dest from cuna_private.destinatarios_telegram as d
    where d.id = p_destinatario_id and d.activo for update;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    perform cuna_private.exigir_dueno(v_dest.dispositivo_id);

    update cuna_private.destinatarios_telegram set activo = false where id = v_dest.id;
    update cuna_private.codigos_vinculacion
    set vence_en = least(vence_en, now())
    where destinatario_id = v_dest.id and usado_en is null;

    return jsonb_build_object('id', v_dest.id, 'activo', false);
end;
$$;

-- La lista pertenece al módulo y la comparten sus dueños (CA-06.2). No expone chat_id.
create function public.mis_destinatarios(p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.exigir_dueno(p_device_id);
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', d.id, 'nombre', d.nombre, 'vinculado', d.chat_id is not null
        ) order by d.creado_en, d.id)
        from cuna_private.destinatarios_telegram as d
        where d.dispositivo_id = p_device_id and d.activo
    ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------ RPC: Telegram (servicio)
create function public.vincular_telegram(p_codigo text, p_chat_id bigint)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_hash text;
    v_cod cuna_private.codigos_vinculacion%rowtype;
    v_dest cuna_private.destinatarios_telegram%rowtype;
begin
    if p_codigo is null or p_chat_id is null or length(p_codigo) not between 8 and 64 then
        return jsonb_build_object('estado', 'codigo_invalido');
    end if;
    v_hash := encode(sha256(convert_to(p_codigo, 'UTF8')), 'hex');

    select c.* into v_cod from cuna_private.codigos_vinculacion as c
    where c.codigo_sha256 = v_hash and c.usado_en is null and c.vence_en > now()
    for update;

    if not found then
        return jsonb_build_object('estado', 'codigo_invalido');
    end if;

    select d.* into v_dest from cuna_private.destinatarios_telegram as d
    where d.id = v_cod.destinatario_id and d.activo for update;

    if not found then
        return jsonb_build_object('estado', 'codigo_invalido');
    end if;

    if exists (
        select 1 from cuna_private.destinatarios_telegram as otro
        where otro.dispositivo_id = v_dest.dispositivo_id and otro.chat_id = p_chat_id
          and otro.activo and otro.id <> v_dest.id
    ) then
        return jsonb_build_object('estado', 'chat_duplicado');
    end if;

    update cuna_private.codigos_vinculacion set usado_en = now() where codigo_sha256 = v_hash;
    update cuna_private.destinatarios_telegram set chat_id = p_chat_id where id = v_dest.id;

    return jsonb_build_object(
        'estado', 'vinculado', 'destinatario_id', v_dest.id, 'nombre', v_dest.nombre);
end;
$$;

-- Toma avisos listos y los reserva 2 minutos (arrendamiento): dos ejecuciones
-- simultáneas del notificador no envían el mismo aviso. Solo destinatarios
-- activos y vinculados.
create function public.avisos_pendientes(p_limite integer default 20)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_resultado jsonb;
begin
    if p_limite is null or p_limite < 1 or p_limite > 100 then
        raise exception 'limite_invalido' using errcode = '22023';
    end if;

    with elegidos as (
        select aviso.id
        from cuna_private.avisos as aviso
        join cuna_private.destinatarios_telegram as dest
            on dest.id = aviso.destinatario_id and dest.activo and dest.chat_id is not null
        where aviso.estado = 'pendiente' and aviso.proximo_intento_en <= clock_timestamp()
        order by aviso.proximo_intento_en, aviso.id
        limit p_limite
        for update of aviso skip locked
    ), reservados as (
        update cuna_private.avisos as aviso
        set proximo_intento_en = clock_timestamp() + interval '2 minutes'
        from elegidos
        where aviso.id = elegidos.id
        returning aviso.id, aviso.event_id, aviso.destinatario_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'aviso_id', r.id,
        'chat_id', dest.chat_id,
        'tipo', ev.tipo,
        'descripcion', ev.descripcion,
        'ts', ev.ts,
        'device_id', ev.device_id
    ) order by ev.ts, r.id), '[]'::jsonb)
    into v_resultado
    from reservados as r
    join public.eventos as ev on ev.event_id = r.event_id
    join cuna_private.destinatarios_telegram as dest on dest.id = r.destinatario_id;

    return v_resultado;
end;
$$;

-- Registra el resultado de un intento. Un fallo reintentable se reprograma
-- con espera creciente hasta 5 intentos; uno no reintentable falla de inmediato.
create function public.registrar_intento_aviso(
    p_aviso_id uuid, p_ok boolean, p_error text default null, p_reintentable boolean default true)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_aviso cuna_private.avisos%rowtype;
    v_error text;
    v_intentos integer;
    v_estado text;
begin
    if p_ok is null then
        raise exception 'resultado_invalido' using errcode = '22023';
    end if;

    select a.* into v_aviso from cuna_private.avisos as a where a.id = p_aviso_id for update;
    if not found then
        raise exception 'aviso_inexistente' using errcode = '22023';
    end if;

    -- Idempotente: un aviso ya cerrado no cambia.
    if v_aviso.estado <> 'pendiente' then
        return jsonb_build_object('aviso_id', v_aviso.id, 'estado', v_aviso.estado);
    end if;

    v_error := case when p_ok then null
        when p_error ~ '^[a-z0-9_:. -]{1,80}$' then p_error
        else 'error_desconocido' end;

    insert into cuna_private.intentos_aviso (aviso_id, ok, error) values (v_aviso.id, p_ok, v_error);
    v_intentos := v_aviso.intentos + 1;

    if p_ok then
        v_estado := 'enviado';
        update cuna_private.avisos set estado = 'enviado', intentos = v_intentos, enviado_en = now()
        where id = v_aviso.id;
    elsif not coalesce(p_reintentable, true) or v_intentos >= 5 then
        v_estado := 'fallido';
        update cuna_private.avisos set estado = 'fallido', intentos = v_intentos where id = v_aviso.id;
    else
        v_estado := 'pendiente';
        update cuna_private.avisos
        set intentos = v_intentos,
            proximo_intento_en = clock_timestamp() + (power(2, v_intentos - 1) * interval '30 seconds')
        where id = v_aviso.id;
    end if;

    return jsonb_build_object('aviso_id', v_aviso.id, 'estado', v_estado, 'intentos', v_intentos);
end;
$$;

-- ---------------------------------------------------------------- horarios
create function public.reemplazar_horarios(p_device_id text, p_tipo text, p_horas time[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_horas time[];
begin
    perform cuna_private.exigir_dueno(p_device_id);
    if p_tipo is null or p_tipo !~ '^[a-z][a-z0-9_]{1,40}$' or p_horas is null
        or cardinality(p_horas) > 48 then
        raise exception 'horario_invalido' using errcode = '22023';
    end if;

    -- Hora civil al minuto; sin duplicados.
    select coalesce(array_agg(distinct make_time(
        extract(hour from h)::integer, extract(minute from h)::integer, 0)), '{}')
    into v_horas from unnest(p_horas) as h;

    update cuna_private.horarios set activo = false
    where dispositivo_id = p_device_id and tipo = p_tipo and not (hora_local = any (v_horas));

    insert into cuna_private.horarios (dispositivo_id, tipo, hora_local)
    select p_device_id, p_tipo, h from unnest(v_horas) as h
    on conflict (dispositivo_id, tipo, hora_local) do update set activo = true;

    return public.mis_horarios(p_device_id, p_tipo);
end;
$$;

create function public.mis_horarios(p_device_id text, p_tipo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.exigir_dueno(p_device_id);
    return coalesce((
        select jsonb_agg(to_char(h.hora_local, 'HH24:MI') order by h.hora_local)
        from cuna_private.horarios as h
        where h.dispositivo_id = p_device_id and h.tipo = p_tipo and h.activo
    ), '[]'::jsonb);
end;
$$;

-- Ejecuta los recordatorios cuya hora local coincide con el minuto de
-- p_ahora, una vez por horario y día. No recupera horas ya vencidas (DEC-04,
-- DEC-10). La hora local es America/Costa_Rica sin importar la zona del servidor.
create function public.procesar_horarios(p_ahora timestamptz default now())
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_local timestamp := p_ahora at time zone 'America/Costa_Rica';
    v_fecha date := v_local::date;
    v_hora time := make_time(extract(hour from v_local)::integer, extract(minute from v_local)::integer, 0);
    v_horario record;
    v_nuevo integer;
    v_resultado text;
    v_ejecutados integer := 0;
    v_sin_bebe integer := 0;
begin
    for v_horario in
        select h.id, h.dispositivo_id, h.tipo
        from cuna_private.horarios as h
        where h.activo and h.tipo like 'recordatorio\_%' and h.hora_local = v_hora
        order by h.id
    loop
        insert into cuna_private.ejecuciones_horario (horario_id, fecha_local, hora_local)
        values (v_horario.id, v_fecha, v_hora)
        on conflict do nothing;
        get diagnostics v_nuevo = row_count;
        continue when v_nuevo = 0;

        v_resultado := cuna_private.registrar_evento(
            gen_random_uuid(), v_horario.dispositivo_id, v_horario.tipo, p_ahora, clock_timestamp(),
            case v_horario.tipo
                when 'recordatorio_alimentacion' then 'Recordatorio de alimentación'
                else 'Recordatorio programado' end,
            null, null, '{}'::jsonb, true);

        if v_resultado = 'creado' then
            v_ejecutados := v_ejecutados + 1;
        else
            v_sin_bebe := v_sin_bebe + 1;
        end if;
    end loop;

    return jsonb_build_object('ejecutados', v_ejecutados, 'sin_bebe', v_sin_bebe);
end;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function
    public.ingestar_evento(uuid, text, text, text, timestamptz, timestamptz, text, double precision, text, jsonb, boolean),
    public.crear_destinatario(text, text), public.generar_codigo_vinculacion(uuid),
    public.retirar_destinatario(uuid), public.mis_destinatarios(text),
    public.vincular_telegram(text, bigint), public.avisos_pendientes(integer),
    public.registrar_intento_aviso(uuid, boolean, text, boolean),
    public.reemplazar_horarios(text, text, time[]), public.mis_horarios(text, text),
    public.procesar_horarios(timestamptz)
    from public, anon, authenticated, service_role;

grant execute on function
    public.crear_destinatario(text, text), public.generar_codigo_vinculacion(uuid),
    public.retirar_destinatario(uuid), public.mis_destinatarios(text),
    public.reemplazar_horarios(text, text, time[]), public.mis_horarios(text, text)
    to authenticated;

grant execute on function
    public.ingestar_evento(uuid, text, text, text, timestamptz, timestamptz, text, double precision, text, jsonb, boolean),
    public.vincular_telegram(text, bigint), public.avisos_pendientes(integer),
    public.registrar_intento_aviso(uuid, boolean, text, boolean),
    public.procesar_horarios(timestamptz)
    to service_role;

commit;
