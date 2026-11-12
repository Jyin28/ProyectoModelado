import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearIngesta } from '../functions/ingesta/handler.ts'

const tokenMovimiento = '34'.repeat(32)
const tokenAmbiente = '12'.repeat(32)
const movimiento = 'cuna-movimiento-01'
const ambiente = 'cuna-ambiente-01'
const hash = (value) => createHash('sha256').update(value).digest('hex')
const evento = {
  event_id: randomUUID(),
  device_id: movimiento,
  tipo: 'movimiento',
  ts: '2026-11-11T16:00:00Z',
  datos: {},
}

function solicitud(cuerpo = evento, credencial = tokenMovimiento) {
  return new Request('http://localhost/functions/v1/ingesta', {
    method: 'POST',
    headers: { Authorization: `Bearer ${credencial}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

test('Ingesta de movimiento, permisos de la base y ambiente intacto', async (t) => {
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
  for (const archivo of ['20261111000100_lecturas_ambiente.sql', '20261111000400_eventos_movimiento.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }
  await db.query('insert into auth.users values ($1), ($2)', [dueño, otroUsuario])
  await db.query("insert into cuna_private.bebes values ($1, 'Primero'), ($2, 'Segundo')", [primerBebe, segundoBebe])
  await db.query(
    'insert into cuna_private.dispositivos (id, token_sha256) values ($1, $2), ($3, $4)',
    [movimiento, hash(tokenMovimiento), ambiente, hash(tokenAmbiente)],
  )
  await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)', [movimiento, dueño])
  await db.query(`
    insert into cuna_private.asignaciones_bebe values
      ($1, '2026-11-11T14:00:00Z', $2), ($1, '2026-11-11T18:00:00Z', $3), ($4, '2026-11-11T14:00:00Z', $2)
  `, [movimiento, primerBebe, segundoBebe, ambiente])

  async function como(rol, consultar) {
    await db.exec(`set role ${rol}`)
    try {
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }

  const rpcAmbiente = 'select public.ingestar_ambiente($1, $2, $3, $4, $5, $6, $7) as resultado'
  const rpcMovimiento = 'select public.ingestar_movimiento($1, $2, $3, $4, $5) as resultado'
  const recibir = crearIngesta(
    (e, tokenHash, recibidoEn) => como('service_role', async () => {
      const { rows } = await db.query(rpcAmbiente, [
        e.event_id, e.device_id, tokenHash, e.ts, recibidoEn, e.datos.temperatura_c, e.datos.humedad_pct,
      ])
      return rows[0].resultado
    }),
    (e, tokenHash, recibidoEn) => como('service_role', async () => {
      const { rows } = await db.query(rpcMovimiento, [e.event_id, e.device_id, tokenHash, e.ts, recibidoEn])
      return rows[0].resultado
    }),
  )

  await t.test('valida formato, fecha y credencial del módulo', async () => {
    assert.equal((await recibir(solicitud(evento, tokenAmbiente))).status, 401)
    assert.equal((await recibir(solicitud({ ...evento, device_id: ambiente }, tokenAmbiente))).status, 400)
    assert.equal((await recibir(solicitud({ ...evento, device_id: 'cuna-movimiento-1' }))).status, 400)
    assert.equal((await recibir(solicitud({ ...evento, device_id: 'cuna-movimiento-02' }))).status, 401)
    assert.equal((await recibir(solicitud({ ...evento, datos: { fuerza: 1 } }))).status, 400)
    assert.equal((await recibir(solicitud({ ...evento, event_id: 'no-es-uuid' }))).status, 400)
    assert.equal((await recibir(solicitud({ ...evento, ts: '2026-02-30T16:00:00Z' }))).status, 400)
    assert.equal((await recibir(solicitud({ ...evento, ts: '2026-11-11T16:00:00+00:00' }))).status, 400)
    assert.equal((await recibir(solicitud({ ...evento, ts: '2026-11-11T13:00:00Z' }))).status, 422)
    assert.equal((await db.query('select 1 from public.eventos_movimiento')).rows.length, 0)
  })

  await t.test('una función de movimiento rechaza credencial de otro módulo', async () => {
    const { rows } = await como('service_role', () => db.query(rpcMovimiento, [
      randomUUID(), movimiento, hash(tokenAmbiente), evento.ts, evento.ts,
    ]))
    assert.equal(rows[0].resultado, 'no_autorizado')
    const ajeno = await como('service_role', () => db.query(rpcMovimiento, [
      randomUUID(), ambiente, hash(tokenAmbiente), evento.ts, evento.ts,
    ]))
    assert.equal(ajeno.rows[0].resultado, 'no_autorizado')
  })

  const siguiente = { ...evento, event_id: randomUUID(), ts: '2026-11-11T19:00:00.250Z' }
  const leer = () => db.query(`
    select event_id, bebe_id, ts, recibido_en
    from public.eventos_movimiento
    where device_id = $1
    order by ts desc, recibido_en desc, event_id desc
  `, [movimiento])
  const sinPermiso = { code: '42501' }

  await t.test('deduplica, rechaza colisiones y conserva la asignación histórica', async () => {
    const primera = await recibir(solicitud())
    assert.equal(primera.status, 201)
    assert.deepEqual(await primera.json(), { event_id: evento.event_id, estado: 'recibido' })
    const original = (await leer()).rows[0]
    assert.equal(original.ts.toISOString(), '2026-11-11T16:00:00.000Z')
    assert.equal((await recibir(solicitud())).status, 409)
    assert.equal((await recibir(solicitud({ ...evento, ts: '2026-11-11T16:00:01Z' }))).status, 400)
    assert.deepEqual((await leer()).rows, [original])
    assert.equal((await recibir(solicitud(siguiente))).status, 201)
    assert.deepEqual((await leer()).rows.map(({ bebe_id }) => bebe_id), [segundoBebe, primerBebe])
  })

  await t.test('la deduplicación es por tipo y ambiente sigue funcionando', async () => {
    const lectura = {
      event_id: evento.event_id,
      device_id: ambiente,
      tipo: 'ambiente',
      ts: '2026-11-11T16:00:00Z',
      datos: { temperatura_c: 24.3, humedad_pct: 52.1 },
    }
    assert.equal((await recibir(solicitud(lectura, tokenAmbiente))).status, 201)
    assert.equal((await recibir(solicitud(lectura, tokenAmbiente))).status, 409)
    assert.equal((await recibir(solicitud(lectura, tokenMovimiento))).status, 401)
    assert.equal((await db.query('select 1 from public.eventos_movimiento')).rows.length, 2)
  })

  await t.test('solo el dueño activo lee y solo la Ingesta escribe', async () => {
    await como('anon', () => assert.rejects(leer, sinPermiso))
    await como('authenticated', async () => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [dueño])
      assert.equal((await leer()).rows[0].event_id, siguiente.event_id)
      await assert.rejects(db.query(rpcMovimiento, [
        randomUUID(), movimiento, hash(tokenMovimiento), siguiente.ts, siguiente.ts,
      ]), sinPermiso)
      await assert.rejects(db.exec('delete from public.eventos_movimiento'), sinPermiso)
      await assert.rejects(db.exec("insert into public.eventos_movimiento values (gen_random_uuid(), 'cuna-movimiento-01', gen_random_uuid(), now(), now())"), sinPermiso)
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

test('Ingesta rechaza con 401 ambiente con prefijo de otro módulo sin guardar', async () => {
  const llamadas = []
  const recibir = crearIngesta(
    async (e) => { llamadas.push(e.device_id); return 'creado' },
    async () => 'creado',
  )
  const lectura = (device_id) => ({
    event_id: randomUUID(),
    device_id,
    tipo: 'ambiente',
    ts: '2026-11-11T16:00:00Z',
    datos: { temperatura_c: 24.3, humedad_pct: 52.1 },
  })
  for (const id of ['cuna-movimiento-01', 'cuna-lampara-01']) {
    const respuesta = await recibir(solicitud(lectura(id), tokenMovimiento))
    assert.equal(respuesta.status, 401)
    assert.equal((await respuesta.json()).codigo, 'no_autorizado')
  }
  assert.deepEqual(llamadas, [])
  assert.equal((await recibir(solicitud(lectura(ambiente), tokenAmbiente))).status, 201)
  assert.deepEqual(llamadas, [ambiente])
})
