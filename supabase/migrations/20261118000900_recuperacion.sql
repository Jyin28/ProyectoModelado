-- Fase 11 · Recuperación tras interrupciones (HU-28, CA-28.3, CA-28.4).
--
-- 1. El módulo informa su estado real al conectarse o reconectarse. Hasta
--    ahora, tras reiniciar la Pico el servidor seguía mostrando el último
--    estado confirmado (por ejemplo «monitoreo activo») aunque la Pico
--    arrancara todo apagado, y seguía aceptando eventos de un monitoreo que ya
--    no existía.
-- 2. Una lectura de ambiente que llega fuera de orden ya no cierra antes de
--    tiempo un episodio fuera de rango.
-- 3. Los avisos pendientes se entregan en un orden estable.

begin;

-- ---------------------------------------------- 1. estado informado por la Pico
-- Claves que una Pico puede informar y el módulo al que corresponde cada una.
-- Solo se aceptan estas claves y estos tipos: nada más llega a estado_modulo.
create function public.reportar_estado_modulo(p_estado jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_producto text := cuna_private.producto_de_sesion();
    v_clave text;
    v_valor jsonb;
    v_patron text;
    v_dispositivo text;
    v_nuevo jsonb;
    v_actualizados integer := 0;
    v_ahora timestamptz := clock_timestamp();
begin
    if v_producto is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    if p_estado is null or jsonb_typeof(p_estado) <> 'object'
        or (select count(*) from jsonb_object_keys(p_estado)) > 5 then
        raise exception 'estado_invalido' using errcode = '22023';
    end if;

    for v_clave, v_valor in select key, value from jsonb_each(p_estado) order by key loop
        if not (
            (v_clave in ('monitoreo', 'monitoreo_puerta', 'monitoreo_movimiento')
                and jsonb_typeof(v_valor) = 'boolean')
            or (v_clave = 'secuencia'
                and (jsonb_typeof(v_valor) = 'null'
                     or (jsonb_typeof(v_valor) = 'string' and (v_valor #>> '{}') ~ '^[a-z_]{1,40}$')))
            or (v_clave = 'colchon' and v_valor in ('"activo"', '"alarma"', '"detenido"'))
        ) then
            raise exception 'estado_invalido' using errcode = '22023';
        end if;
    end loop;

    for v_clave, v_valor in select key, value from jsonb_each(p_estado) order by key loop
        v_patron := case v_clave
            when 'monitoreo' then '^cuna-movimiento-[0-9]{2}$'
            when 'monitoreo_puerta' then '^cuna-habitacion-[0-9]{2}$'
            when 'monitoreo_movimiento' then '^cuna-habitacion-[0-9]{2}$'
            when 'secuencia' then '^cuna-figuras-[0-9]{2}$'
            else '^cuna-colchon-[0-9]{2}$'
        end;

        for v_dispositivo in
            select disp.id from cuna_private.dispositivos as disp
            where coalesce(disp.producto_id, disp.id) = v_producto
              and disp.activo and disp.id ~ v_patron
            order by disp.id
        loop
            if v_clave = 'colchon' then
                -- Un colchón detenido informado al conectar se muestra como
                -- «detenido»; si ya figuraba detenido (con su motivo real) no se
                -- toca. Un colchón activo no se cambia: lo fija su propio evento.
                -- colchon_ts no cambia: un evento de parada anterior que llegue
                -- después sigue pudiendo precisar el motivo.
                if v_valor <> '"detenido"' then
                    continue;
                end if;
                v_nuevo := jsonb_build_object('colchon', 'detenido', 'motivo', 'reinicio');
                insert into cuna_private.estado_modulo (dispositivo_id, estado, actualizado_en)
                values (v_dispositivo, v_nuevo, v_ahora)
                on conflict (dispositivo_id) do update
                    set estado = cuna_private.estado_modulo.estado || excluded.estado,
                        actualizado_en = excluded.actualizado_en
                    where coalesce(cuna_private.estado_modulo.estado ->> 'colchon', '') <> 'detenido';
            else
                v_nuevo := jsonb_build_object(v_clave, v_valor);
                insert into cuna_private.estado_modulo (dispositivo_id, estado, actualizado_en)
                values (v_dispositivo, v_nuevo, v_ahora)
                on conflict (dispositivo_id) do update
                    set estado = cuna_private.estado_modulo.estado || excluded.estado,
                        actualizado_en = excluded.actualizado_en;
            end if;
            v_actualizados := v_actualizados + 1;
        end loop;
    end loop;

    return jsonb_build_object('actualizados', v_actualizados);
end;
$$;

revoke all on function public.reportar_estado_modulo(jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.reportar_estado_modulo(jsonb) to authenticated;

-- ------------------------------------------ 2. lecturas fuera de orden
-- Una lectura no puede abrir ni cerrar un episodio si es anterior (o igual) a
-- lo último que ya se sabe de esa variable: sin esto, una lectura atrasada
-- dentro de rango cerraba un episodio abierto con una hora anterior a su
-- apertura, y una atrasada fuera de rango abría uno que ya estaba cerrado.
create or replace function cuna_private.actualizar_episodio(
    p_device_id text, p_variable text, p_fuera boolean, p_ts timestamptz)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    v_abierto uuid;
    v_ultimo timestamptz;
begin
    select max(greatest(ep.abierto_desde, coalesce(ep.cerrado_en, ep.abierto_desde)))
    into v_ultimo
    from cuna_private.episodios as ep
    where ep.dispositivo_id = p_device_id and ep.variable = p_variable;

    if v_ultimo is not null and p_ts <= v_ultimo then
        return false;
    end if;

    if p_fuera then
        insert into cuna_private.episodios (dispositivo_id, variable, abierto_desde)
        values (p_device_id, p_variable, p_ts)
        on conflict (dispositivo_id, variable) where cerrado_en is null do nothing
        returning id into v_abierto;
        return v_abierto is not null;
    end if;

    update cuna_private.episodios
    set cerrado_en = p_ts
    where dispositivo_id = p_device_id and variable = p_variable and cerrado_en is null;
    return false;
end;
$$;

-- ------------------------------------------- 3. orden estable de los avisos
-- Dos avisos del mismo evento comparten marca de tiempo. El desempate era un
-- UUID aleatorio, así que el orden de envío cambiaba entre ejecuciones. Ahora
-- se entrega en el orden en que se crearon los destinatarios.
create or replace function public.avisos_pendientes(p_limite integer default 20)
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
        order by aviso.proximo_intento_en, aviso.creado_en, dest.creado_en, dest.id, aviso.id
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
    ) order by ev.ts, ev.event_id, dest.creado_en, dest.id, r.id), '[]'::jsonb)
    into v_resultado
    from reservados as r
    join public.eventos as ev on ev.event_id = r.event_id
    join cuna_private.destinatarios_telegram as dest on dest.id = r.destinatario_id;

    return v_resultado;
end;
$$;

commit;
