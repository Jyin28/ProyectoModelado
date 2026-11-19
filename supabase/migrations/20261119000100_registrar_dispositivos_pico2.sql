-- =============================================================================
-- Registro de la Pico 2 W (ambiente y PIR) para pruebas. Idempotente.
-- Los hashes son SHA-256 de los tokens de src/firmware/pico2/.../secrets.py
-- (TOKEN_SHA256 y MOVIMIENTO_TOKEN_SHA256); los tokens NO se guardan aqui.
-- Mismo bebe y mismo dueno que el colchon (ver 20261118000200).
-- =============================================================================
begin;

insert into cuna_private.dispositivos (id, token_sha256, activo, tipo) values
    ('pico2-cuna-01',
     '3630ebdcaecaeab187d58ad0b036e25b33b499aff1e7b8e3d7af7f01636eb8fd', true, 'cuna'),
    ('cuna-movimiento-01',
     '8f894bad8d22145055520c4c52f8103f1eac55f39bd7896b7eafaf36e98b4e3d', true, 'cuna')
on conflict (id) do update
    set token_sha256 = excluded.token_sha256, activo = true;

insert into cuna_private.asignaciones_bebe (dispositivo_id, bebe_id, desde)
select d.id, 'a2d531d5-2349-439c-a087-4e538be5579c', now() - interval '1 hour'
from (values ('pico2-cuna-01'), ('cuna-movimiento-01')) as d(id)
where not exists (
    select 1 from cuna_private.asignaciones_bebe a where a.dispositivo_id = d.id
);

insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id, activo)
select d.id, 'abf7efd4-4dc6-4975-820b-c6b633eebf93', true
from (values ('pico2-cuna-01'), ('cuna-movimiento-01')) as d(id)
on conflict (dispositivo_id, usuario_id) do update set activo = true;

commit;
