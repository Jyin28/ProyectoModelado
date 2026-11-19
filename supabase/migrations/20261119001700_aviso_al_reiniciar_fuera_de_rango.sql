-- =============================================================================
-- Aviso por Telegram si la cuna se enciende ya fuera de rango (HU-07, CA-07.5).
--
-- Problema: un episodio fuera de rango solo avisa al abrirse. Si la cuna se
-- apagaba (o perdía la conexión) con el ambiente fuera de rango, el episodio
-- quedaba abierto para siempre. Al volver a encenderla, la lectura seguía fuera
-- de rango, `actualizar_episodio` veía un episodio abierto y no abría otro: no
-- salía ningún mensaje de Telegram.
--
-- Cambio: es la misma `evaluar_limites` de 20261118000400 con un paso previo.
-- Si la lectura nueva es la más reciente del módulo y la anterior quedó a más de
-- 60 s (lo normal es una cada 2 s), se entiende que el módulo estuvo apagado o
-- sin conexión: el episodio abierto de cada variable que SIGUE fuera de rango se
-- cierra en la hora de la última lectura anterior al corte, y esta lectura abre
-- uno nuevo y avisa. Sigue habiendo un aviso por episodio: mientras las lecturas
-- llegan seguidas no se repite, y una lectura atrasada (no es la más reciente)
-- nunca reinicia nada. Si la lectura nueva ya está dentro de rango no cambia
-- nada: el cierre normal la cierra con su propia hora.
-- =============================================================================
begin;

create or replace function cuna_private.evaluar_limites(
    p_device_id text, p_ts timestamptz, p_temperatura double precision, p_humedad double precision)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_lim cuna_private.limites_ambiente%rowtype;
    v_anterior timestamptz;
    v_reinicio boolean := false;
    v_temp_fuera boolean;
    v_hum_fuera boolean;
begin
    select l.* into v_lim from cuna_private.limites_ambiente as l where l.dispositivo_id = p_device_id;
    if not found then
        return;
    end if;

    v_temp_fuera := p_temperatura < v_lim.temp_min or p_temperatura > v_lim.temp_max;
    v_hum_fuera := p_humedad < v_lim.hum_min or p_humedad > v_lim.hum_max;

    -- ¿El módulo estuvo apagado o sin conexión justo antes de esta lectura?
    if (v_temp_fuera or v_hum_fuera) and not exists (
        select 1 from public.lecturas_ambiente as l
        where l.device_id = p_device_id and l.ts > p_ts
    ) then
        select max(l.ts) into v_anterior
        from public.lecturas_ambiente as l
        where l.device_id = p_device_id and l.ts < p_ts;
        v_reinicio := v_anterior is not null and p_ts - v_anterior > interval '60 seconds';
    end if;

    if v_reinicio then
        update cuna_private.episodios as ep
        set cerrado_en = greatest(v_anterior, ep.abierto_desde)
        where ep.dispositivo_id = p_device_id and ep.cerrado_en is null
          and ((ep.variable = 'temperatura' and v_temp_fuera)
               or (ep.variable = 'humedad' and v_hum_fuera));
    end if;

    if cuna_private.actualizar_episodio(p_device_id, 'temperatura', v_temp_fuera, p_ts) then
        perform cuna_private.registrar_evento(
            gen_random_uuid(), p_device_id, 'ambiente_fuera_rango', p_ts, clock_timestamp(),
            'Temperatura fuera de rango', p_temperatura, '°C',
            jsonb_build_object('variable', 'temperatura',
                'minimo', v_lim.temp_min, 'maximo', v_lim.temp_max), true);
    end if;

    if cuna_private.actualizar_episodio(p_device_id, 'humedad', v_hum_fuera, p_ts) then
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

commit;
