-- =============================================================================
-- ingestar_lote: ingesta por lotes de la Pico del colchon (formato
-- {device_id, events:[{event_id, type, at, data}]}). Esta funcion ya existia en
-- cuna-inteligente-dev sin estar en ninguna migracion; aqui se versiona tal como
-- estaba, para que una base nueva pueda recibir los datos del colchon.
-- Acepta eventos 'ambiente' (lecturas_ambiente) y los cuatro del colchon
-- (eventos_colchon). Solo la llama la Edge Function `ingesta` (service_role).
-- =============================================================================
begin;

create or replace function public.ingestar_lote(
    p_device_id text,
    p_token_sha256 text,
    p_recibido_en timestamptz,
    p_events jsonb
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    e jsonb;
    v_event_id uuid;
    v_tipo text;
    v_ts timestamptz;
    v_datos jsonb;
    v_bebe uuid;
    v_existente public.eventos_colchon%rowtype;
    v_lectura public.lecturas_ambiente%rowtype;
    v_estado text;
    v_resultados jsonb := '[]'::jsonb;
begin
    if jsonb_typeof(p_events) <> 'array'
       or jsonb_array_length(p_events) < 1
       or jsonb_array_length(p_events) > 5 then
        raise exception 'Lote inválido';
    end if;

    perform 1
    from cuna_private.dispositivos d
    where d.id = p_device_id
      and d.token_sha256 = p_token_sha256
      and d.activo
    for share;

    if not found then
        return jsonb_build_object('estado', 'no_autorizado');
    end if;

    -- Primera pasada: validar asignación e idempotencia de TODO el lote.
    -- Así no se insertan eventos parcialmente si uno no es válido.
    for e in select value from jsonb_array_elements(p_events)
    loop
        v_event_id := (e->>'event_id')::uuid;
        v_tipo := e->>'type';
        v_ts := (e->>'at')::timestamptz;
        v_datos := coalesce(e->'data', '{}'::jsonb);

        select a.bebe_id into v_bebe
        from cuna_private.asignaciones_bebe a
        where a.dispositivo_id = p_device_id
          and a.desde <= v_ts
        order by a.desde desc
        limit 1;

        if v_bebe is null then
            return jsonb_build_object('estado', 'sin_asignacion', 'event_id', v_event_id);
        end if;

        if v_tipo = 'ambiente' then
            select l.* into v_lectura
            from public.lecturas_ambiente l
            where l.event_id = v_event_id;

            if found then
                if v_lectura.device_id = p_device_id
                   and v_lectura.ts = v_ts
                   and v_lectura.temperatura_c = (v_datos->>'temperatura_c')::double precision
                   and v_lectura.humedad_pct = (v_datos->>'humedad_pct')::double precision then
                    continue;
                else
                    return jsonb_build_object('estado', 'id_reutilizado', 'event_id', v_event_id);
                end if;
            end if;

            if jsonb_typeof(v_datos) <> 'object'
               or jsonb_typeof(v_datos->'temperatura_c') <> 'number'
               or jsonb_typeof(v_datos->'humedad_pct') <> 'number' then
                raise exception 'Datos ambientales inválidos';
            end if;
            if (v_datos->>'humedad_pct')::double precision < 0
               or (v_datos->>'humedad_pct')::double precision > 100 then
                raise exception 'Humedad fuera de rango';
            end if;
        elsif v_tipo in (
            'monitoring_started', 'alarm_started',
            'alarm_stopped', 'monitoring_stopped'
        ) then
            select c.* into v_existente
            from public.eventos_colchon c
            where c.event_id = v_event_id;

            if found then
                if v_existente.device_id = p_device_id
                   and v_existente.ts = v_ts
                   and v_existente.tipo = v_tipo
                   and v_existente.datos = v_datos then
                    continue;
                else
                    return jsonb_build_object('estado', 'id_reutilizado', 'event_id', v_event_id);
                end if;
            end if;
        else
            raise exception 'Tipo de evento no admitido';
        end if;
    end loop;

    -- Segunda pasada: insertar sólo eventos nuevos. Duplicados se informan
    -- como confirmados y la Edge Function responderá HTTP 200.
    for e in select value from jsonb_array_elements(p_events)
    loop
        v_event_id := (e->>'event_id')::uuid;
        v_tipo := e->>'type';
        v_ts := (e->>'at')::timestamptz;
        v_datos := coalesce(e->'data', '{}'::jsonb);

        if v_tipo = 'ambiente' then
            select l.* into v_lectura
            from public.lecturas_ambiente l
            where l.event_id = v_event_id;

            if found then
                v_estado := 'duplicado';
            else
                insert into public.lecturas_ambiente (
                    event_id, device_id, bebe_id, ts, recibido_en,
                    temperatura_c, humedad_pct
                )
                select v_event_id, p_device_id, a.bebe_id, v_ts, p_recibido_en,
                       (v_datos->>'temperatura_c')::double precision,
                       (v_datos->>'humedad_pct')::double precision
                from cuna_private.asignaciones_bebe a
                where a.dispositivo_id = p_device_id
                  and a.desde <= v_ts
                order by a.desde desc
                limit 1;
                v_estado := 'creado';
            end if;
        else
            select c.* into v_existente
            from public.eventos_colchon c
            where c.event_id = v_event_id;

            if found then
                v_estado := 'duplicado';
            else
                insert into public.eventos_colchon (
                    event_id, device_id, bebe_id, ts, recibido_en, tipo, datos
                )
                select v_event_id, p_device_id, a.bebe_id, v_ts,
                       p_recibido_en, v_tipo, v_datos
                from cuna_private.asignaciones_bebe a
                where a.dispositivo_id = p_device_id
                  and a.desde <= v_ts
                order by a.desde desc
                limit 1;
                v_estado := 'creado';
            end if;
        end if;

        v_resultados := v_resultados || jsonb_build_array(
            jsonb_build_object('event_id', v_event_id, 'estado', v_estado)
        );
    end loop;

    return jsonb_build_object('estado', 'ok', 'resultados', v_resultados);
end;
$$;

revoke all on function public.ingestar_lote(text, text, timestamptz, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.ingestar_lote(text, text, timestamptz, jsonb)
    to service_role;

commit;
