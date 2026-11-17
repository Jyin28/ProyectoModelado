import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearIngesta } from '../functions/ingesta/handler.ts'

const token = '12'.repeat(32)
const otroToken = 'ab'.repeat(32)
const modulo = 'cuna-ambiente-01'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const lectura = {
  event_id: randomUUID(),
  device_id: modulo,
  tipo: 'ambiente',
  ts: '2026-11-11T16:00:00Z',
  datos: { temperatura_c: 24.3, humedad_pct: 52.1 },
}

function solicitud(evento = lectura, credencial = token) {
  return new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${credencial}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(evento),
  })
}

test('Ingesta de ambiente y permisos de la base', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [dueño, otroUsuario, primerBebe, segundoBebe] = Array.from({ length: 4 }, () => randomUUID())
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `)
  await db.exec(await readFile(new URL('../migrations/20261111000100_lecturas_ambiente.sql', import.meta.url), 'utf8'))
  await db.query('insert into auth.users values ($1), ($2)', [dueño, otroUsuario])
  await db.query("insert into cuna_private.bebes values ($1, 'Primero'), ($2, 'Segundo')", [primerBebe, segundoBebe])
  await db.query('insert into cuna_private.dispositivos (id, token_sha256) values ($1, $2)', [modulo, hash(token)])
  await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [modulo, dueño])
  await db.query(`
    insert into cuna_private.asignaciones_bebe values
      ($1, '2026-11-11T14:00:00Z', $2), ($1, '2026-11-11T18:00:00Z', $3)
  `, [modulo, primerBebe, segundoBebe])

  async function como(rol, consultar) {
    await db.exec(`set role ${rol}`)
    try {
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }

  const guardar = 'select public.ingestar_ambiente($1, $2, $3, $4, $5, $6, $7) as resultado'
  const recibir = crearIngesta((evento, tokenHash, recibidoEn) => como('service_role', async () => {
    const { rows } = await db.query(guardar, [
      evento.event_id, evento.device_id, tokenHash, evento.ts, recibidoEn,
      evento.datos.temperatura_c, evento.datos.humedad_pct,
    ])
    return rows[0].resultado
  }))

  await t.test('valida los datos y la credencial del módulo', async () => {
    assert.equal((await recibir(solicitud(lectura, otroToken))).status, 401)
    assert.equal((await recibir(solicitud({ ...lectura, ts: '2026-02-30T16:00:00Z' }))).status, 400)
    assert.equal((await recibir(solicitud({ ...lectura, ts: '0000-01-01T00:00:00Z' }))).status, 400)
    assert.equal((await recibir(solicitud({ ...lectura, datos: { ...lectura.datos, humedad_pct: 101 } }))).status, 400)
    assert.equal((await recibir(solicitud({ ...lectura, relleno: 'x'.repeat(2048) }))).status, 413)
    assert.equal((await recibir(solicitud({ ...lectura, ts: '2026-11-11T13:00:00Z' }))).status, 422)
  })

  const siguiente = { ...lectura, event_id: randomUUID(), ts: '2026-11-11T19:00:00Z' }
  const leer = () => db.query(`
    select event_id, bebe_id, ts, recibido_en
    from public.lecturas_ambiente
    where device_id = $1
    order by ts desc, recibido_en desc, event_id desc
  `, [modulo])
  const sinPermiso = { code: '42501' }

  await t.test('guarda una sola fila por evento y conserva la asignación histórica', async () => {
    const primera = await recibir(solicitud())
    assert.equal(primera.status, 201)
    assert.deepEqual(await primera.json(), { event_id: lectura.event_id, estado: 'recibido' })
    const original = (await leer()).rows[0]
    assert.equal(original.ts.toISOString(), '2026-11-11T16:00:00.000Z')
    assert.equal((await recibir(solicitud())).status, 409)
    assert.equal((await recibir(solicitud({ ...lectura, datos: { ...lectura.datos, humedad_pct: 70 } }))).status, 400)
    assert.deepEqual((await leer()).rows, [original])
    assert.equal((await recibir(solicitud(siguiente))).status, 201)
    assert.deepEqual((await leer()).rows.map(({ bebe_id }) => bebe_id), [segundoBebe, primerBebe])
  })

  await t.test('solo el dueño activo puede leer y solo la Ingesta puede escribir', async () => {
    await como('anon', () => assert.rejects(leer, sinPermiso))
    await como('authenticated', async () => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [dueño])
      assert.equal((await leer()).rows[0].event_id, siguiente.event_id)
      await assert.rejects(db.query(guardar, [
        randomUUID(), modulo, hash(token), siguiente.ts, siguiente.ts, 24, 52,
      ]), sinPermiso)
      await assert.rejects(db.exec('delete from public.lecturas_ambiente'), sinPermiso)
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otroUsuario])
      assert.deepEqual((await leer()).rows, [])
    })
    await db.exec('update cuna_private.duenos_dispositivo set activo = false')
    await como('authenticated', async () => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [dueño])
      assert.deepEqual((await leer()).rows, [])
    })
    await db.exec('update cuna_private.dispositivos set activo = false')
    assert.equal((await recibir(solicitud())).status, 401)
  })
})
