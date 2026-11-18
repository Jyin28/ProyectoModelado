begin;

-- Fase 7 (HU-17 y HU-18): kit de habitación. Monitoreo de puerta y movimiento
-- con órdenes y horarios, ingesta de eventos, fotografías privadas ligadas a
-- cada evento y almacén de fotos con acceso solo para los dueños.
-- Requiere 20261111000100 a 20261111000400 y 20261118000100 a 20261118000500.
-- Es un archivo local: no se aplica a cuna-inteligente-dev sin autorización.
-- No crea usuarios, cuentas de dispositivo ni datos. No guarda video ni envía
-- imágenes a Telegram: el aviso solo dice que se tomó una foto (CA-07.4, CA-18.4).

-- ------------------------------------------- reglas de órdenes por módulo
-- Tres funciones concentran qué comandos existen, cuáles puede pedir una
-- persona y a qué módulo pertenece cada uno. La tabla y solicitar_orden las
-- usan, así que un módulo nuevo solo las amplía.
create function cuna_private.comando_conocido(p_command text)
returns boolean
language sql immutable
set search_path = ''
as $$
    select p_command = any (array[
        'led_set', 'led_all', 'led_sequence', 'led_stop',
        'audio_play', 'audio_stop', 'motion_set',
        'mattress_arm', 'mattress_rearm', 'mattress_stop',
        'room_monitor_set'])
$$;

create function cuna_private.comando_solicitable(p_command text)
returns boolean
language sql immutable
set search_path = ''
as $$
    select p_command = any (array[
        'led_set', 'led_all', 'led_sequence', 'led_stop',
        'audio_play', 'audio_stop', 'motion_set',
        'mattress_arm', 'mattress_rearm', 'mattress_stop',
        'room_monitor_set'])
$$;

create function cuna_private.comando_de_modulo(p_command text, p_device_id text)
returns boolean
language sql immutable
set search_path = ''
as $$
    select coalesce(
        (p_command like 'led\_%' and p_device_id like 'cuna-figuras-%')
        or (p_command like 'audio\_%' and p_device_id like 'cuna-audio-%')
        or (p_command = 'motion_set' and p_device_id like 'cuna-movimiento-%')
        or (p_command like 'mattress\_%' and p_device_id like 'cuna-colchon-%')
        or (p_command = 'room_monitor_set' and p_device_id like 'cuna-habitacion-%'),
        false)
$$;

revoke all on function cuna_private.comando_conocido(text),
    cuna_private.comando_solicitable(text),
    cuna_private.comando_de_modulo(text, text)
    from public, anon, authenticated, service_role;

-- Las restricciones de ordenes_modulo no tienen nombre fijo: se localizan por
-- su definición y se reemplazan por otras que usan las funciones de arriba.
do $$
declare
    v_restriccion record;
begin
    for v_restriccion in
        select c.conname, pg_get_constraintdef(c.oid) as definicion
        from pg_constraint as c
        where c.conrelid = 'public.ordenes_modulo'::regclass and c.contype = 'c'
    loop
        if (v_restriccion.definicion like '%led_set%' and v_restriccion.definicion like '%mattress_stop%')
            or v_restriccion.definicion like '%cuna-colchon-%'
            or v_restriccion.definicion like '%[0-9]{2}%' then
            execute format('alter table public.ordenes_modulo drop constraint %I',
                v_restriccion.conname);
        end if;
    end loop;
end;
$$;

alter table public.ordenes_modulo
    add constraint ordenes_modulo_dispositivo_valido
        check (device_id ~ '^cuna-(figuras|audio|movimiento|colchon|habitacion|alimentacion)-[0-9]{2}$'),
    add constraint ordenes_modulo_comando_conocido
        check (cuna_private.comando_conocido(command)),
    add constraint ordenes_modulo_comando_del_modulo
        check (cuna_private.comando_de_modulo(command, device_id));

-- Parámetros por comando. Se amplía con room_monitor_set {sensor, enabled}.
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

-- Misma función de la fase 5 con las reglas centralizadas.
create or replace function public.solicitar_orden(
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
        or p_device_id !~ '^cuna-(figuras|audio|movimiento|colchon|habitacion|alimentacion)-[0-9]{2}$' then
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

    if p_command is null or not cuna_private.comando_solicitable(p_command) then
        raise exception 'comando_invalido' using errcode = '22023';
    end if;

    if not cuna_private.comando_de_modulo(p_command, p_device_id) then
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

-- Efectos de una confirmación real. Con room_monitor_set el estado guarda el
-- monitoreo de cada sensor (monitoreo_puerta, monitoreo_movimiento).
create or replace function cuna_private.aplicar_confirmacion(p_orden public.ordenes_modulo)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_estado jsonb;
begin
    v_estado := case p_orden.command
        when 'motion_set' then jsonb_build_object('monitoreo', (p_orden.params ->> 'enabled')::boolean)
        when 'room_monitor_set' then jsonb_build_object(
            'monitoreo_' || (p_orden.params ->> 'sensor'), (p_orden.params ->> 'enabled')::boolean)
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

-- ----------------------------------------------------------------- horarios
-- Cada sensor se activa y se desactiva con su propia lista de horas, lo que
-- define el rango de monitoreo (CA-17.1).
create or replace function cuna_private.crear_orden_horario(p_device_id text, p_tipo text, p_ahora timestamptz)
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
        ('movimiento_desactivar', 'cuna-movimiento-%', 'motion_set', '{"enabled": false}'::jsonb),
        ('habitacion_puerta_activar', 'cuna-habitacion-%', 'room_monitor_set',
            '{"sensor": "puerta", "enabled": true}'::jsonb),
        ('habitacion_puerta_desactivar', 'cuna-habitacion-%', 'room_monitor_set',
            '{"sensor": "puerta", "enabled": false}'::jsonb),
        ('habitacion_movimiento_activar', 'cuna-habitacion-%', 'room_monitor_set',
            '{"sensor": "movimiento", "enabled": true}'::jsonb),
        ('habitacion_movimiento_desactivar', 'cuna-habitacion-%', 'room_monitor_set',
            '{"sensor": "movimiento", "enabled": false}'::jsonb)
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
                             'movimiento_activar', 'movimiento_desactivar',
                             'habitacion_puerta_activar', 'habitacion_puerta_desactivar',
                             'habitacion_movimiento_activar', 'habitacion_movimiento_desactivar'))
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

-- ----------------------------------------------------------------- fotos
-- Una fila por evento de habitación (puerta o movimiento) recibido con el
-- monitoreo activo: una foto por acción, sin agrupar (CA-17.5, CA-18.3).
-- Nunca se borra ni se reescribe el vínculo con el evento ni con el bebé
-- original (DAT-01, CA-24.7). No hay video (CA-18.4).
create table public.fotos (
    event_id uuid primary key references public.eventos (event_id),
    device_id text not null check (device_id ~ '^cuna-habitacion-[0-9]{2}$'),
    bebe_id uuid not null,
    estado text not null default 'pendiente' check (estado in ('pendiente', 'guardada', 'fallida')),
    ruta text check (ruta is null or ruta ~
        '^cuna-habitacion-[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$'),
    motivo text check (motivo is null or motivo in ('camara_no_disponible', 'carga_fallida')),
    solicitada_en timestamptz not null check (isfinite(solicitada_en)),
    resuelta_en timestamptz check (resuelta_en is null or isfinite(resuelta_en)),
    check ((estado = 'guardada') = (ruta is not null)),
    check ((estado = 'fallida') = (motivo is not null)),
    check ((estado = 'pendiente') = (resuelta_en is null))
);

create index fotos_por_dispositivo on public.fotos (device_id, solicitada_en desc, event_id desc);

alter table public.fotos enable row level security;
revoke all on public.fotos from public, anon, authenticated, service_role;
grant select on public.fotos to authenticated;

create policy fotos_lectura_dueno on public.fotos
    for select to authenticated
    using (cuna_private.es_dueno_activo(device_id));

-- Almacén privado. Solo JPEG y PNG, hasta 5 MiB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-habitacion', 'fotos-habitacion', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Ruta <device_id>/<event_id>.<jpg|png>. Leer exige ser dueño activo del
-- dispositivo de la ruta; subir exige además que la foto de ese evento esté
-- pendiente o haya fallado (no se sobrescribe una foto guardada).
create function cuna_private.foto_ruta_autorizada(p_nombre text, p_subir boolean)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
    v_dispositivo text;
    v_evento uuid;
begin
    if p_nombre is null or p_nombre !~
        '^cuna-habitacion-[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$' then
        return false;
    end if;
    v_dispositivo := split_part(p_nombre, '/', 1);
    v_evento := substr(split_part(p_nombre, '/', 2), 1, 36)::uuid;

    if not cuna_private.es_dueno_activo(v_dispositivo) then
        return false;
    end if;
    if p_subir then
        return exists (
            select 1 from public.fotos as f
            where f.event_id = v_evento and f.device_id = v_dispositivo
              and f.estado in ('pendiente', 'fallida'));
    end if;
    return true;
end;
$$;

revoke all on function cuna_private.foto_ruta_autorizada(text, boolean)
    from public, anon, authenticated, service_role;
grant execute on function cuna_private.foto_ruta_autorizada(text, boolean) to authenticated;

create policy fotos_habitacion_lectura on storage.objects
    for select to authenticated
    using (bucket_id = 'fotos-habitacion' and cuna_private.foto_ruta_autorizada(name, false));

create policy fotos_habitacion_subida on storage.objects
    for insert to authenticated
    with check (bucket_id = 'fotos-habitacion' and cuna_private.foto_ruta_autorizada(name, true));
-- Sin políticas de update ni delete: una foto subida no se modifica ni se borra.

-- ---------------------------------------------------------- ingesta (Pico)
-- Eventos de la habitación: 'puerta' y 'movimiento_habitacion', sin datos.
-- Con el monitoreo de ese sensor apagado el evento se rechaza; sin estado
-- confirmado se acepta. Cada evento nuevo crea su aviso y su solicitud de foto.
create function public.ingestar_habitacion(
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
    v_apagado boolean;
    v_resultado text;
begin
    if p_device_id !~ '^cuna-habitacion-[0-9]{2}$' then
        return 'no_autorizado';
    end if;

    perform 1 from cuna_private.dispositivos as disp
    where disp.id = p_device_id and disp.token_sha256 = p_token_sha256 and disp.activo
    for share;

    if not found then
        return 'no_autorizado';
    end if;

    if p_tipo is null or p_tipo not in ('puerta', 'movimiento_habitacion')
        or coalesce(p_datos, 'null'::jsonb) <> '{}'::jsonb then
        return 'evento_invalido';
    end if;

    select (e.estado ->> case p_tipo when 'puerta' then 'monitoreo_puerta'
                                     else 'monitoreo_movimiento' end) = 'false'
    into v_apagado
    from cuna_private.estado_modulo as e where e.dispositivo_id = p_device_id;
    if coalesce(v_apagado, false) then
        return 'monitoreo_inactivo';
    end if;

    v_resultado := cuna_private.registrar_evento(
        p_event_id, p_device_id, p_tipo, p_ts, p_recibido_en,
        case p_tipo when 'puerta' then 'Se abrió la puerta de la habitación'
                    else 'Se detectó movimiento en la habitación' end,
        null, null, '{}'::jsonb, true);

    if v_resultado = 'creado' then
        insert into public.fotos (event_id, device_id, bebe_id, solicitada_en)
        select ev.event_id, ev.device_id, ev.bebe_id, p_recibido_en
        from public.eventos as ev where ev.event_id = p_event_id;
    end if;
    return v_resultado;
end;
$$;

-- ----------------------------------------------- fotos: registro desde la web
-- La persona que tiene el teléfono sube la imagen al almacén y luego llama a
-- registrar_foto. El servidor comprueba la ruta, que el objeto exista y que la
-- persona sea dueña. El evento foto_tomada es la única notificación: lleva solo
-- el texto fijo y el vínculo al evento de origen, nunca la imagen ni la ruta.
create function public.registrar_foto(p_event_id uuid, p_ruta text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_foto public.fotos%rowtype;
begin
    select f.* into v_foto from public.fotos as f where f.event_id = p_event_id for update;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    perform cuna_private.exigir_dueno(v_foto.device_id);

    if p_ruta is null or p_ruta !~ ('^' || v_foto.device_id || '/' || p_event_id::text || '\.(jpg|png)$') then
        raise exception 'foto_invalida' using errcode = '22023';
    end if;

    if v_foto.estado = 'guardada' then
        if v_foto.ruta = p_ruta then
            return jsonb_build_object('estado', 'guardada', 'resultado', 'duplicado');
        end if;
        raise exception 'foto_ya_resuelta' using errcode = '55000';
    end if;

    perform 1 from storage.objects as o
    where o.bucket_id = 'fotos-habitacion' and o.name = p_ruta;
    if not found then
        raise exception 'foto_no_subida' using errcode = '22023';
    end if;

    update public.fotos
    set estado = 'guardada', ruta = p_ruta, motivo = null, resuelta_en = clock_timestamp()
    where event_id = p_event_id;

    -- Id derivado del evento de origen: un reintento no duplica el aviso.
    perform cuna_private.registrar_evento(
        md5('foto:' || p_event_id::text)::uuid, v_foto.device_id, 'foto_tomada',
        clock_timestamp(), clock_timestamp(), 'Se tomó una fotografía', null, null,
        jsonb_build_object('evento_id', p_event_id), true);

    return jsonb_build_object('estado', 'guardada', 'resultado', 'creado');
end;
$$;

create function public.marcar_foto_fallida(p_event_id uuid, p_motivo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_foto public.fotos%rowtype;
begin
    select f.* into v_foto from public.fotos as f where f.event_id = p_event_id for update;
    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    perform cuna_private.exigir_dueno(v_foto.device_id);

    if p_motivo is null or p_motivo not in ('camara_no_disponible', 'carga_fallida') then
        raise exception 'motivo_invalido' using errcode = '22023';
    end if;
    if v_foto.estado = 'guardada' then
        raise exception 'foto_ya_resuelta' using errcode = '55000';
    end if;

    update public.fotos
    set estado = 'fallida', motivo = p_motivo, resuelta_en = clock_timestamp()
    where event_id = p_event_id;

    return jsonb_build_object('estado', 'fallida', 'motivo', p_motivo);
end;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function
    public.ingestar_habitacion(uuid, text, text, text, timestamptz, timestamptz, jsonb),
    public.registrar_foto(uuid, text),
    public.marcar_foto_fallida(uuid, text)
    from public, anon, authenticated, service_role;

grant execute on function
    public.registrar_foto(uuid, text),
    public.marcar_foto_fallida(uuid, text)
    to authenticated;

grant execute on function
    public.ingestar_habitacion(uuid, text, text, text, timestamptz, timestamptz, jsonb)
    to service_role;

commit;
