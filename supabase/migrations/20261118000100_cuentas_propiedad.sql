begin;

-- Fase 3 (HU-01 a HU-05): bebés, asociación de módulos, dueños compartidos,
-- invitaciones y reasignación con vigencia temporal.
-- Requiere la migración 20261111000100 (ingestar_ambiente y esquema cuna_private).
-- No depende de las migraciones de lámpara ni de movimiento.
--
-- Todo el acceso pasa por RPC con security definer. Ningún rol de API recibe
-- permisos de escritura directa ni de borrado sobre las tablas nuevas.

-- ---------------------------------------------------------------- bebés
alter table cuna_private.bebes
    add column fecha_nacimiento date,
    add column creado_por uuid references auth.users(id) on delete set null;

-- Quién puede gestionar un bebé sin tener todavía un módulo asignado.
create table cuna_private.tutores_bebe (
    bebe_id uuid not null references cuna_private.bebes(id),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    primary key (bebe_id, usuario_id)
);

-- ------------------------------------------------------------ dispositivos
-- tipo: producto al que pertenece el módulo lógico. producto_id agrupa los
-- módulos lógicos de un mismo producto físico (la cuna tiene ambiente,
-- movimiento y lámpara). Una cuna por bebé significa un producto_id por bebé.
alter table cuna_private.dispositivos
    add column tipo text not null default 'cuna'
        check (tipo in ('cuna', 'figuras', 'colchon', 'habitacion', 'juego', 'alimentacion')),
    add column producto_id text
        check (producto_id is null or producto_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
    -- SHA-256 de un código de reclamo de un solo uso, entregado con el producto.
    add column codigo_reclamo_sha256 text
        check (codigo_reclamo_sha256 is null or codigo_reclamo_sha256 ~ '^[0-9a-f]{64}$');

update cuna_private.dispositivos
set producto_id = 'cuna-' || substring(id from '[0-9]{2}$')
where id ~ '^cuna-(ambiente|movimiento|lampara)-[0-9]{2}$';

-- ------------------------------------------------------------ invitaciones
create table cuna_private.invitaciones_dueno (
    id uuid primary key default gen_random_uuid(),
    dispositivo_id text not null references cuna_private.dispositivos(id),
    correo text not null check (correo = lower(btrim(correo)) and length(correo) <= 254),
    invitado_por uuid references auth.users(id) on delete set null,
    creada_en timestamptz not null default now(),
    aceptada_en timestamptz,
    aceptada_por uuid references auth.users(id) on delete set null,
    revocada_en timestamptz,
    check (aceptada_en is null or revocada_en is null)
);

create unique index invitaciones_dueno_pendiente
    on cuna_private.invitaciones_dueno (dispositivo_id, correo)
    where aceptada_en is null and revocada_en is null;

revoke all on cuna_private.tutores_bebe, cuna_private.invitaciones_dueno
    from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- ayudas
-- Bebé asignado a un módulo en un instante. Una fila con bebe_id nulo cierra
-- la asignación. Misma regla que usa la ingesta.
create function cuna_private.bebe_vigente(p_device_id text, p_ts timestamptz)
returns uuid
language sql stable security definer
set search_path = ''
as $$
    select asignacion.bebe_id
    from cuna_private.asignaciones_bebe as asignacion
    where asignacion.dispositivo_id = p_device_id and asignacion.desde <= p_ts
    order by asignacion.desde desc
    limit 1;
$$;

revoke all on function cuna_private.bebe_vigente(text, timestamptz)
    from public, anon, authenticated, service_role;

create function cuna_private.puede_ver_bebe(p_bebe_id uuid, p_usuario uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
    select exists (
        select 1 from cuna_private.tutores_bebe as tutor
        where tutor.bebe_id = p_bebe_id and tutor.usuario_id = p_usuario
    ) or exists (
        select 1 from cuna_private.duenos_dispositivo as dueno
        where dueno.usuario_id = p_usuario and dueno.activo
          and cuna_private.bebe_vigente(dueno.dispositivo_id, clock_timestamp()) = p_bebe_id
    );
$$;

revoke all on function cuna_private.puede_ver_bebe(uuid, uuid)
    from public, anon, authenticated, service_role;

-- Dueño activo de un módulo. Devuelve el usuario o lanza 42501 sin revelar
-- si el módulo existe.
create function cuna_private.exigir_dueno(p_device_id text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
begin
    if usuario is null or not exists (
        select 1 from cuna_private.duenos_dispositivo as dueno
        where dueno.dispositivo_id = p_device_id
          and dueno.usuario_id = usuario and dueno.activo
    ) then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    return usuario;
end;
$$;

revoke all on function cuna_private.exigir_dueno(text)
    from public, anon, authenticated, service_role;

-- ------------------------------------------------------------- RPC: bebés
create function public.crear_bebe(p_nombre text, p_fecha_nacimiento date default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    nuevo cuna_private.bebes%rowtype;
begin
    if usuario is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    if p_nombre is null or btrim(p_nombre) = '' or length(btrim(p_nombre)) > 80 then
        raise exception 'nombre_requerido' using errcode = '22023';
    end if;
    if p_fecha_nacimiento is not null
        and p_fecha_nacimiento > (now() at time zone 'America/Costa_Rica')::date then
        raise exception 'fecha_invalida' using errcode = '22023';
    end if;

    insert into cuna_private.bebes (nombre, fecha_nacimiento, creado_por)
    values (btrim(p_nombre), p_fecha_nacimiento, usuario)
    returning * into nuevo;

    insert into cuna_private.tutores_bebe (bebe_id, usuario_id) values (nuevo.id, usuario);

    return jsonb_build_object(
        'id', nuevo.id, 'nombre', nuevo.nombre, 'fecha_nacimiento', nuevo.fecha_nacimiento);
end;
$$;

create function public.mis_bebes()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
begin
    if usuario is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', bebe.id, 'nombre', bebe.nombre, 'fecha_nacimiento', bebe.fecha_nacimiento
        ) order by bebe.nombre, bebe.id)
        from cuna_private.bebes as bebe
        where cuna_private.puede_ver_bebe(bebe.id, usuario)
    ), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------ RPC: dispositivos
create function public.mis_dispositivos()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
begin
    if usuario is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', disp.id,
            'tipo', disp.tipo,
            'producto_id', coalesce(disp.producto_id, disp.id),
            'activo', disp.activo,
            'bebe_id', bebe.id,
            'bebe_nombre', bebe.nombre
        ) order by disp.id)
        from cuna_private.duenos_dispositivo as dueno
        join cuna_private.dispositivos as disp on disp.id = dueno.dispositivo_id
        left join cuna_private.bebes as bebe
            on bebe.id = cuna_private.bebe_vigente(disp.id, clock_timestamp())
        where dueno.usuario_id = usuario and dueno.activo
    ), '[]'::jsonb);
end;
$$;

-- Asocia un módulo a la cuenta con su código de reclamo (un solo uso). Solo
-- el primer dueño se crea así; los demás llegan por invitación.
create function public.reclamar_dispositivo(p_device_id text, p_codigo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    modulo cuna_private.dispositivos%rowtype;
begin
    if usuario is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    if p_device_id is null or p_codigo is null or length(p_codigo) < 12 or length(p_codigo) > 128 then
        raise exception 'codigo_invalido' using errcode = '42501';
    end if;

    select disp.* into modulo
    from cuna_private.dispositivos as disp
    where disp.id = p_device_id
      and disp.activo
      and disp.codigo_reclamo_sha256 = encode(sha256(convert_to(p_codigo, 'UTF8')), 'hex')
    for update;

    -- Módulo inexistente, inactivo, sin código o código erróneo: mismo error.
    if not found then
        raise exception 'codigo_invalido' using errcode = '42501';
    end if;

    insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id)
    values (modulo.id, usuario)
    on conflict (dispositivo_id, usuario_id) do update set activo = true;

    update cuna_private.dispositivos set codigo_reclamo_sha256 = null where id = modulo.id;

    return jsonb_build_object(
        'id', modulo.id, 'tipo', modulo.tipo, 'producto_id', coalesce(modulo.producto_id, modulo.id));
end;
$$;

-- Asigna un módulo a un bebé desde ahora (reasignación). Los registros ya
-- guardados conservan su bebé. p_bebe_id nulo cierra la asignación.
create function public.asignar_dispositivo(p_device_id text, p_bebe_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := cuna_private.exigir_dueno(p_device_id);
    modulo cuna_private.dispositivos%rowtype;
    ahora timestamptz;
    actual uuid;
begin
    select disp.* into modulo from cuna_private.dispositivos as disp
    where disp.id = p_device_id and disp.activo
    for update;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    if p_bebe_id is not null then
        if not cuna_private.puede_ver_bebe(p_bebe_id, usuario) then
            raise exception 'no_autorizado' using errcode = '42501';
        end if;
        -- Serializa asignaciones concurrentes al mismo bebé.
        perform 1 from cuna_private.bebes as bebe where bebe.id = p_bebe_id for update;
    end if;

    ahora := clock_timestamp();
    actual := cuna_private.bebe_vigente(p_device_id, ahora);

    if actual is not distinct from p_bebe_id then
        return jsonb_build_object('device_id', p_device_id, 'bebe_id', p_bebe_id, 'cambio', false);
    end if;

    if p_bebe_id is not null and modulo.tipo = 'cuna' and exists (
        select 1
        from cuna_private.dispositivos as otra
        where otra.tipo = 'cuna'
          and coalesce(otra.producto_id, otra.id) <> coalesce(modulo.producto_id, modulo.id)
          and cuna_private.bebe_vigente(otra.id, ahora) = p_bebe_id
    ) then
        raise exception 'cuna_ya_asociada' using errcode = '23505';
    end if;

    insert into cuna_private.asignaciones_bebe (dispositivo_id, desde, bebe_id)
    values (p_device_id, ahora, p_bebe_id);

    return jsonb_build_object(
        'device_id', p_device_id, 'bebe_id', p_bebe_id, 'desde', ahora, 'cambio', true);
end;
$$;

-- ------------------------------------------------------ RPC: dueños
create function public.duenos_de(p_device_id text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
    perform cuna_private.exigir_dueno(p_device_id);
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'usuario_id', dueno.usuario_id, 'correo', usuario.email::text
        ) order by usuario.email, dueno.usuario_id)
        from cuna_private.duenos_dispositivo as dueno
        join auth.users as usuario on usuario.id = dueno.usuario_id
        where dueno.dispositivo_id = p_device_id and dueno.activo
    ), '[]'::jsonb);
end;
$$;

create function public.invitar_dueno(p_device_id text, p_correo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := cuna_private.exigir_dueno(p_device_id);
    v_correo text := lower(btrim(coalesce(p_correo, '')));
    invitacion uuid;
begin
    if length(v_correo) > 254 or v_correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'correo_invalido' using errcode = '22023';
    end if;

    insert into cuna_private.invitaciones_dueno (dispositivo_id, correo, invitado_por)
    values (p_device_id, v_correo, usuario)
    on conflict (dispositivo_id, correo)
        where aceptada_en is null and revocada_en is null
    do nothing
    returning id into invitacion;

    if invitacion is null then
        select inv.id into invitacion from cuna_private.invitaciones_dueno as inv
        where inv.dispositivo_id = p_device_id and inv.correo = v_correo
          and inv.aceptada_en is null and inv.revocada_en is null;
    end if;

    return jsonb_build_object('id', invitacion, 'dispositivo_id', p_device_id, 'correo', v_correo);
end;
$$;

create function public.revocar_invitacion(p_invitacion_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    inv cuna_private.invitaciones_dueno%rowtype;
begin
    select i.* into inv from cuna_private.invitaciones_dueno as i
    where i.id = p_invitacion_id for update;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    perform cuna_private.exigir_dueno(inv.dispositivo_id);

    if inv.aceptada_en is not null or inv.revocada_en is not null then
        raise exception 'invitacion_no_pendiente' using errcode = '55000';
    end if;

    update cuna_private.invitaciones_dueno set revocada_en = now() where id = inv.id;
    return jsonb_build_object('id', inv.id, 'estado', 'revocada');
end;
$$;

-- El correo de la sesión llega en el JWT; Supabase lo emite verificado.
create function public.mis_invitaciones()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    v_correo text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
    if usuario is null then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', inv.id, 'dispositivo_id', inv.dispositivo_id,
            'tipo', disp.tipo, 'creada_en', inv.creada_en
        ) order by inv.creada_en, inv.id)
        from cuna_private.invitaciones_dueno as inv
        join cuna_private.dispositivos as disp on disp.id = inv.dispositivo_id
        where v_correo <> '' and inv.correo = v_correo
          and inv.aceptada_en is null and inv.revocada_en is null and disp.activo
    ), '[]'::jsonb);
end;
$$;

create function public.aceptar_invitacion(p_invitacion_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    usuario uuid := (select auth.uid());
    v_correo text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
    inv cuna_private.invitaciones_dueno%rowtype;
begin
    if usuario is null or v_correo = '' then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    -- Invitación ajena, inexistente o ya usada: mismo error.
    select i.* into inv
    from cuna_private.invitaciones_dueno as i
    join cuna_private.dispositivos as disp on disp.id = i.dispositivo_id
    where i.id = p_invitacion_id and i.correo = v_correo
      and i.aceptada_en is null and i.revocada_en is null and disp.activo
    for update of i;

    if not found then
        raise exception 'no_autorizado' using errcode = '42501';
    end if;

    insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id)
    values (inv.dispositivo_id, usuario)
    on conflict (dispositivo_id, usuario_id) do update set activo = true;

    update cuna_private.invitaciones_dueno
    set aceptada_en = now(), aceptada_por = usuario
    where id = inv.id;

    return jsonb_build_object('id', inv.id, 'dispositivo_id', inv.dispositivo_id, 'estado', 'aceptada');
end;
$$;

-- Retira el acceso (activo = false). No borra registros. Nunca deja un módulo
-- sin dueño activo.
create function public.retirar_dueno(p_device_id text, p_usuario_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
    activos integer;
begin
    perform cuna_private.exigir_dueno(p_device_id);

    -- Bloquea las filas activas: dos retiros simultáneos no pueden vaciar el módulo.
    select count(*) into activos from (
        select 1 from cuna_private.duenos_dispositivo as dueno
        where dueno.dispositivo_id = p_device_id and dueno.activo
        for update
    ) as bloqueadas;

    if not exists (
        select 1 from cuna_private.duenos_dispositivo as dueno
        where dueno.dispositivo_id = p_device_id and dueno.usuario_id = p_usuario_id and dueno.activo
    ) then
        raise exception 'no_es_dueno' using errcode = '22023';
    end if;

    if activos <= 1 then
        raise exception 'ultimo_dueno' using errcode = '23514';
    end if;

    update cuna_private.duenos_dispositivo set activo = false
    where dispositivo_id = p_device_id and usuario_id = p_usuario_id;

    return jsonb_build_object('device_id', p_device_id, 'usuario_id', p_usuario_id, 'activo', false);
end;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function
    public.crear_bebe(text, date), public.mis_bebes(), public.mis_dispositivos(),
    public.reclamar_dispositivo(text, text), public.asignar_dispositivo(text, uuid),
    public.duenos_de(text), public.invitar_dueno(text, text), public.revocar_invitacion(uuid),
    public.mis_invitaciones(), public.aceptar_invitacion(uuid), public.retirar_dueno(text, uuid)
    from public, anon, authenticated, service_role;

grant execute on function
    public.crear_bebe(text, date), public.mis_bebes(), public.mis_dispositivos(),
    public.reclamar_dispositivo(text, text), public.asignar_dispositivo(text, uuid),
    public.duenos_de(text), public.invitar_dueno(text, text), public.revocar_invitacion(uuid),
    public.mis_invitaciones(), public.aceptar_invitacion(uuid), public.retirar_dueno(text, uuid)
    to authenticated;

commit;
