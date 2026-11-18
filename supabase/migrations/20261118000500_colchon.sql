begin;

-- Fase 6 (HU-14 a HU-16): configuración del colchón, eventos de alarma y
-- parada, y estado visible. Requiere 20261111000100 a 20261111000400 y
-- 20261118000100 a 20261118000400. Las órdenes mattress_* ya existen en
-- ordenes_modulo (fase 5). No crea usuarios, cuentas de dispositivo ni datos.
--
-- El peso se mide y se procesa solo en la Pico: esta migración no tiene tabla
-- de lecturas de peso (CA-14.4). Solo llegan tres eventos de estado.

-- ------------------------------------------------------------ configuración
create table cuna_private.config_colchon (
    dispositivo_id text primary key references cuna_private.dispositivos(id)
        check (dispositivo_id ~ '^cuna-colchon-[0-9]{2}$'),
    duracion_s integer not null check (duracion_s > 0 and duracion_s <= 86400),
    tolerancia_pct double precision not null check (tolerancia_pct > 0 and tolerancia_pct < 100),
    alarma_s integer not null check (alarma_s > 0 and alarma_s <= 60),
    actualizado_en timestamptz not null default now()
);

revoke all on cuna_private.config_colchon from public, anon, authenticated, service_role;

-- Los valores llegan como double precision para poder rechazar con 22023 los
-- fraccionarios, NaN e infinitos antes de convertir a entero.
create function public.guardar_config_colchon(
    p_device_id text,
    p_duracion_s double precision,
    p_tolerancia_pct double precision,
    p_alarma_s double precision
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.exigir_dueno(p_device_id);

    -- Una comparación con NaN no es verdadera: queda rechazado. Un rechazo no
    -- toca la configuración previa.
    if p_device_id !~ '^cuna-colchon-[0-9]{2}$'
        or p_duracion_s is null or p_tolerancia_pct is null or p_alarma_s is null
        or not (p_duracion_s >= 1 and p_duracion_s <= 86400 and p_duracion_s = trunc(p_duracion_s))
        or not (p_tolerancia_pct > 0 and p_tolerancia_pct < 100)
        or not (p_alarma_s >= 1 and p_alarma_s <= 60 and p_alarma_s = trunc(p_alarma_s)) then
        raise exception 'config_colchon_invalida' using errcode = '22023';
    end if;

    insert into cuna_private.config_colchon
        (dispositivo_id, duracion_s, tolerancia_pct, alarma_s, actualizado_en)
    values (p_device_id, p_duracion_s::integer, p_tolerancia_pct, p_alarma_s::integer, now())
    on conflict (dispositivo_id) do update
        set duracion_s = excluded.duracion_s, tolerancia_pct = excluded.tolerancia_pct,
            alarma_s = excluded.alarma_s, actualizado_en = excluded.actualizado_en;

    return public.mi_config_colchon(p_device_id);
end;
$$;

create function public.mi_config_colchon(p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    v_conf cuna_private.config_colchon%rowtype;
begin
    perform cuna_private.exigir_dueno(p_device_id);
    select c.* into v_conf from cuna_private.config_colchon as c where c.dispositivo_id = p_device_id;
    if not found then
        return null;
    end if;
    return jsonb_build_object('duracion_s', v_conf.duracion_s,
        'tolerancia_pct', v_conf.tolerancia_pct, 'alarma_s', v_conf.alarma_s);
end;
$$;

-- ------------------------------------------------------------------ eventos
-- Forma exacta de los datos de cada evento. Cualquier clave de más o un valor
-- fuera de rango lo invalida.
create function cuna_private.datos_colchon_validos(p_tipo text, p_datos jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
    v_claves text[];
    v_n numeric;
begin
    if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
        return false;
    end if;
    select coalesce(array_agg(k order by k), '{}') into v_claves from jsonb_object_keys(p_datos) as k;

    if p_tipo = 'colchon_armado' then
        if v_claves <> array['alarma_s', 'duracion_s', 'referencia_g', 'tolerancia_pct'] then
            return false;
        end if;
        v_n := cuna_private.numero_json(p_datos -> 'referencia_g');
        if v_n is null or v_n <= 0 or v_n > 100000 then return false; end if;
        v_n := cuna_private.numero_json(p_datos -> 'duracion_s');
        if v_n is null or v_n <= 0 or v_n > 86400 then return false; end if;
        v_n := cuna_private.numero_json(p_datos -> 'tolerancia_pct');
        if v_n is null or v_n <= 0 or v_n >= 100 then return false; end if;
        v_n := cuna_private.numero_json(p_datos -> 'alarma_s');
        return coalesce(v_n > 0 and v_n <= 60, false);
    elsif p_tipo = 'alarma_colchon' then
        if v_claves <> array['referencia_g', 'ultimo_peso_g'] then
            return false;
        end if;
        v_n := cuna_private.numero_json(p_datos -> 'referencia_g');
        if v_n is null or v_n <= 0 or v_n > 100000 then return false; end if;
        v_n := cuna_private.numero_json(p_datos -> 'ultimo_peso_g');
        return coalesce(v_n between -100000 and 100000, false);
    elsif p_tipo = 'colchon_detenido' then
        return coalesce(v_claves = array['motivo']
            and jsonb_typeof(p_datos -> 'motivo') = 'string'
            and (p_datos ->> 'motivo') in ('app', 'boton', 'temporizador', 'duracion', 'wifi'), false);
    end if;
    return false;
end;
$$;

-- Estado visible: lo último que la Pico informó. Un evento con hora anterior
-- al ya guardado no lo cambia.
create function cuna_private.fijar_estado_colchon(
    p_device_id text, p_tipo text, p_datos jsonb, p_ts timestamptz)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_nuevo jsonb;
begin
    v_nuevo := case p_tipo
        when 'colchon_armado' then jsonb_build_object(
            'colchon', 'activo', 'referencia_g', p_datos -> 'referencia_g',
            'duracion_s', p_datos -> 'duracion_s', 'tolerancia_pct', p_datos -> 'tolerancia_pct',
            'alarma_s', p_datos -> 'alarma_s', 'motivo', null)
        when 'alarma_colchon' then jsonb_build_object(
            'colchon', 'alarma', 'referencia_g', p_datos -> 'referencia_g', 'motivo', null)
        else jsonb_build_object('colchon', 'detenido', 'motivo', p_datos -> 'motivo')
    end || jsonb_build_object('colchon_ts', p_ts);

    insert into cuna_private.estado_modulo (dispositivo_id, estado, actualizado_en)
    values (p_device_id, v_nuevo, p_ts)
    on conflict (dispositivo_id) do update
        set estado = cuna_private.estado_modulo.estado || excluded.estado,
            actualizado_en = excluded.actualizado_en
        where coalesce((cuna_private.estado_modulo.estado ->> 'colchon_ts')::timestamptz,
                       '-infinity'::timestamptz) <= p_ts;
end;
$$;

create function public.ingestar_colchon(
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
    v_descripcion text;
    v_resultado text;
begin
    if p_device_id !~ '^cuna-colchon-[0-9]{2}$' then
        return 'no_autorizado';
    end if;

    perform 1 from cuna_private.dispositivos as disp
    where disp.id = p_device_id and disp.token_sha256 = p_token_sha256 and disp.activo
    for share;

    if not found then
        return 'no_autorizado';
    end if;

    if not cuna_private.datos_colchon_validos(p_tipo, p_datos) then
        return 'evento_invalido';
    end if;

    v_descripcion := case p_tipo
        when 'colchon_armado' then 'Monitoreo del colchón activado'
        when 'alarma_colchon' then 'Alarma del colchón: el peso bajó más que la tolerancia'
        else 'Monitoreo del colchón detenido ' || case p_datos ->> 'motivo'
            when 'app' then 'desde la app'
            when 'boton' then 'con el botón'
            when 'temporizador' then 'al terminar el tiempo de la alarma'
            when 'duracion' then 'al terminar la duración'
            else 'por pérdida de WiFi'
        end
    end;

    -- Aviso por Telegram solo en la alarma y en la parada.
    v_resultado := cuna_private.registrar_evento(
        p_event_id, p_device_id, p_tipo, p_ts, p_recibido_en,
        v_descripcion, null, null, p_datos, p_tipo in ('alarma_colchon', 'colchon_detenido'));

    if v_resultado = 'creado' then
        perform cuna_private.fijar_estado_colchon(p_device_id, p_tipo, p_datos, p_ts);
    end if;
    return v_resultado;
end;
$$;

-- ----------------------------------------------------------------- permisos
revoke all on function
    cuna_private.datos_colchon_validos(text, jsonb),
    cuna_private.fijar_estado_colchon(text, text, jsonb, timestamptz)
    from public, anon, authenticated, service_role;

revoke all on function
    public.guardar_config_colchon(text, double precision, double precision, double precision),
    public.mi_config_colchon(text),
    public.ingestar_colchon(uuid, text, text, text, timestamptz, timestamptz, jsonb)
    from public, anon, authenticated, service_role;

grant execute on function
    public.guardar_config_colchon(text, double precision, double precision, double precision),
    public.mi_config_colchon(text)
    to authenticated;

grant execute on function
    public.ingestar_colchon(uuid, text, text, text, timestamptz, timestamptz, jsonb)
    to service_role;

commit;
