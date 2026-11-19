// Base común para las pruebas de las fases 10 y 11: una base PGlite con los
// esquemas mínimos que Supabase provee (auth, realtime, storage) y todas las
// migraciones locales excepto 000300 (pg_cron y pg_net no existen en PGlite).
import { createHash, randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

export const sinPermiso = { code: '42501' }
export const invalido = { code: '22023' }

// Token (sha256) que el helper guarda para cada módulo: derivado de su id.
export const tokenDe = (id) => createHash('sha256').update(id).digest('hex')

const ESQUEMAS = `
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create schema realtime;
  create table realtime.messages (
    id uuid primary key default gen_random_uuid(),
    topic text not null, extension text not null, payload jsonb, event text,
    private boolean default false, inserted_at timestamptz not null default now()
  );
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$
    select nullif(current_setting('realtime.topic', true), '')
  $$;
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language sql as $$
    insert into realtime.messages (topic, extension, payload, event, private)
    values (topic, 'broadcast', payload, event, private)
  $$;
  grant usage on schema realtime to authenticated, anon;
  grant select, insert on realtime.messages to authenticated;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id), name text,
    owner uuid default auth.uid(), created_at timestamptz default now(),
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon;
  grant select, insert on storage.objects to authenticated;
  -- Vault no existe en PGlite: public.leer_secreto_funcion (SQL) lo referencia al crearse.
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text);
`

export async function crearBase() {
  const db = new PGlite()
  await db.exec(ESQUEMAS)
  const carpeta = new URL('../migrations/', import.meta.url)
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort()
  for (const archivo of archivos) {
    if (archivo.includes('_cron') || archivo.includes('_notificador_inmediato')) continue
    await db.exec(await readFile(new URL(archivo, carpeta), 'utf8'))
  }

  async function como(rol, usuario, consultar) {
    await db.exec(`set role ${rol}`)
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ''])
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }
  const web = async (usuario, sql, params = []) =>
    (await como('authenticated', usuario, () => db.query(`select ${sql} as r`, params))).rows[0].r
  const servicio = async (sql, params = []) =>
    (await como('service_role', null, () => db.query(`select ${sql} as r`, params))).rows[0].r
  const contar = async (tabla, donde = 'true', params = []) =>
    (await db.query(`select count(*)::int as n from ${tabla} where ${donde}`, params)).rows[0].n

  async function usuario(correo) {
    const id = randomUUID()
    await db.query('insert into auth.users values ($1, $2)', [id, correo ?? `${id}@example.com`])
    return id
  }
  async function bebe(nombre) {
    const id = randomUUID()
    await db.query('insert into cuna_private.bebes (id, nombre) values ($1, $2)', [id, nombre])
    return id
  }
  async function modulo(id, tipo, producto, duenos = []) {
    await db.query(
      'insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values ($1, $2, $3, $4)',
      [id, tokenDe(id), tipo, producto])
    for (const dueno of duenos) {
      await db.query(
        'insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [id, dueno])
    }
  }
  const asignar = (dispositivo, desde, bebeId) =>
    db.query('insert into cuna_private.asignaciones_bebe values ($1, $2::timestamptz, $3)',
      [dispositivo, desde, bebeId])
  const tutor = (bebeId, usuarioId) =>
    db.query('insert into cuna_private.tutores_bebe values ($1, $2)', [bebeId, usuarioId])

  // Inserta un evento directo (como superusuario): sirve para fijar datos conocidos.
  const evento = (e) => db.query(
    `insert into public.eventos (event_id, device_id, bebe_id, tipo, descripcion, valor, unidad, ts, recibido_en, datos)
     values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $8::timestamptz, $9::jsonb)`,
    [e.id ?? randomUUID(), e.device, e.bebe, e.tipo, e.descripcion ?? e.tipo, e.valor ?? null,
      e.unidad ?? null, e.ts, JSON.stringify(e.datos ?? {})])
  const lectura = (l) => db.query(
    `insert into public.lecturas_ambiente (event_id, device_id, bebe_id, ts, recibido_en, temperatura_c, humedad_pct)
     values ($1, $2, $3, $4::timestamptz, $4::timestamptz, $5, $6)`,
    [l.id ?? randomUUID(), l.device, l.bebe, l.ts, l.temp, l.hum])

  const cuentaDispositivo = (usuarioId, dispositivo) => db.query(
    'insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)', [usuarioId, dispositivo])

  return { db, como, cuentaDispositivo, web, servicio, contar, usuario, bebe, modulo, asignar, tutor, evento, lectura }
}
