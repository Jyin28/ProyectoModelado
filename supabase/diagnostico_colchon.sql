-- =============================================================================
-- Script de diagnóstico del colchón en Supabase
-- Pega esto en el SQL Editor de Supabase para ver el estado actual
-- =============================================================================

-- 1. Ver dispositivos registrados
select id, activo, left(token_sha256, 8) || '...' as token_preview
from cuna_private.dispositivos
where id like '%colchon%';

-- 2. Ver dueños del dispositivo colchón
select d.dispositivo_id, d.usuario_id, d.activo, u.email
from cuna_private.duenos_dispositivo d
join auth.users u on u.id = d.usuario_id
where d.dispositivo_id = 'pico-figuras-colchon-01';

-- 3. Ver los últimos 5 eventos del colchón
select event_id, device_id, tipo, ts, datos
from public.eventos_colchon
where device_id = 'pico-figuras-colchon-01'
order by ts desc
limit 5;

-- 4. Ver órdenes pendientes (si las hay)
select command_id, command, estado, creado_en, vence_en
from public.ordenes_colchon
where device_id = 'pico-figuras-colchon-01'
order by creado_en desc
limit 10;

-- 5. Ver tu usuario (para copiar el UUID)
select id, email from auth.users where email = 'kev.hernandezr@gmail.com';
