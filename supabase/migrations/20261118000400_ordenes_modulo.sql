begin;

-- Fase 5 (HU-08 a HU-13): órdenes remotas generalizadas por módulo, límites de
-- ambiente con episodios, monitoreo de movimiento, horarios que generan
-- órdenes, actividad de audio y canal de voz.
-- Requiere 20261111000100 a 20261111000400 y 20261118000100 a 20261118000200.
-- ordenes_lampara y sus funciones quedan intactas. No crea usuarios, cuentas
-- de dispositivo ni datos.

-- ---------------------------------------------------- cuentas de dispositivo
-- La cuenta Auth de una Pico ya no se limita a la lámpara: puede vincularse a
-- cualquier módulo lógico (cuna-<tipo>-NN).
alter table cuna_private.cuentas_dispositivo
    drop constraint cuentas_dispositivo_device_id_check;
alter table cuna_private.cuentas_dispositivo
    add constraint cuentas_dispositivo_device_id_check
        check (device_id ~ '^cuna-[a-z]+-[0-9]{2}$');

-- ------------------------------------------------------------------ helpers
create function cuna_private.numero_json(p_valor jsonb)
returns numeric
language sql immutable
set search_path = ''
as $$
    select case when jsonb_typeof(p_valor) = 'number' then (p_valor #>> '{}')::numeric end
$$;

-- Estado confirmado por la Pico para cada módulo. Solo cambia con una
-- confirmación real (ok = true); nunca por la solicitud.
create table cuna_private.estado_modulo (
    dispositivo_id text primary key references cuna_private.dispositivos(id),
    estado jsonb not null default '{}'::jsonb check (jsonb_typeof(estado) = 'object'),
    actualizado_en timestamptz not null
);

create table cuna_private.limites_ambiente (
    dispositivo_id text primary key references cuna_private.dispositivos(id)
        check (dispositivo_id ~ '^cuna-ambiente-[0-9]{2}$'),
    temp_min double precision not null,
    temp_max double precision not null,
    hum_min double precision not null,
    hum_max double precision not null,
    actualizado_en timestamptz not null default now(),
    check (temp_min >= -40 and temp_max <= 85 and temp_min < temp_max),
    check (hum_min >= 0 and hum_max <= 100 and hum_min < hum_max)
);

revoke all on cuna_private.estado_modulo, cuna_private.limites_ambiente
    from public, anon, authenticated, service_role;

-- Parámetros válidos por comando. Mismos nombres y rangos que comandos.py.
create function cuna_private.params_orden_validos(p_command text, p_params jsonb)
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

revoke all on function cuna_private.numero_json(jsonb), cuna_private.params_orden_validos(text, jsonb)
    from public, anon, authenticated, service_role;

-- ----------------------------------------------------------- ordenes_modulo
create table public.ordenes_modulo (
    command_id uuid primary key,
    device_id text not null references cuna_private.dispositivos(id)
        check (device_id ~ '^cuna-(figuras|audio|movimiento|colchon)-[0-9]{2}$'),
    command text not null check (command in (
        'led_set', 'led_all', 'led_sequence', 'led_stop',
        'audio_play', 'audio_stop', 'motion_set',
        'mattress_arm', 'mattress_rearm', 'mattress_stop')),
    params jsonb not null default '{}'::jsonb
        check (jsonb_typeof(params) = 'object' and length(params::text) <= 500),
    origen text not null default 'usuario' check (origen in ('usuario', 'horario')),
    -- Dato histórico fijado por auth.uid(); sin FK a auth.users a propósito.
    solicitante_id uuid,
    creado_en timestamptz not null check (isfinite(creado_en)),
    vence_en timestamptz not null check (isfinite(vence_en)),
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'enviado', 'confirmado', 'error')),
    entregado_en timestamptz check (entregado_en is null or isfinite(entregado_en)),
    confirmado_en timestamptz check (confirmado_en is null or isfinite(confirmado_en)),
    resultado jsonb check (resultado is null or (jsonb_typeof(resultado) = 'object'
        and length(resultado::text) <= 500)),
    error text check (error is null or error ~ '^[a-z0-9_:-]{1,80}$'),
    check (vence_en = creado_en + interval '15 seconds'),
    check ((origen = 'usuario') = (solicitante_id is not null)),
    check (cuna_private.params_orden_validos(command, params)),
    check (
        (command like 'led\_%' and device_id like 'cuna-figuras-%')
        or (command like 'audio\_%' and device_id like 'cuna-audio-%')
        or (command = 'motion_set' and device_id like 'cuna-movimiento-%')
        or (command like 'mattress\_%' and device_id like 'cuna-colchon-%')
    ),
    check (
        case estado
            when 'pendiente' then entregado_en is null and confirmado_en is null
                and resultado is null and error is null
            when 'enviado' then entregado_en is not null and confirmado_en is null
                and resultado is null and error is null
            when 'confirmado' then entregado_en is not null and confirmado_en is not null
                and error is null
            when 'error' then entregado_en is not null and confirmado_en is not null
                and resultado is null and error is not null
            else false
        end
    ),
    check (
        (entregado_en is null or (entregado_en >= creado_en and entregado_en <= vence_en))
        and (confirmado_en is null
            or (confirmado_en >= entregado_en and confirmado_en <= vence_en))
    )
);

create index ordenes_modulo_por_dispositivo
    on public.ordenes_modulo (device_id, creado_en desc, command_id desc);

alter table public.ordenes_modulo enable row level security;
revoke all on public.ordenes_modulo from public, anon, authenticated, service_role;
grant select on public.ordenes_modulo to authenticated;

create policy ordenes_modulo_lectura_dueno on public.ordenes_modulo
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

-- Señal de orden nueva: solo el command_id, por el canal del producto.
create function cuna_private.avisar_orden_modulo()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
    v_producto text;
begin
    select coalesce(disp.producto_id, disp.id) into v_producto
    from cuna_private.dispositivos as disp where disp.id = new.device_id;

    perform realtime.send(
        jsonb_build_object('command_id', new.command_id),
        'orden_disponible',
        'modulo:' || v_producto,
        true
    );
    return null;
end;
$$;

revoke all on function cuna_private.avisar_orden_modulo()
    from public, anon, authenticated, service_role;

create trigger ordenes_modulo_aviso
    after insert on public.ordenes_modulo
    for each row execute function cuna_private.avisar_orden_modulo();

-- La cuenta de la Pico recibe el canal de su producto ('modulo:<producto>');
-- solo los dueños y la Pico usan 'voz:<producto>' (nunca se persiste).
create function cuna_private.canal_cuenta_autorizado(p_topic text, p_prefijo text)
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
          and (p_prefijo <> 'voz' or modulo.tipo = 'cuna')
          and p_topic = p_prefijo || ':' || coalesce(modulo.producto_id, modulo.id)
    );
$$;

create function cuna_private.voz_dueno_autorizado(p_topic text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
    select p_topic is not null and exists (
        select 1
        from cuna_private.dispositivos as modulo
        where modulo.tipo = 'cuna'
          and modulo.activo
          and p_topic = 'voz:' || coalesce(modulo.producto_id, modulo.id)
          and cuna_private.es_dueno_activo(modulo.id)
    );
$$;

revoke all on function cuna_private.canal_cuenta_autorizado(text, text),
    cuna_private.voz_dueno_autorizado(text)
    from public, anon, authenticated, service_role;
grant execute on function cuna_private.canal_cuenta_autorizado(text, text),
    cuna_private.voz_dueno_autorizado(text) to authenticated;

create policy modulo_recibe_orden on realtime.messages
    for select to authenticated
    using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and cuna_private.canal_cuenta_autorizado((select realtime.topic()), 'modulo')
    );

create policy voz_recibe_modulo on realtime.messages
    for select to authenticated
    using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and cuna_private.canal_cuenta_autorizado((select realtime.topic()), 'voz')
    );

create policy voz_une_dueno on realtime.messages
    for select to authenticated
    using (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and cuna_private.voz_dueno_autorizado((select realtime.topic()))
    );

create policy voz_envia_dueno on realtime.messages
    for insert to authenticated
    with check (
        extension = 'broadcast'
        and topic = (select realtime.topic())
        and cuna_private.voz_dueno_autorizado((select realtime.topic()))
    );

-- ---------------------------------------------------------- solicitar_orden
create function public.solicitar_orden(
    p_command_id uuid,
    p_device_id text,
    p_command text,
    p_params jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_usuario uuid := (select auth.uid());
    v_creada timestamptz;
    v_orden public.ordenes_modulo%rowtype;
    v_params jsonb := coalesce(p_params, '{}'::jsonb);
begin
    -- Autorización primero, con un solo error para cualquier causa.
    if v_usuario is null or p_device_id is null
        or p_device_id !~ '^cuna-(figuras|audio|movimiento|colchon)-[0-9]{2}$' then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    perform 1 from cuna_private.dispositivos as disp
    where disp.id = p_device_id and disp.activo
    for share;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    perform 1 from cuna_private.duenos_dispositivo as dueno
    where dueno.dispositivo_id = p_device_id and dueno.usuario_id = v_usuario and dueno.activo
    for share;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    if p_command_id is null then
        raise exception 'command_id_requerido' using errcode = '22023';
    end if;

    if p_command is null or p_command not in (
        'led_set', 'led_all', 'led_sequence', 'led_stop',
        'audio_play', 'audio_stop', 'motion_set',
        'mattress_arm', 'mattress_rearm', 'mattress_stop') then
        raise exception 'comando_invalido' using errcode = '22023';
    end if;

    if not (
        (p_command like 'led\_%' and p_device_id like 'cuna-figuras-%')
        or (p_command like 'audio\_%' and p_device_id like 'cuna-audio-%')
        or (p_command = 'motion_set' and p_device_id like 'cuna-movimiento-%')
        or (p_command like 'mattress\_%' and p_device_id like 'cuna-colchon-%')
    ) then
        raise exception 'comando_de_otro_modulo' using errcode = '22023';
    end if;

    if not cuna_private.params_orden_validos(p_command, v_params) then
        raise exception 'parametros_invalidos' using errcode = '22023';
    end if;

    v_creada := clock_timestamp();

    insert into public.ordenes_modulo (
        command_id, device_id, command, params, solicitante_id, creado_en, vence_en
    ) values (
        p_command_id, p_device_id, p_command, v_params, v_usuario,
        v_creada, v_creada + interval '15 seconds'
    ) on conflict (command_id) do nothing
    returning * into v_orden;

    if not found then
        select o.* into v_orden from public.ordenes_modulo as o where o.command_id = p_command_id;
        if not found then
            raise exception 'reintentar' using errcode = '40001';
        end if;
        -- Reenvío idéntico: devuelve la orden original sin extender su vigencia.
        if not (v_orden.device_id = p_device_id and v_orden.solicitante_id is not distinct from v_usuario
                and v_orden.command = p_command and v_orden.params = v_params) then
            raise exception 'command_id_en_uso' using errcode = '23505';
        end if;
    end if;

    return jsonb_build_object(
        'command_id', v_orden.command_id, 'device_id', v_orden.device_id,
        'command', v_orden.command, 'estado', v_orden.estado,
        'creado_en', v_orden.creado_en, 'vence_en', v_orden.vence_en);
end;
$$;

-- ------------------------------------------------- módulo de la sesión (Pico)
-- Producto de la cuenta de dispositivo activa. Bloquea cuenta y módulo.
create function cuna_private.producto_de_sesion()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
    v_usuario uuid := (select auth.uid());
    v_producto text;
begin
    if v_usuario is null then
        return null;
    end if;

    select coalesce(disp.producto_id, disp.id) into v_producto
    from cuna_private.cuentas_dispositivo as cuenta
    join cuna_private.dispositivos as disp on disp.id = cuenta.device_id
    where cuenta.usuario_id = v_usuario and cuenta.activo and disp.activo
    for share of cuenta, disp;

    return v_producto;
end;
$$;

revoke all on function cuna_private.producto_de_sesion()
    from public, anon, authenticated, service_role;

-- Toma atómica (una sola vez) de la orden vigente más antigua del producto.
create function public.tomar_orden_modulo()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_producto text := cuna_private.producto_de_sesion();
    v_orden public.ordenes_modulo%rowtype;
    v_ahora timestamptz;
begin
    if v_producto is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    v_ahora := clock_timestamp();

    select o.* into v_orden
    from public.ordenes_modulo as o
    join cuna_private.dispositivos as disp on disp.id = o.device_id
    where coalesce(disp.producto_id, disp.id) = v_producto
      and o.estado = 'pendiente' and o.vence_en > v_ahora
    order by o.creado_en, o.command_id
    limit 1
    for update of o skip locked;

    if not found then
        return null;
    end if;

    v_ahora := clock_timestamp();
    if v_ahora >= v_orden.vence_en then
        return null;
    end if;

    update public.ordenes_modulo
    set estado = 'enviado', entregado_en = v_ahora
    where command_id = v_orden.command_id;

    return jsonb_build_object(
        'command_id', v_orden.command_id,
        'device_id', v_orden.device_id,
        'command', v_orden.command,
        'params', v_orden.params,
        'vence_en', v_orden.vence_en
    );
end;
$$;

-- Efectos de una confirmación real. Fase 6 amplía esta función.
create function cuna_private.aplicar_confirmacion(p_orden public.ordenes_modulo)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_estado jsonb;
begin
    v_estado := case p_orden.command
        when 'motion_set' then jsonb_build_object('monitoreo', (p_orden.params ->> 'enabled')::boolean)
        when 'led_sequence' then jsonb_build_object('secuencia', p_orden.params ->> 'name')
        when 'led_set' then jsonb_build_object('secuencia', null)
        when 'led_all' then jsonb_build_object('secuencia', null)
        when 'led_stop' then jsonb_build_object('secuencia', null)
        else null
    end;

    if v_estado is not null then
        insert into cuna_private.estado_modulo (dispositivo_id, estado, actualizado_en)
        values (p_orden.device_id, v_estado, p_orden.confirmado_en)
        on conflict (dispositivo_id) do update
            set estado = cuna_private.estado_modulo.estado || excluded.estado,
                actualizado_en = excluded.actualizado_en;
    end if;

    -- Actividad de audio (CA-11.3): se registra la reproducción, nunca sonido.
    if p_orden.command = 'audio_play' then
        perform cuna_private.registrar_evento(
            p_orden.command_id, p_orden.device_id, 'audio', p_orden.confirmado_en, clock_timestamp(),
            'Audio reproducido', null, null,
            jsonb_build_object('sound', p_orden.params ->> 'sound'), false);
    end if;
end;
$$;

revoke all on function cuna_private.aplicar_confirmacion(public.ordenes_modulo)
    from public, anon, authenticated, service_role;

create function public.confirmar_orden_modulo(
    p_command_id uuid,
    p_ok boolean,
    p_resultado jsonb,
    p_error text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_producto text := cuna_private.producto_de_sesion();
    v_orden public.ordenes_modulo%rowtype;
    v_ahora timestamptz;
    v_resultado jsonb := case when p_ok then coalesce(p_resultado, '{}'::jsonb) end;
begin
    if v_producto is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    if p_command_id is null then
        raise exception 'command_id_requerido' using errcode = '22023';
    end if;

    if p_ok is null then
        raise exception 'confirmacion_invalida' using errcode = '22023';
    elsif p_ok then
        if p_error is not null or jsonb_typeof(v_resultado) <> 'object'
            or length(v_resultado::text) > 500 then
            raise exception 'confirmacion_invalida' using errcode = '22023';
        end if;
    elsif p_resultado is not null or p_error is null or p_error !~ '^[a-z0-9_:-]{1,80}$' then
        raise exception 'confirmacion_invalida' using errcode = '22023';
    end if;

    -- Orden inexistente o de otro producto: mismo error, sin revelar nada.
    select o.* into v_orden
    from public.ordenes_modulo as o
    join cuna_private.dispositivos as disp on disp.id = o.device_id
    where o.command_id = p_command_id and coalesce(disp.producto_id, disp.id) = v_producto
    for update of o;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    v_ahora := clock_timestamp();

    if v_orden.estado in ('confirmado', 'error') then
        if (p_ok and v_orden.estado = 'confirmado' and v_orden.resultado = v_resultado)
            or (not p_ok and v_orden.estado = 'error' and v_orden.error = p_error) then
            return jsonb_build_object('command_id', v_orden.command_id,
                'estado', v_orden.estado, 'confirmado_en', v_orden.confirmado_en);
        end if;
        raise exception 'confirmacion_distinta' using errcode = '23505';
    end if;

    if v_orden.estado <> 'enviado' then
        raise exception 'orden_no_enviada' using errcode = '55000';
    end if;
    if v_ahora >= v_orden.vence_en then
        raise exception 'orden_vencida' using errcode = '55000';
    end if;

    update public.ordenes_modulo
    set estado = case when p_ok then 'confirmado' else 'error' end,
        confirmado_en = v_ahora,
        resultado = v_resultado,
        error = case when p_ok then null else p_error end
    where command_id = v_orden.command_id
    returning * into v_orden;

    if v_orden.estado = 'confirmado' then
        perform cuna_private.aplicar_confirmacion(v_orden);
    end if;

    return jsonb_build_object('command_id', v_orden.command_id,
        'estado', v_orden.estado, 'confirmado_en', v_orden.confirmado_en);
end;
$$;

-- Estado de un módulo según la última confirmación real.
create function public.estado_de_modulo(p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_fila cuna_private.estado_modulo%rowtype;
begin
    perform cuna_private.exigir_dueno(p_device_id);
    select e.* into v_fila from cuna_private.estado_modulo as e where e.dispositivo_id = p_device_id;
    if not found then
        return jsonb_build_object('estado', '{}'::jsonb, 'actualizado_en', null);
    end if;
    return jsonb_build_object('estado', v_fila.estado, 'actualizado_en', v_fila.actualizado_en);
end;
$$;

-- ----------------------------------------------------------------- límites
create function public.guardar_limites(
    p_device_id text,
    p_temp_min double precision,
    p_temp_max double precision,
    p_hum_min double precision,
    p_hum_max double precision
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.exigir_dueno(p_device_id);

    -- NaN e infinitos caen en las comparaciones. Un rechazo no toca el límite previo.
    if p_device_id !~ '^cuna-ambiente-[0-9]{2}$'
        or p_temp_min is null or p_temp_max is null or p_hum_min is null or p_hum_max is null
        or not (p_temp_min >= -40 and p_temp_max <= 85 and p_temp_min < p_temp_max)
        or not (p_hum_min >= 0 and p_hum_max <= 100 and p_hum_min < p_hum_max) then
        raise exception 'limites_invalidos' using errcode = '22023';
    end if;

    insert into cuna_private.limites_ambiente
        (dispositivo_id, temp_min, temp_max, hum_min, hum_max, actualizado_en)
    values (p_device_id, p_temp_min, p_temp_max, p_hum_min, p_hum_max, now())
    on conflict (dispositivo_id) do update
        set temp_min = excluded.temp_min, temp_max = excluded.temp_max,
            hum_min = excluded.hum_min, hum_max = excluded.hum_max,
            actualizado_en = excluded.actualizado_en;

    return public.mis_limites(p_device_id);
end;
$$;

create function public.mis_limites(p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_lim cuna_private.limites_ambiente%rowtype;
begin
    perform cuna_private.exigir_dueno(p_device_id);
    select l.* into v_lim from cuna_private.limites_ambiente as l where l.dispositivo_id = p_device_id;
    if not found then
        return null;
    end if;
    return jsonb_build_object('temp_min', v_lim.temp_min, 'temp_max', v_lim.temp_max,
        'hum_min', v_lim.hum_min, 'hum_max', v_lim.hum_max);
end;
$$;

-- Compara una lectura nueva con los límites y abre o cierra episodios. Un
-- episodio avisa solo al abrirse (CA-07.5, CA-10.2).
create function cuna_private.evaluar_limites(
    p_device_id text, p_ts timestamptz, p_temperatura double precision, p_humedad double precision)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_lim cuna_private.limites_ambiente%rowtype;
begin
    select l.* into v_lim from cuna_private.limites_ambiente as l where l.dispositivo_id = p_device_id;
    if not found then
        return;
    end if;

    if cuna_private.actualizar_episodio(p_device_id, 'temperatura',
        p_temperatura < v_lim.temp_min or p_temperatura > v_lim.temp_max, p_ts) then
        perform cuna_private.registrar_evento(
            gen_random_uuid(), p_device_id, 'ambiente_fuera_rango', p_ts, clock_timestamp(),
            'Temperatura fuera de rango', p_temperatura, '°C',
            jsonb_build_object('variable', 'temperatura',
                'minimo', v_lim.temp_min, 'maximo', v_lim.temp_max), true);
    end if;

    if cuna_private.actualizar_episodio(p_device_id, 'humedad',
        p_humedad < v_lim.hum_min or p_humedad > v_lim.hum_max, p_ts) then
        perform cuna_private.registrar_evento(
            gen_random_uuid(), p_device_id, 'ambiente_fuera_rango', p_ts, clock_timestamp(),
            'Humedad fuera de rango', p_humedad, '%',
            jsonb_build_object('variable', 'humedad',
                'minimo', v_lim.hum_min, 'maximo', v_lim.hum_max), true);
    end if;
end;
$$;

revoke all on function cuna_private.evaluar_limites(text, timestamptz, double precision, double precision)
    from public, anon, authenticated, service_role;

-- Misma función de la migración 1, más la evaluación de límites tras una
-- lectura nueva. Un reenvío no vuelve a evaluar.
create or replace function public.ingestar_ambiente(
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
            perform cuna_private.evaluar_limites(p_device_id, p_ts, p_temperatura_c, p_humedad_pct);
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

-- ---------------------------------------------------------------- movimiento
-- Misma función de la migración 4, con dos cambios: si la última confirmación
-- real dice que el monitoreo está apagado, el evento se ignora (CA-08.3); y
-- cada evento nuevo queda en el registro unificado y genera aviso (CA-08.1).
-- Sin estado confirmado se conserva el comportamiento previo.
create or replace function public.ingestar_movimiento(
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
    v_apagado boolean;
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

    select (e.estado ->> 'monitoreo') = 'false' into v_apagado
    from cuna_private.estado_modulo as e where e.dispositivo_id = p_device_id;
    if coalesce(v_apagado, false) then
        return 'monitoreo_inactivo';
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
            perform cuna_private.registrar_evento(
                p_event_id, p_device_id, 'movimiento', p_ts, p_recibido_en,
                'Movimiento detectado', null, null, '{}'::jsonb, true);
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

-- --------------------------------------------------------------- voz (web)
-- La voz no se guarda: solo se registra que hubo una sesión (CA-12.3).
create function public.registrar_actividad_voz(p_event_id uuid, p_device_id text, p_fase text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_resultado text;
begin
    perform cuna_private.exigir_dueno(p_device_id);
    if p_event_id is null or p_fase not in ('inicio', 'fin')
        or p_device_id !~ '^cuna-audio-[0-9]{2}$' then
        raise exception 'actividad_invalida' using errcode = '22023';
    end if;

    -- Un reenvío del mismo registro no cambia nada (la hora la fija el servidor).
    perform 1 from public.eventos as ev
    where ev.event_id = p_event_id and ev.device_id = p_device_id and ev.tipo = 'voz_' || p_fase;
    if found then
        return jsonb_build_object('resultado', 'duplicado');
    end if;

    v_resultado := cuna_private.registrar_evento(
        p_event_id, p_device_id, 'voz_' || p_fase, clock_timestamp(), clock_timestamp(),
        case p_fase when 'inicio' then 'Voz del cuidador iniciada' else 'Voz del cuidador finalizada' end,
        null, null, '{}'::jsonb, false);
    return jsonb_build_object('resultado', v_resultado);
end;
$$;

-- ----------------------------------------------- horarios que generan órdenes
create function cuna_private.crear_orden_horario(p_device_id text, p_tipo text, p_ahora timestamptz)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    v_comando text;
    v_params jsonb;
begin
    select m.comando, m.params into v_comando, v_params
    from (values
        ('figuras_encender', 'cuna-figuras-%', 'led_all', '{"on": true}'::jsonb),
        ('figuras_apagar', 'cuna-figuras-%', 'led_stop', '{}'::jsonb),
        ('movimiento_activar', 'cuna-movimiento-%', 'motion_set', '{"enabled": true}'::jsonb),
        ('movimiento_desactivar', 'cuna-movimiento-%', 'motion_set', '{"enabled": false}'::jsonb)
    ) as m(tipo, patron, comando, params)
    where m.tipo = p_tipo and p_device_id like m.patron;

    if v_comando is null then
        return false;
    end if;

    perform 1 from cuna_private.dispositivos as disp where disp.id = p_device_id and disp.activo;
    if not found then
        return false;
    end if;

    insert into public.ordenes_modulo
        (command_id, device_id, command, params, origen, solicitante_id, creado_en, vence_en)
    values (gen_random_uuid(), p_device_id, v_comando, v_params, 'horario', null,
        clock_timestamp(), clock_timestamp() + interval '15 seconds');
    return true;
end;
$$;

revoke all on function cuna_private.crear_orden_horario(text, text, timestamptz)
    from public, anon, authenticated, service_role;

-- Misma función de la migración 2, ampliada: además de recordatorios, los
-- horarios de figuras y de monitoreo generan órdenes. Sigue sin recuperar
-- horas vencidas (DEC-04, DEC-10).
create or replace function public.procesar_horarios(p_ahora timestamptz default now())
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
    v_ordenes integer := 0;
begin
    for v_horario in
        select h.id, h.dispositivo_id, h.tipo
        from cuna_private.horarios as h
        where h.activo and h.hora_local = v_hora
          and (h.tipo like 'recordatorio\_%'
               or h.tipo in ('figuras_encender', 'figuras_apagar',
                             'movimiento_activar', 'movimiento_desactivar'))
        order by h.id
    loop
        insert into cuna_private.ejecuciones_horario (horario_id, fecha_local, hora_local)
        values (v_horario.id, v_fecha, v_hora)
        on conflict do nothing;
        get diagnostics v_nuevo = row_count;
        continue when v_nuevo = 0;

        if v_horario.tipo like 'recordatorio\_%' then
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
        elsif cuna_private.crear_orden_horario(v_horario.dispositivo_id, v_horario.tipo, p_ahora) then
            v_ordenes := v_ordenes + 1;
        end if;
    end loop;

    return jsonb_build_object('ejecutados', v_ejecutados, 'sin_bebe', v_sin_bebe, 'ordenes', v_ordenes);
end;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function
    public.solicitar_orden(uuid, text, text, jsonb), public.tomar_orden_modulo(),
    public.confirmar_orden_modulo(uuid, boolean, jsonb, text), public.estado_de_modulo(text),
    public.guardar_limites(text, double precision, double precision, double precision, double precision),
    public.mis_limites(text), public.registrar_actividad_voz(uuid, text, text)
    from public, anon, authenticated, service_role;

grant execute on function
    public.solicitar_orden(uuid, text, text, jsonb), public.tomar_orden_modulo(),
    public.confirmar_orden_modulo(uuid, boolean, jsonb, text), public.estado_de_modulo(text),
    public.guardar_limites(text, double precision, double precision, double precision, double precision),
    public.mis_limites(text), public.registrar_actividad_voz(uuid, text, text)
    to authenticated;

commit;
