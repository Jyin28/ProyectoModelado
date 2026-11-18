-- Fase 10 · Historial unificado por bebé (HU-24 a HU-27).
--
-- Una sola consulta de lectura une lo que hoy vive en tres tablas:
--   * public.eventos            (colchón, habitación, alimentación, avisos...)
--   * public.lecturas_ambiente  (una lectura = dos registros: temperatura y humedad)
--   * public.eventos_movimiento (solo los que aún no estén en eventos)
-- El filtro es por bebe_id, no por módulo: así los historiales de bebés distintos
-- no se mezclan y, tras reasignar un módulo, los registros anteriores conservan
-- su bebé original (CA-25.2, CA-34.4). Nada se borra ni se modifica.
--
-- El intervalo es [desde, hasta). La web y la exportación usan esta misma
-- función, de modo que los gráficos, la lista y el Excel salen del mismo dato.

create function public.historial_bebe(
    p_bebe_id uuid,
    p_desde timestamptz,
    p_hasta timestamptz
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
    v_usuario uuid := (select auth.uid());
    v_tope constant integer := 5000;
    v_ahora timestamptz := clock_timestamp();
    v_registros jsonb;
    v_total integer;
begin
    if v_usuario is null or p_bebe_id is null
        or not cuna_private.puede_ver_bebe(p_bebe_id, v_usuario) then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    if p_desde is null or p_hasta is null
        or not isfinite(p_desde) or not isfinite(p_hasta)
        or p_desde >= p_hasta or p_hasta - p_desde > interval '31 days' then
        raise exception 'intervalo_invalido' using errcode = '22023';
    end if;

    with base as (
        select ev.event_id::text as registro_id, ev.ts, ev.tipo, ev.device_id,
               ev.descripcion, ev.valor, ev.unidad, ev.datos, ev.event_id, 0 as sub
        from public.eventos as ev
        where ev.bebe_id = p_bebe_id and ev.ts >= p_desde and ev.ts < p_hasta
        union all
        select lectura.event_id::text || ':temperatura', lectura.ts, 'temperatura_ambiente',
               lectura.device_id, 'Temperatura ambiente', lectura.temperatura_c, '°C',
               '{}'::jsonb, null::uuid, 1
        from public.lecturas_ambiente as lectura
        where lectura.bebe_id = p_bebe_id and lectura.ts >= p_desde and lectura.ts < p_hasta
        union all
        select lectura.event_id::text || ':humedad', lectura.ts, 'humedad_ambiente',
               lectura.device_id, 'Humedad ambiente', lectura.humedad_pct, '% HR',
               '{}'::jsonb, null::uuid, 2
        from public.lecturas_ambiente as lectura
        where lectura.bebe_id = p_bebe_id and lectura.ts >= p_desde and lectura.ts < p_hasta
        union all
        -- Movimientos anteriores a la tabla unificada: solo si no están en eventos.
        select mov.event_id::text, mov.ts, 'movimiento', mov.device_id,
               'Movimiento detectado', null::double precision, null::text,
               '{}'::jsonb, mov.event_id, 0
        from public.eventos_movimiento as mov
        where mov.bebe_id = p_bebe_id and mov.ts >= p_desde and mov.ts < p_hasta
          and not exists (select 1 from public.eventos as ev where ev.event_id = mov.event_id)
    ),
    ordenado as (
        select b.*, count(*) over () as total
        from base as b
        order by b.ts, b.sub, b.registro_id
        limit v_tope
    )
    select coalesce(jsonb_agg(jsonb_build_object(
            'registro_id', o.registro_id,
            'ts', o.ts,
            'tipo', o.tipo,
            'bebe_id', p_bebe_id,
            'device_id', o.device_id,
            'descripcion', o.descripcion,
            -- En una toma completa el valor sale de la toma, para que refleje
            -- las correcciones auditadas y coincida con cantidad_g.
            'valor', case when toma.id is not null and o.tipo = 'toma_completa'
                          then toma.ingerido_g else o.valor end,
            'unidad', o.unidad,
            'toma', case when toma.id is null then null else jsonb_build_object(
                'peso_inicial_g', toma.peso_inicial_g,
                'peso_final_g', toma.peso_final_g,
                'cantidad_g', toma.ingerido_g,
                'duracion_s', cuna_private.duracion_activa_s(toma.id, v_ahora)) end,
            'foto', case when foto.event_id is null
                              or not cuna_private.es_dueno_activo(o.device_id)
                         then null else jsonb_build_object(
                'estado', foto.estado, 'ruta', foto.ruta, 'motivo', foto.motivo) end
        ) order by o.ts, o.sub, o.registro_id), '[]'::jsonb),
        coalesce(max(o.total), 0)
    into v_registros, v_total
    from ordenado as o
    left join public.tomas as toma
        on o.datos ->> 'toma_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and toma.id = (o.datos ->> 'toma_id')::uuid
       and toma.bebe_id = p_bebe_id
    left join public.fotos as foto
        on foto.event_id = o.event_id and foto.bebe_id = p_bebe_id;

    return jsonb_build_object(
        'ahora', v_ahora,
        'desde', p_desde,
        'hasta', p_hasta,
        'truncado', v_total > v_tope,
        'registros', v_registros);
end;
$$;

revoke all on function public.historial_bebe(uuid, timestamptz, timestamptz)
    from public, anon, authenticated, service_role;
grant execute on function public.historial_bebe(uuid, timestamptz, timestamptz)
    to authenticated;
