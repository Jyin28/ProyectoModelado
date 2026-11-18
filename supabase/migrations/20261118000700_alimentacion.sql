begin;

-- Fase 9 (HU-20 a HU-23): alimentación. Tomas con peso inicial y final,
-- pausas y cierre manual; correcciones auditadas; límites de temperatura del
-- biberón; ingesta de pesos y temperatura. La web conduce la toma y la Pico pesa
-- cuando se lo ordenan: el peso llega como evento, nunca como orden confirmada.
-- Requiere 20261111000100 a 20261111000400 y 20261118000100 a 20261118000600.
-- Es un archivo local: no se aplica a cuna-inteligente-dev sin autorización.
-- No crea usuarios, cuentas de dispositivo ni datos. El dispositivo no calienta,
-- no enfría ni suministra alimento: no hay actuadores (CA-23.4).

-- ------------------------------------------- reglas de órdenes por módulo
-- feeding_weigh es conocido y del módulo de alimentación, pero NO solicitable:
-- solo se crea con pedir_peso_toma, ligada a una toma abierta.
create or replace function cuna_private.comando_conocido(p_command text)
returns boolean
language sql immutable
set search_path = ''
as $$
    select p_command = any (array[
        'led_set', 'led_all', 'led_sequence', 'led_stop',
        'audio_play', 'audio_stop', 'motion_set',
        'mattress_arm', 'mattress_rearm', 'mattress_stop',
        'room_monitor_set', 'feeding_weigh'])
$$;

create or replace function cuna_private.comando_de_modulo(p_command text, p_device_id text)
returns boolean
language sql immutable
set search_path = ''
as $$
    select coalesce(
        (p_command like 'led\_%' and p_device_id like 'cuna-figuras-%')
        or (p_command like 'audio\_%' and p_device_id like 'cuna-audio-%')
        or (p_command = 'motion_set' and p_device_id like 'cuna-movimiento-%')
        or (p_command like 'mattress\_%' and p_device_id like 'cuna-colchon-%')
        or (p_command = 'room_monitor_set' and p_device_id like 'cuna-habitacion-%')
        or (p_command = 'feeding_weigh' and p_device_id like 'cuna-alimentacion-%'),
        false)
$$;

-- Parámetros por comando. Se amplía con feeding_weigh {toma_id, momento}.
create or replace function cuna_private.params_orden_validos(p_command text, p_params jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
    v_permitidas text[];
    v_clave text;
    v_n numeric;
begin
    if p_params is null or jsonb_typeof(p_params) <> 'object' then
        return false;
    end if;

    v_permitidas := case p_command
        when 'led_set' then array['index', 'on']
        when 'led_all' then array['on']
        when 'led_sequence' then array['name', 'step_s']
        when 'audio_play' then array['sound']
        when 'motion_set' then array['enabled']
        when 'mattress_arm' then array['duration_s', 'tolerance_pct', 'alarm_s']
        when 'mattress_rearm' then array['duration_s', 'tolerance_pct', 'alarm_s']
        when 'room_monitor_set' then array['sensor', 'enabled']
        when 'feeding_weigh' then array['toma_id', 'momento']
        else array[]::text[]
    end;

    for v_clave in select jsonb_object_keys(p_params) loop
        if not (v_clave = any (v_permitidas)) then
            return false;
        end if;
    end loop;

    if p_command = 'led_set' then
        v_n := cuna_private.numero_json(p_params -> 'index');
        return coalesce(v_n = trunc(v_n) and v_n between 0 and 5
            and jsonb_typeof(p_params -> 'on') = 'boolean', false);
    elsif p_command = 'led_all' then
        return coalesce(jsonb_typeof(p_params -> 'on') = 'boolean', false);
    elsif p_command = 'led_sequence' then
        v_n := cuna_private.numero_json(p_params -> 'step_s');
        return coalesce(jsonb_typeof(p_params -> 'name') = 'string'
            and (p_params ->> 'name') in ('chase', 'alternate', 'blink_all')
            and v_n between 2 and 3600, false);
    elsif p_command = 'audio_play' then
        return coalesce(jsonb_typeof(p_params -> 'sound') = 'string'
            and (p_params ->> 'sound') ~ '^[a-z0-9_]{1,40}$', false);
    elsif p_command = 'motion_set' then
        return coalesce(jsonb_typeof(p_params -> 'enabled') = 'boolean', false);
    elsif p_command = 'room_monitor_set' then
        return coalesce(jsonb_typeof(p_params -> 'sensor') = 'string'
            and (p_params ->> 'sensor') in ('puerta', 'movimiento')
            and jsonb_typeof(p_params -> 'enabled') = 'boolean', false);
    elsif p_command = 'feeding_weigh' then
        return coalesce(jsonb_typeof(p_params -> 'toma_id') = 'string'
            and (p_params ->> 'toma_id') ~
                '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and jsonb_typeof(p_params -> 'momento') = 'string'
            and (p_params ->> 'momento') in ('inicial', 'control', 'final'), false);
    elsif p_command in ('mattress_arm', 'mattress_rearm') then
        if p_params ? 'duration_s' then
            v_n := cuna_private.numero_json(p_params -> 'duration_s');
            if v_n is null or v_n <= 0 or v_n > 86400 then return false; end if;
        end if;
        if p_params ? 'tolerance_pct' then
            v_n := cuna_private.numero_json(p_params -> 'tolerance_pct');
            if v_n is null or v_n <= 0 or v_n >= 100 then return false; end if;
        end if;
        if p_params ? 'alarm_s' then
            v_n := cuna_private.numero_json(p_params -> 'alarm_s');
            if v_n is null or v_n <= 0 or v_n > 60 then return false; end if;
        end if;
        return true;
    elsif p_command in ('led_stop', 'audio_stop', 'mattress_stop') then
        return p_params = '{}'::jsonb;
    end if;
    return false;
end;
$$;

-- ------------------------------------------------------------------ tomas
-- Una toma por biberón: estado, peso inicial y final (del mismo recipiente),
-- inicio y fin. Solo hay una abierta por módulo. Nada se borra (DAT-01): una
-- toma que no empezó se cancela y queda registrada.
create table public.tomas (
    id uuid primary key,
    device_id text not null references cuna_private.dispositivos (id)
        check (device_id ~ '^cuna-alimentacion-[0-9]{2}$'),
    bebe_id uuid not null references cuna_private.bebes (id),
    estado text not null default 'preparando' check (estado in (
        'preparando', 'en_curso', 'pausada', 'por_cerrar', 'completa', 'cancelada')),
    peso_inicial_g double precision
        check (peso_inicial_g is null or (peso_inicial_g > 0 and peso_inicial_g <= 5000)),
    peso_final_g double precision
        check (peso_final_g is null or (peso_final_g > 0 and peso_final_g <= 5000)),
    ingerido_g double precision check (ingerido_g is null or (ingerido_g >= 0 and ingerido_g <= 5000)),
    peso_error text check (peso_error is null or peso_error in ('sin_lectura', 'sin_calibracion')),
    -- Dato histórico fijado por auth.uid(); sin FK a auth.users a propósito.
    creada_por uuid not null,
    creada_en timestamptz not null default clock_timestamp() check (isfinite(creada_en)),
    inicio timestamptz check (inicio is null or isfinite(inicio)),
    fin timestamptz check (fin is null or isfinite(fin)),
    check ((estado in ('preparando', 'cancelada')) = (inicio is null)),
    check ((estado in ('por_cerrar', 'completa')) = (fin is not null)),
    check (fin is null or fin >= inicio),
    check (estado in ('preparando', 'cancelada') or peso_inicial_g is not null),
    check (estado <> 'completa' or peso_final_g is not null),
    check ((estado = 'completa') = (ingerido_g is not null)),
    check (estado <> 'completa' or ingerido_g = peso_inicial_g - peso_final_g)
);

create unique index tomas_una_abierta on public.tomas (device_id)
    where estado in ('preparando', 'en_curso', 'pausada', 'por_cerrar');
create index tomas_por_dispositivo on public.tomas (device_id, creada_en desc, id desc);

create table public.pausas_toma (
    id uuid primary key default gen_random_uuid(),
    toma_id uuid not null references public.tomas (id),
    inicio timestamptz not null check (isfinite(inicio)),
    fin timestamptz check (fin is null or isfinite(fin)),
    check (fin is null or fin >= inicio)
);

create unique index pausas_toma_una_abierta on public.pausas_toma (toma_id) where fin is null;

-- Cada corrección conserva el valor anterior, el nuevo, quién, cuándo y por
-- qué (CA-21.4, CA-21.7). Solo se agrega; no se modifica ni se borra.
create table public.correcciones_toma (
    id uuid primary key default gen_random_uuid(),
    toma_id uuid not null references public.tomas (id),
    campo text not null check (campo in ('peso_inicial_g', 'peso_final_g')),
    valor_anterior double precision
        check (valor_anterior is null or (valor_anterior > 0 and valor_anterior <= 5000)),
    valor_nuevo double precision not null check (valor_nuevo > 0 and valor_nuevo <= 5000),
    -- Dato histórico fijado por auth.uid(); sin FK a auth.users a propósito.
    autor_id uuid not null,
    creada_en timestamptz not null default clock_timestamp() check (isfinite(creada_en)),
    motivo text not null check (length(motivo) between 1 and 200 and motivo = btrim(motivo))
);

create index correcciones_toma_por_toma on public.correcciones_toma (toma_id, creada_en);

-- Límites de frío y calor del biberón, definidos por quien cuida (CA-23.2).
create table cuna_private.limites_biberon (
    dispositivo_id text primary key references cuna_private.dispositivos (id)
        check (dispositivo_id ~ '^cuna-alimentacion-[0-9]{2}$'),
    temp_min double precision not null,
    temp_max double precision not null,
    actualizado_en timestamptz not null default now(),
    check (temp_min >= -10 and temp_max <= 100 and temp_min < temp_max)
);

-- Sin acceso directo: la web lee y escribe solo por las funciones de abajo.
alter table public.tomas enable row level security;
alter table public.pausas_toma enable row level security;
alter table public.correcciones_toma enable row level security;
revoke all on public.tomas, public.pausas_toma, public.correcciones_toma, cuna_private.limites_biberon
    from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------- ayudas
-- Duración activa en segundos: del inicio al fin (o a p_ahora) sin los
-- intervalos de pausa. Una pausa abierta cuenta hasta p_ahora o el fin (CA-21.1).
create function cuna_private.duracion_activa_s(p_toma_id uuid, p_ahora timestamptz)
returns integer
language sql stable security definer
set search_path = ''
as $$
    select case when t.inicio is null then null else
        greatest(0, floor(extract(epoch from (
            coalesce(t.fin, p_ahora) - t.inicio
            - coalesce((
                select sum(coalesce(p.fin, coalesce(t.fin, p_ahora)) - p.inicio)
                from public.pausas_toma as p where p.toma_id = t.id), interval '0')
        ))))::integer
    end
    from public.tomas as t where t.id = p_toma_id
$$;

-- Bloquea la toma y exige ser dueño de su módulo. Toma inexistente y dueño
-- ausente dan el mismo error.
create function cuna_private.bloquear_toma(p_toma_id uuid)
returns public.tomas
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype;
begin
    select t.* into v_toma from public.tomas as t where t.id = p_toma_id for update;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    perform cuna_private.exigir_dueno(v_toma.device_id);
    return v_toma;
end;
$$;

create function cuna_private.toma_json(p_id uuid, p_ahora timestamptz)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'id', t.id, 'device_id', t.device_id, 'bebe_id', t.bebe_id, 'estado', t.estado,
        'peso_inicial_g', t.peso_inicial_g, 'peso_final_g', t.peso_final_g,
        'ingerido_g', t.ingerido_g, 'peso_error', t.peso_error,
        'creada_en', t.creada_en, 'inicio', t.inicio, 'fin', t.fin,
        'duracion_activa_s', cuna_private.duracion_activa_s(t.id, p_ahora),
        'pausas', coalesce((
            select jsonb_agg(jsonb_build_object('inicio', p.inicio, 'fin', p.fin) order by p.inicio, p.id)
            from public.pausas_toma as p where p.toma_id = t.id), '[]'::jsonb),
        'correcciones', coalesce((
            select jsonb_agg(jsonb_build_object(
                'campo', c.campo, 'valor_anterior', c.valor_anterior, 'valor_nuevo', c.valor_nuevo,
                'motivo', c.motivo, 'creada_en', c.creada_en,
                'propia', c.autor_id = (select auth.uid())) order by c.creada_en, c.id)
            from public.correcciones_toma as c where c.toma_id = t.id), '[]'::jsonb))
    from public.tomas as t where t.id = p_id
$$;

-- Evento del registro unificado con id derivado de la toma y el tipo: repetir
-- la acción no duplica el registro. Sin aviso por Telegram.
create function cuna_private.evento_toma(
    p_toma public.tomas, p_tipo text, p_descripcion text, p_valor double precision)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.registrar_evento(
        md5(p_tipo || ':' || p_toma.id::text)::uuid, p_toma.device_id, p_tipo,
        clock_timestamp(), clock_timestamp(), p_descripcion, p_valor,
        case when p_valor is null then null else 'g' end,
        jsonb_build_object('toma_id', p_toma.id), false);
end;
$$;

revoke all on function
    cuna_private.duracion_activa_s(uuid, timestamptz),
    cuna_private.bloquear_toma(uuid),
    cuna_private.toma_json(uuid, timestamptz),
    cuna_private.evento_toma(public.tomas, text, text, double precision)
    from public, anon, authenticated, service_role;

-- ------------------------------------------------------- RPC: conducir la toma
create function public.crear_toma(p_toma_id uuid, p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_usuario uuid := cuna_private.exigir_dueno(p_device_id);
    v_toma public.tomas%rowtype;
    v_bebe uuid;
begin
    if p_toma_id is null or p_device_id !~ '^cuna-alimentacion-[0-9]{2}$' then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    perform 1 from cuna_private.dispositivos as disp where disp.id = p_device_id and disp.activo for share;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    select t.* into v_toma from public.tomas as t where t.id = p_toma_id;
    if found then
        -- Reenvío idéntico: devuelve la toma original.
        if v_toma.device_id = p_device_id and v_toma.creada_por = v_usuario then
            return cuna_private.toma_json(p_toma_id, clock_timestamp());
        end if;
        raise exception 'toma_id_en_uso' using errcode = '23505';
    end if;

    v_bebe := cuna_private.bebe_vigente(p_device_id, clock_timestamp());
    if v_bebe is null then
        raise exception 'sin_bebe_asignado' using errcode = '22023';
    end if;

    perform 1 from public.tomas as t
    where t.device_id = p_device_id
      and t.estado in ('preparando', 'en_curso', 'pausada', 'por_cerrar');
    if found then
        raise exception 'toma_abierta' using errcode = '55000';
    end if;

    insert into public.tomas (id, device_id, bebe_id, creada_por)
    values (p_toma_id, p_device_id, v_bebe, v_usuario);

    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

-- Pide a la Pico que pese. La orden vence en 15 s como las demás; el peso
-- llega después como evento (peso_alimentacion). inicial: antes de empezar;
-- control: durante la toma, p. ej. al devolver el biberón (CA-21.5, no cierra
-- nada); final: después de finalizar.
create function public.pedir_peso_toma(p_toma_id uuid, p_momento text, p_command_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_usuario uuid := (select auth.uid());
    v_toma public.tomas%rowtype;
    v_params jsonb;
    v_creada timestamptz;
    v_orden public.ordenes_modulo%rowtype;
begin
    v_toma := cuna_private.bloquear_toma(p_toma_id);

    if p_command_id is null then
        raise exception 'command_id_requerido' using errcode = '22023';
    end if;
    if p_momento is null or p_momento not in ('inicial', 'control', 'final') then
        raise exception 'momento_invalido' using errcode = '22023';
    end if;
    if not (case p_momento
            when 'inicial' then v_toma.estado = 'preparando'
            when 'control' then v_toma.estado in ('en_curso', 'pausada', 'por_cerrar')
            else v_toma.estado = 'por_cerrar' end) then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;

    perform 1 from cuna_private.dispositivos as disp
    where disp.id = v_toma.device_id and disp.activo for share;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    v_params := jsonb_build_object('toma_id', p_toma_id, 'momento', p_momento);
    v_creada := clock_timestamp();

    insert into public.ordenes_modulo (
        command_id, device_id, command, params, solicitante_id, creado_en, vence_en
    ) values (
        p_command_id, v_toma.device_id, 'feeding_weigh', v_params, v_usuario,
        v_creada, v_creada + interval '15 seconds'
    ) on conflict (command_id) do nothing
    returning * into v_orden;

    if not found then
        select o.* into v_orden from public.ordenes_modulo as o where o.command_id = p_command_id;
        if not found then
            raise exception 'reintentar' using errcode = '40001';
        end if;
        if not (v_orden.device_id = v_toma.device_id and v_orden.solicitante_id is not distinct from v_usuario
                and v_orden.command = 'feeding_weigh' and v_orden.params = v_params) then
            raise exception 'command_id_en_uso' using errcode = '23505';
        end if;
    else
        update public.tomas set peso_error = null where id = p_toma_id;
    end if;

    return jsonb_build_object(
        'command_id', v_orden.command_id, 'device_id', v_orden.device_id,
        'command', v_orden.command, 'estado', v_orden.estado,
        'creado_en', v_orden.creado_en, 'vence_en', v_orden.vence_en);
end;
$$;

-- Sin peso inicial válido no se inicia (CA-20.4).
create function public.iniciar_toma(p_toma_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
begin
    if v_toma.estado <> 'preparando' then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;
    if v_toma.peso_inicial_g is null then
        raise exception 'toma_sin_peso_inicial' using errcode = '22023';
    end if;

    update public.tomas set estado = 'en_curso', inicio = clock_timestamp()
    where id = p_toma_id returning * into v_toma;
    perform cuna_private.evento_toma(v_toma, 'toma_iniciada', 'Inició una toma', null);
    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

create function public.cancelar_toma(p_toma_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
begin
    if v_toma.estado <> 'preparando' then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;
    update public.tomas set estado = 'cancelada' where id = p_toma_id;
    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

create function public.pausar_toma(p_toma_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
begin
    if v_toma.estado <> 'en_curso' then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;
    insert into public.pausas_toma (toma_id, inicio) values (p_toma_id, clock_timestamp());
    update public.tomas set estado = 'pausada' where id = p_toma_id;
    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

-- Continúa la misma toma; el intervalo de pausa no cuenta (CA-21.1).
create function public.reanudar_toma(p_toma_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
begin
    if v_toma.estado <> 'pausada' then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;
    update public.pausas_toma set fin = clock_timestamp() where toma_id = p_toma_id and fin is null;
    update public.tomas set estado = 'en_curso' where id = p_toma_id;
    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

-- Finaliza a mano (CA-21.1): fija la hora de fin y queda por cerrar hasta que
-- haya peso final. No hay cierre automático (CA-21.5).
create function public.finalizar_toma(p_toma_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
    v_ahora timestamptz := clock_timestamp();
begin
    if v_toma.estado not in ('en_curso', 'pausada') then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;
    update public.pausas_toma set fin = v_ahora where toma_id = p_toma_id and fin is null;
    update public.tomas set estado = 'por_cerrar', fin = v_ahora where id = p_toma_id;
    return cuna_private.toma_json(p_toma_id, v_ahora);
end;
$$;

-- Cierra como completa solo con los dos pesos y sin consumo negativo (CA-21.6).
-- Si falla, la toma sigue abierta y se puede corregir y reintentar.
create function public.cerrar_toma(p_toma_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
begin
    if v_toma.estado <> 'por_cerrar' then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;
    if v_toma.peso_inicial_g is null or v_toma.peso_final_g is null
        or v_toma.peso_final_g > v_toma.peso_inicial_g then
        raise exception 'toma_incompleta' using errcode = '22023';
    end if;

    update public.tomas
    set estado = 'completa', ingerido_g = peso_inicial_g - peso_final_g
    where id = p_toma_id returning * into v_toma;
    perform cuna_private.evento_toma(v_toma, 'toma_completa', 'Toma completada', v_toma.ingerido_g);
    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

-- Corrige un peso conservando el valor anterior, quién, cuándo y por qué. Si la
-- toma ya estaba completa, recalcula lo ingerido; una corrección que dejaría un
-- consumo negativo se rechaza y no cambia nada.
create function public.corregir_toma(
    p_toma_id uuid, p_campo text, p_valor double precision, p_motivo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype := cuna_private.bloquear_toma(p_toma_id);
    v_usuario uuid := (select auth.uid());
    v_anterior double precision;
    v_motivo text := btrim(p_motivo);
begin
    if p_campo is null or p_campo not in ('peso_inicial_g', 'peso_final_g')
        or p_valor is null or not (p_valor > 0 and p_valor <= 5000) then
        raise exception 'correccion_invalida' using errcode = '22023';
    end if;
    if v_motivo is null or length(v_motivo) not between 1 and 200 then
        raise exception 'motivo_invalido' using errcode = '22023';
    end if;
    if not (case p_campo
            when 'peso_inicial_g' then v_toma.estado in ('en_curso', 'pausada', 'por_cerrar', 'completa')
            else v_toma.estado in ('por_cerrar', 'completa') end) then
        raise exception 'estado_toma_invalido' using errcode = '55000';
    end if;

    v_anterior := case p_campo when 'peso_inicial_g' then v_toma.peso_inicial_g else v_toma.peso_final_g end;
    if v_anterior is not distinct from p_valor then
        raise exception 'correccion_invalida' using errcode = '22023';
    end if;

    if v_toma.estado = 'completa' and
        (case p_campo when 'peso_inicial_g' then p_valor - v_toma.peso_final_g
                      else v_toma.peso_inicial_g - p_valor end) < 0 then
        raise exception 'correccion_invalida' using errcode = '22023';
    end if;

    insert into public.correcciones_toma (toma_id, campo, valor_anterior, valor_nuevo, autor_id, motivo)
    values (p_toma_id, p_campo, v_anterior, p_valor, v_usuario, v_motivo);

    if p_campo = 'peso_inicial_g' then
        update public.tomas set peso_inicial_g = p_valor,
            ingerido_g = case when estado = 'completa' then p_valor - peso_final_g end
        where id = p_toma_id;
    else
        update public.tomas set peso_final_g = p_valor,
            ingerido_g = case when estado = 'completa' then peso_inicial_g - p_valor end
        where id = p_toma_id;
    end if;

    return cuna_private.toma_json(p_toma_id, clock_timestamp());
end;
$$;

-- Tomas recientes con pausas, correcciones y duración activa a la hora del
-- servidor ('ahora'), para que la web no dependa de su propio reloj.
create function public.mis_tomas(p_device_id text, p_limite integer default 20)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_ahora timestamptz := clock_timestamp();
begin
    perform cuna_private.exigir_dueno(p_device_id);
    if p_device_id !~ '^cuna-alimentacion-[0-9]{2}$' then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    if p_limite is null or p_limite not between 1 and 100 then
        raise exception 'limite_invalido' using errcode = '22023';
    end if;

    return jsonb_build_object('ahora', v_ahora, 'tomas', coalesce((
        select jsonb_agg(cuna_private.toma_json(x.id, v_ahora) order by x.creada_en desc, x.id desc)
        from (
            select t.id, t.creada_en from public.tomas as t
            where t.device_id = p_device_id
            order by t.creada_en desc, t.id desc
            limit p_limite
        ) as x), '[]'::jsonb));
end;
$$;

-- ------------------------------------------------ límites de temperatura
create function public.guardar_limites_biberon(
    p_device_id text, p_temp_min double precision, p_temp_max double precision)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.exigir_dueno(p_device_id);

    -- NaN e infinitos caen en las comparaciones. Un rechazo no toca el límite previo.
    if p_device_id !~ '^cuna-alimentacion-[0-9]{2}$'
        or p_temp_min is null or p_temp_max is null
        or not (p_temp_min >= -10 and p_temp_max <= 100 and p_temp_min < p_temp_max) then
        raise exception 'limites_invalidos' using errcode = '22023';
    end if;

    insert into cuna_private.limites_biberon (dispositivo_id, temp_min, temp_max, actualizado_en)
    values (p_device_id, p_temp_min, p_temp_max, now())
    on conflict (dispositivo_id) do update
        set temp_min = excluded.temp_min, temp_max = excluded.temp_max,
            actualizado_en = excluded.actualizado_en;

    return public.mis_limites_biberon(p_device_id);
end;
$$;

create function public.mis_limites_biberon(p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_lim cuna_private.limites_biberon%rowtype;
begin
    perform cuna_private.exigir_dueno(p_device_id);
    select l.* into v_lim from cuna_private.limites_biberon as l where l.dispositivo_id = p_device_id;
    if not found then
        return null;
    end if;
    return jsonb_build_object('temp_min', v_lim.temp_min, 'temp_max', v_lim.temp_max);
end;
$$;

-- Frío y calor son episodios distintos: cada uno avisa solo al abrirse
-- (CA-07.5) y pasar de un extremo al otro avisa de nuevo (CA-23.3).
create function cuna_private.evaluar_biberon(
    p_device_id text, p_ts timestamptz, p_temperatura double precision)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_lim cuna_private.limites_biberon%rowtype;
begin
    select l.* into v_lim from cuna_private.limites_biberon as l where l.dispositivo_id = p_device_id;
    if not found then
        return;
    end if;

    if cuna_private.actualizar_episodio(p_device_id, 'biberon_frio', p_temperatura < v_lim.temp_min, p_ts) then
        perform cuna_private.registrar_evento(
            gen_random_uuid(), p_device_id, 'biberon_fuera_rango', p_ts, clock_timestamp(),
            'Biberón por debajo del límite', p_temperatura, '°C',
            jsonb_build_object('variable', 'frio', 'minimo', v_lim.temp_min, 'maximo', v_lim.temp_max), true);
    end if;

    if cuna_private.actualizar_episodio(p_device_id, 'biberon_calor', p_temperatura > v_lim.temp_max, p_ts) then
        perform cuna_private.registrar_evento(
            gen_random_uuid(), p_device_id, 'biberon_fuera_rango', p_ts, clock_timestamp(),
            'Biberón por encima del límite', p_temperatura, '°C',
            jsonb_build_object('variable', 'calor', 'minimo', v_lim.temp_min, 'maximo', v_lim.temp_max), true);
    end if;
end;
$$;

revoke all on function cuna_private.evaluar_biberon(text, timestamptz, double precision)
    from public, anon, authenticated, service_role;

-- ---------------------------------------------------------- ingesta (Pico)
-- peso_alimentacion {toma_id, momento, gramos}: fija el peso inicial o final de
-- la toma según su estado; el de control solo queda en el registro (CA-21.5).
-- peso_alimentacion_fallido {toma_id, momento, motivo}: deja el error visible.
-- temperatura_biberon {temperatura_c}: lectura y evaluación de límites.
-- Un evento que no corresponde al estado de la toma se rechaza sin guardarlo.
create function public.ingestar_alimentacion(
    p_event_id uuid,
    p_device_id text,
    p_token_sha256 text,
    p_tipo text,
    p_ts timestamptz,
    p_recibido_en timestamptz,
    p_datos jsonb
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
    v_toma public.tomas%rowtype;
    v_claves text[];
    v_gramos numeric;
    v_temp numeric;
    v_momento text;
    v_resultado text;
begin
    if p_device_id !~ '^cuna-alimentacion-[0-9]{2}$' then
        return 'no_autorizado';
    end if;

    perform 1 from cuna_private.dispositivos as disp
    where disp.id = p_device_id and disp.token_sha256 = p_token_sha256 and disp.activo
    for share;

    if not found then
        return 'no_autorizado';
    end if;

    if p_tipo is null or p_tipo not in ('peso_alimentacion', 'peso_alimentacion_fallido', 'temperatura_biberon')
        or p_datos is null or jsonb_typeof(p_datos) <> 'object' then
        return 'evento_invalido';
    end if;

    select array_agg(k order by k) into v_claves from jsonb_object_keys(p_datos) as k;

    if p_tipo = 'temperatura_biberon' then
        v_temp := cuna_private.numero_json(p_datos -> 'temperatura_c');
        if v_claves is distinct from array['temperatura_c'] or v_temp is null
            or v_temp not between -55 and 125 then
            return 'evento_invalido';
        end if;

        v_resultado := cuna_private.registrar_evento(
            p_event_id, p_device_id, p_tipo, p_ts, p_recibido_en,
            'Temperatura del biberón', v_temp::double precision, '°C', '{}'::jsonb, false);
        if v_resultado = 'creado' then
            perform cuna_private.evaluar_biberon(p_device_id, p_ts, v_temp::double precision);
        end if;
        return v_resultado;
    end if;

    -- Pesos: la toma debe ser de este módulo y estar en un estado que admita el momento.
    v_momento := p_datos ->> 'momento';
    if jsonb_typeof(p_datos -> 'toma_id') is distinct from 'string'
        or (p_datos ->> 'toma_id') !~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(p_datos -> 'momento') is distinct from 'string'
        or v_momento not in ('inicial', 'control', 'final') then
        return 'evento_invalido';
    end if;

    select t.* into v_toma from public.tomas as t
    where t.id = (p_datos ->> 'toma_id')::uuid and t.device_id = p_device_id
    for update;
    if not found or not (case v_momento
            when 'inicial' then v_toma.estado = 'preparando'
            when 'control' then v_toma.estado in ('en_curso', 'pausada', 'por_cerrar')
            else v_toma.estado = 'por_cerrar' end) then
        return 'evento_invalido';
    end if;

    if p_tipo = 'peso_alimentacion_fallido' then
        if v_claves is distinct from array['momento', 'motivo', 'toma_id']
            or (p_datos ->> 'motivo') not in ('sin_lectura', 'sin_calibracion') then
            return 'evento_invalido';
        end if;
        v_resultado := cuna_private.registrar_evento(
            p_event_id, p_device_id, p_tipo, p_ts, p_recibido_en,
            'No se pudo pesar el biberón', null, null, p_datos, false);
        if v_resultado = 'creado' then
            update public.tomas set peso_error = p_datos ->> 'motivo' where id = v_toma.id;
        end if;
        return v_resultado;
    end if;

    v_gramos := cuna_private.numero_json(p_datos -> 'gramos');
    if v_claves is distinct from array['gramos', 'momento', 'toma_id'] or v_gramos is null
        or v_gramos not between 0 and 5000
        or (v_momento <> 'control' and v_gramos <= 0) then
        return 'evento_invalido';
    end if;

    v_resultado := cuna_private.registrar_evento(
        p_event_id, p_device_id, p_tipo, p_ts, p_recibido_en,
        'Peso del biberón registrado', v_gramos::double precision, 'g',
        jsonb_build_object('toma_id', v_toma.id, 'momento', v_momento), false);

    if v_resultado = 'creado' then
        if v_momento = 'inicial' then
            update public.tomas set peso_inicial_g = v_gramos::double precision, peso_error = null
            where id = v_toma.id;
        elsif v_momento = 'final' then
            update public.tomas set peso_final_g = v_gramos::double precision, peso_error = null
            where id = v_toma.id;
        else
            update public.tomas set peso_error = null where id = v_toma.id;
        end if;
    end if;
    return v_resultado;
end;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function
    public.crear_toma(uuid, text),
    public.pedir_peso_toma(uuid, text, uuid),
    public.iniciar_toma(uuid),
    public.cancelar_toma(uuid),
    public.pausar_toma(uuid),
    public.reanudar_toma(uuid),
    public.finalizar_toma(uuid),
    public.cerrar_toma(uuid),
    public.corregir_toma(uuid, text, double precision, text),
    public.mis_tomas(text, integer),
    public.guardar_limites_biberon(text, double precision, double precision),
    public.mis_limites_biberon(text),
    public.ingestar_alimentacion(uuid, text, text, text, timestamptz, timestamptz, jsonb)
    from public, anon, authenticated, service_role;

grant execute on function
    public.crear_toma(uuid, text),
    public.pedir_peso_toma(uuid, text, uuid),
    public.iniciar_toma(uuid),
    public.cancelar_toma(uuid),
    public.pausar_toma(uuid),
    public.reanudar_toma(uuid),
    public.finalizar_toma(uuid),
    public.cerrar_toma(uuid),
    public.corregir_toma(uuid, text, double precision, text),
    public.mis_tomas(text, integer),
    public.guardar_limites_biberon(text, double precision, double precision),
    public.mis_limites_biberon(text)
    to authenticated;

grant execute on function
    public.ingestar_alimentacion(uuid, text, text, text, timestamptz, timestamptz, jsonb)
    to service_role;

commit;
