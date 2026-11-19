-- Horario «Encender figuras» con la velocidad elegida (CA-13.1 y CA-13.2).
--
-- Antes, el horario figuras_encender siempre creaba led_all {on: true}: las seis
-- figuras quedaban fijas y se ignoraba la secuencia y el intervalo que el
-- cuidador ya había configurado. Ahora el horario arranca la ÚLTIMA secuencia
-- que la Pico confirmó para ese módulo (led_sequence con su name y step_s, ya
-- validados: step_s de 2 a 3600 s). Si todavía no hay ninguna confirmada,
-- conserva el comportamiento anterior (led_all {on: true}).
--
-- Solo cambia la rama de figuras_encender; el resto de los tipos queda igual que
-- en 20261118000600_habitacion.sql. create or replace conserva los permisos
-- (la función no es invocable por los roles de la API).

create or replace function cuna_private.crear_orden_horario(p_device_id text, p_tipo text, p_ahora timestamptz)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
    v_comando text;
    v_params jsonb;
    v_secuencia jsonb;
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

    if p_tipo = 'figuras_encender' then
        select o.params into v_secuencia
        from public.ordenes_modulo as o
        where o.device_id = p_device_id
          and o.command = 'led_sequence'
          and o.estado = 'confirmado'
        order by o.confirmado_en desc, o.command_id desc
        limit 1;
        if v_secuencia is not null then
            v_comando := 'led_sequence';
            v_params := v_secuencia;
        end if;
    end if;

    insert into public.ordenes_modulo
        (command_id, device_id, command, params, origen, solicitante_id, creado_en, vence_en)
    values (gen_random_uuid(), p_device_id, v_comando, v_params, 'horario', null,
        clock_timestamp(), clock_timestamp() + interval '15 seconds');
    return true;
end;
$$;
