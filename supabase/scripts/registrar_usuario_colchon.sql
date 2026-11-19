-- =============================================================================
-- Migración: Registrar usuario y dispositivo colchón para pruebas
-- Ejecutar en Supabase SQL Editor con permisos de service_role
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Reemplaza <TU_USER_ID> con el UUID de tu usuario en Supabase Auth
--    (lo encuentras en Authentication > Users > tu email > User UID)
-- 2. Reemplaza <TOKEN_SHA256> con el SHA-256 del token de la Pico
--    (el mismo que usa el firmware en pico/main.py como DEVICE_TOKEN)
-- =============================================================================

begin;

-- Insertar o ignorar si ya existe el dispositivo colchón
insert into cuna_private.dispositivos (id, token_sha256, activo)
values (
    'pico-figuras-colchon-01',
    '37bb59b5518bb850335e132453757b80de630cedbd9394eef650778147ddc557',  -- SHA-256 del DEVICE_TOKEN de la Pico
    true
)
on conflict (id) do update
    set activo = true;

-- Insertar o ignorar si ya existe el bebé de prueba
-- (usa el bebe_id que ya aparece en los eventos: a2d531d5-2349-439c-a087-4e538be5579c)
insert into cuna_private.bebes (id, nombre)
values (
    'a2d531d5-2349-439c-a087-4e538be5579c',
    'Bebé de Prueba'
)
on conflict (id) do nothing;

-- Registrar al usuario como dueño activo del dispositivo colchón
insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id, activo)
values (
    'pico-figuras-colchon-01',
    'abf7efd4-4dc6-4975-820b-c6b633eebf93',  -- kev.hernandezr@gmail.com
    true
)
on conflict (dispositivo_id, usuario_id) do update
    set activo = true;

commit;
