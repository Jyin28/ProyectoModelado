import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }
const conflicto = { code: '23505' }
const restriccion = { code: '23514' }
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sha = (texto) => createHash('sha256').update(texto).digest('hex')

const CUNA_AMBIENTE = 'cuna-ambiente-01'
const CUNA_MOVIMIENTO = 'cuna-movimiento-01'
const OTRA_CUNA = 'cuna-ambiente-02'
const COLCHON = 'cuna-colchon-01'
const CODIGO = 'codigo-de-prueba-01'

test('Cuentas, bebés, dueños compartidos y reasignación (HU-01 a HU-05)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const ana = randomUUID()
  const beto = randomUUID()
  const carla = randomUUID()
  const correos = { [ana]: 'ana@example.com', [beto]: 'beto@example.com', [carla]: 'carla@example.com' }

  await db.exec(`
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
  `)
  for (const archivo of ['20261111000100_lecturas_ambiente.sql', '20261118000100_cuentas_propiedad.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }
  for (const [id, correo] of Object.entries(correos)) {
    await db.query('insert into auth.users values ($1, $2)', [id, correo])
  }
  // Alta del producto: la hace un administrador (no existe RPC pública).
  await db.query(`
    insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id, codigo_reclamo_sha256) values
      ($1, $5, 'cuna', 'cuna-01', $9),
      ($2, $6, 'cuna', 'cuna-01', $9),
      ($3, $7, 'cuna', 'cuna-02', $9),
      ($4, $8, 'colchon', null, $9)
  `, [CUNA_AMBIENTE, CUNA_MOVIMIENTO, OTRA_CUNA, COLCHON,
    '1'.repeat(64), '2'.repeat(64), '3'.repeat(64), '4'.repeat(64), sha(CODIGO)])

  async function como(usuario, consultar, rol = 'authenticated') {
    await db.exec(`set role ${rol}`)
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ''])
      const claims = usuario ? JSON.stringify({ sub: usuario, email: correos[usuario] }) : ''
      await db.query("select set_config('request.jwt.claims', $1, false)", [claims])
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }
  const rpc = async (usuario, sql, params = []) =>
    (await como(usuario, () => db.query(`select ${sql} as r`, params))).rows[0].r

  await t.test('CA-02.1 y CA-02.3: nombre obligatorio, fecha opcional y bebés separados', async () => {
    for (const nombre of ['', '   ', null]) {
      await assert.rejects(como(ana, () => db.query('select public.crear_bebe($1)', [nombre])), invalido)
    }
    await assert.rejects(como(ana, () => db.query('select public.crear_bebe($1, $2::date)', ['Futuro', '2999-01-01'])), invalido)
    await assert.rejects(como(null, () => db.query('select public.crear_bebe($1)', ['Anónimo'])), sinPermiso)

    const sinFecha = await rpc(ana, 'public.crear_bebe($1)', ['  Luna '])
    assert.equal(sinFecha.nombre, 'Luna')
    assert.equal(sinFecha.fecha_nacimiento, null)
    await rpc(ana, 'public.crear_bebe($1, $2::date)', ['Sol', '2026-05-01'])
    await rpc(beto, 'public.crear_bebe($1)', ['Nube'])

    const deAna = await rpc(ana, 'public.mis_bebes()')
    assert.deepEqual(deAna.map((b) => b.nombre), ['Luna', 'Sol'])
    assert.equal(deAna[1].fecha_nacimiento, '2026-05-01')
    assert.deepEqual((await rpc(beto, 'public.mis_bebes()')).map((b) => b.nombre), ['Nube'])
    assert.deepEqual(await rpc(carla, 'public.mis_bebes()'), [])
  })

  const idBebe = async (usuario, nombre) =>
    (await rpc(usuario, 'public.mis_bebes()')).find((b) => b.nombre === nombre).id

  await t.test('CA-03.1: reclamar con el código de un solo uso', async () => {
    for (const codigo of ['codigo-equivocado-1', 'corto', null]) {
      await assert.rejects(como(ana, () => db.query('select public.reclamar_dispositivo($1, $2)', [CUNA_AMBIENTE, codigo])), sinPermiso)
    }
    await assert.rejects(como(ana, () => db.query('select public.reclamar_dispositivo($1, $2)', ['no-existe-01', CODIGO])), sinPermiso)
    await assert.rejects(como(null, () => db.query('select public.reclamar_dispositivo($1, $2)', [CUNA_AMBIENTE, CODIGO])), sinPermiso)

    for (const id of [CUNA_AMBIENTE, CUNA_MOVIMIENTO, OTRA_CUNA, COLCHON]) {
      const r = await rpc(ana, 'public.reclamar_dispositivo($1, $2)', [id, CODIGO])
      assert.equal(r.id, id)
    }
    // El código se consumió: nadie más puede reclamar.
    await assert.rejects(como(beto, () => db.query('select public.reclamar_dispositivo($1, $2)', [CUNA_AMBIENTE, CODIGO])), sinPermiso)
    assert.equal((await db.query('select count(*)::int as n from cuna_private.dispositivos where codigo_reclamo_sha256 is not null')).rows[0].n, 0)
    assert.equal((await rpc(ana, 'public.mis_dispositivos()')).length, 4)
    assert.deepEqual(await rpc(beto, 'public.mis_dispositivos()'), [])
  })

  await t.test('CA-02.2 y CA-03.3: un accesorio se asocia a un bebé sin comprar la cuna', async () => {
    const luna = await idBebe(ana, 'Luna')
    const r = await rpc(ana, 'public.asignar_dispositivo($1, $2)', [COLCHON, luna])
    assert.equal(r.bebe_id, luna)
    const lista = await rpc(ana, 'public.mis_dispositivos()')
    const colchon = lista.find((d) => d.id === COLCHON)
    assert.equal(colchon.tipo, 'colchon')
    assert.equal(colchon.bebe_nombre, 'Luna')
    assert.equal(lista.find((d) => d.id === CUNA_AMBIENTE).bebe_id, null)
    // Repetir la misma asignación no crea otra fila.
    assert.equal((await rpc(ana, 'public.asignar_dispositivo($1, $2)', [COLCHON, luna])).cambio, false)
    assert.equal((await db.query('select count(*)::int as n from cuna_private.asignaciones_bebe where dispositivo_id = $1', [COLCHON])).rows[0].n, 1)
  })

  await t.test('CA-03.2 y CA-03.4: una cuna por bebé; la segunda se rechaza sin tocar la primera', async () => {
    const luna = await idBebe(ana, 'Luna')
    // Los módulos del mismo producto comparten bebé.
    await rpc(ana, 'public.asignar_dispositivo($1, $2)', [CUNA_AMBIENTE, luna])
    await rpc(ana, 'public.asignar_dispositivo($1, $2)', [CUNA_MOVIMIENTO, luna])
    await assert.rejects(como(ana, () => db.query('select public.asignar_dispositivo($1, $2)', [OTRA_CUNA, luna])), conflicto)
    const lista = await rpc(ana, 'public.mis_dispositivos()')
    assert.equal(lista.find((d) => d.id === CUNA_AMBIENTE).bebe_nombre, 'Luna')
    assert.equal(lista.find((d) => d.id === OTRA_CUNA).bebe_id, null)
    // Otro bebé sí puede tener esa otra cuna.
    await rpc(ana, 'public.asignar_dispositivo($1, $2)', [OTRA_CUNA, await idBebe(ana, 'Sol')])
  })

  await t.test('un bebé ajeno o un módulo ajeno se rechazan con el mismo error', async () => {
    const nube = await idBebe(beto, 'Nube')
    await assert.rejects(como(ana, () => db.query('select public.asignar_dispositivo($1, $2)', [COLCHON, nube])), sinPermiso)
    await assert.rejects(como(beto, () => db.query('select public.asignar_dispositivo($1, $2)', [COLCHON, nube])), sinPermiso)
    await assert.rejects(como(null, () => db.query('select public.asignar_dispositivo($1, $2)', [COLCHON, null])), sinPermiso)
    await assert.rejects(como(beto, () => db.query('select public.duenos_de($1)', [COLCHON])), sinPermiso)
  })

  await t.test('CA-04.1 y CA-04.3: la invitación solo concede acceso al aceptarla', async () => {
    await assert.rejects(como(ana, () => db.query('select public.invitar_dueno($1, $2)', [COLCHON, 'no-es-correo'])), invalido)
    await assert.rejects(como(beto, () => db.query('select public.invitar_dueno($1, $2)', [COLCHON, 'beto@example.com'])), sinPermiso)

    const inv = await rpc(ana, 'public.invitar_dueno($1, $2)', [COLCHON, '  Beto@Example.com '])
    assert.equal(inv.correo, 'beto@example.com')
    // Reinvitar devuelve la misma invitación pendiente.
    assert.equal((await rpc(ana, 'public.invitar_dueno($1, $2)', [COLCHON, 'beto@example.com'])).id, inv.id)

    // Pendiente: no hay acceso ni vista del módulo.
    assert.deepEqual(await rpc(beto, 'public.mis_dispositivos()'), [])
    assert.equal((await rpc(beto, 'public.mis_invitaciones()')).length, 1)
    assert.deepEqual(await rpc(carla, 'public.mis_invitaciones()'), [])
    await assert.rejects(como(carla, () => db.query('select public.aceptar_invitacion($1)', [inv.id])), sinPermiso)
    await assert.rejects(como(beto, () => db.query('select public.aceptar_invitacion($1)', [randomUUID()])), sinPermiso)

    await rpc(beto, 'public.aceptar_invitacion($1)', [inv.id])
    assert.equal((await rpc(beto, 'public.mis_dispositivos()'))[0].id, COLCHON)
    assert.deepEqual((await rpc(beto, 'public.duenos_de($1)', [COLCHON])).map((d) => d.correo), ['ana@example.com', 'beto@example.com'])
    // Una invitación se usa una sola vez.
    await assert.rejects(como(beto, () => db.query('select public.aceptar_invitacion($1)', [inv.id])), sinPermiso)
    assert.deepEqual(await rpc(beto, 'public.mis_invitaciones()'), [])
  })

  await t.test('una invitación revocada no se puede aceptar', async () => {
    const inv = await rpc(ana, 'public.invitar_dueno($1, $2)', [COLCHON, 'carla@example.com'])
    await assert.rejects(como(carla, () => db.query('select public.revocar_invitacion($1)', [inv.id])), sinPermiso)
    await rpc(ana, 'public.revocar_invitacion($1)', [inv.id])
    await assert.rejects(como(carla, () => db.query('select public.aceptar_invitacion($1)', [inv.id])), sinPermiso)
    assert.deepEqual(await rpc(carla, 'public.mis_invitaciones()'), [])
  })

  await t.test('CA-05.1 a CA-05.3 y CA-24.4: reasignar conserva el historial y no borra', async () => {
    const luna = await idBebe(ana, 'Luna')
    // Sol ya tiene otra cuna; la reasignación va a un bebé nuevo.
    const sol = (await rpc(ana, 'public.crear_bebe($1)', ['Estrella'])).id
    const lectura = (ts) => db.query(
      'select public.ingestar_ambiente($1, $2, $3, $4, $5, 22.5, 55) as r',
      [randomUUID(), CUNA_AMBIENTE, '1'.repeat(64), ts, new Date()])
    const ingestar = async (ts) =>
      (await como(null, () => lectura(ts), 'service_role')).rows[0].r

    await pausa(20)
    assert.equal(await ingestar(new Date()), 'creado')
    await pausa(20)
    await rpc(ana, 'public.asignar_dispositivo($1, $2)', [CUNA_AMBIENTE, sol])
    await pausa(20)
    assert.equal(await ingestar(new Date()), 'creado')

    const filas = (await db.query('select bebe_id from public.lecturas_ambiente order by ts')).rows
    assert.deepEqual(filas.map((f) => f.bebe_id), [luna, sol])
    // Ningún rol de API puede borrar ni modificar registros.
    await assert.rejects(como(ana, () => db.query('delete from public.lecturas_ambiente')), sinPermiso)
    await assert.rejects(como(ana, () => db.query('update public.lecturas_ambiente set bebe_id = $1', [sol])), sinPermiso)
    assert.equal((await db.query('select count(*)::int as n from public.lecturas_ambiente')).rows[0].n, 2)
    // La asignación original sigue en el historial.
    assert.equal((await db.query('select count(*)::int as n from cuna_private.asignaciones_bebe where dispositivo_id = $1', [CUNA_AMBIENTE])).rows[0].n, 2)
  })

  await t.test('CA-04.3: retirar un dueño revoca el acceso y conserva el historial; no se retira al último', async () => {
    const leer = (usuario) => como(usuario, () => db.query('select count(*)::int as n from public.lecturas_ambiente'))
    assert.equal((await leer(ana)).rows[0].n, 2)
    assert.equal((await leer(beto)).rows[0].n, 0)
    const inv = await rpc(ana, 'public.invitar_dueno($1, $2)', [CUNA_AMBIENTE, 'beto@example.com'])
    await rpc(beto, 'public.aceptar_invitacion($1)', [inv.id])
    assert.equal((await leer(beto)).rows[0].n, 2)
    const antes = (await db.query('select count(*)::int as n from public.lecturas_ambiente')).rows[0].n

    await assert.rejects(como(carla, () => db.query('select public.retirar_dueno($1, $2)', [CUNA_AMBIENTE, beto])), sinPermiso)
    await assert.rejects(como(ana, () => db.query('select public.retirar_dueno($1, $2)', [CUNA_AMBIENTE, carla])), invalido)

    await rpc(ana, 'public.retirar_dueno($1, $2)', [CUNA_AMBIENTE, beto])
    assert.equal((await leer(beto)).rows[0].n, 0)
    assert.deepEqual((await rpc(beto, 'public.mis_dispositivos()')).map((d) => d.id), [COLCHON])
    assert.equal((await db.query('select count(*)::int as n from public.lecturas_ambiente')).rows[0].n, antes)
    assert.equal((await db.query('select activo from cuna_private.duenos_dispositivo where dispositivo_id = $1 and usuario_id = $2', [CUNA_AMBIENTE, beto])).rows[0].activo, false)

    // Ana es la única dueña activa.
    await assert.rejects(como(ana, () => db.query('select public.retirar_dueno($1, $2)', [CUNA_AMBIENTE, ana])), restriccion)
    assert.equal((await leer(ana)).rows[0].n, 2)

    // Un dueño retirado puede ser invitado de nuevo y recupera el acceso.
    const otra = await rpc(ana, 'public.invitar_dueno($1, $2)', [CUNA_AMBIENTE, 'beto@example.com'])
    await rpc(beto, 'public.aceptar_invitacion($1)', [otra.id])
    assert.equal((await leer(beto)).rows[0].n, 2)
  })
})
