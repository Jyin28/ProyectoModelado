import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const lampara = 'cuna-lampara-01'
const ambiente = 'cuna-ambiente-01'
const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }
const enUso = { code: '23505' }
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('Solicitudes de lámpara, RLS y permisos de la base', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [dueño, otroDueño, ajeno] = Array.from({ length: 3 }, () => randomUUID())
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
  for (const archivo of ['20261111000100_lecturas_ambiente.sql', '20261111000200_comandos_lampara.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }
  // Datos de prueba: el alta real del módulo y del dueño es una fase posterior.
  await db.query('insert into auth.users values ($1), ($2), ($3)', [dueño, otroDueño, ajeno])
  await db.query('insert into cuna_private.dispositivos (id, token_sha256) values ($1, $2), ($3, $4)',
    [lampara, '1'.repeat(64), ambiente, '2'.repeat(64)])
  await db.query(`
    insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values
      ($1, $2), ($1, $3), ($4, $5)
  `, [lampara, dueño, otroDueño, ambiente, ajeno])

  async function como(rol, usuario, consultar) {
    await db.exec(`set role ${rol}`)
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ''])
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }

  const solicitar = (id, modulo, nivel) => db.query(
    'select * from public.solicitar_lampara($1, $2, $3::numeric)', [id, modulo, nivel])
  const contar = async () => Number((await db.query('select count(*)::int as n from public.ordenes_lampara')).rows[0].n)

  await t.test('registra niveles 0 y 100 con datos generados por el servidor', async () => {
    for (const nivel of ['0', '100']) {
      const id = randomUUID()
      const { rows } = await como('authenticated', dueño, () => solicitar(id, lampara, nivel))
      const [orden] = rows
      assert.equal(orden.command_id, id)
      assert.equal(orden.device_id, lampara)
      assert.equal(orden.command, 'lamp_set')
      assert.equal(orden.solicitante_id, dueño)
      assert.equal(orden.nivel, Number(nivel))
      assert.equal(orden.estado, 'pendiente')
      assert.equal(orden.vence_en.getTime() - orden.creado_en.getTime(), 15000)
      assert.ok(Math.abs(Date.now() - orden.creado_en.getTime()) < 60000)
    }
    assert.equal(await contar(), 2)
  })

  await t.test('rechaza niveles inválidos sin guardar nada', async () => {
    const antes = await contar()
    await como('authenticated', dueño, async () => {
      for (const nivel of ['-1', '101', '40.5', '0.4', null, 'NaN', 'Infinity']) {
        await assert.rejects(solicitar(randomUUID(), lampara, nivel), invalido, `nivel ${nivel}`)
      }
      await assert.rejects(solicitar(null, lampara, '40'), invalido)
    })
    assert.equal(await contar(), antes)
  })

  await t.test('es idempotente y rechaza colisiones sin revelar datos', async () => {
    const id = randomUUID()
    const primera = (await como('authenticated', dueño, () => solicitar(id, lampara, '40'))).rows[0]
    await pausa(30)
    const repetida = (await como('authenticated', dueño, () => solicitar(id, lampara, '40.0'))).rows[0]
    assert.deepEqual(repetida, primera)
    assert.equal((await db.query('select count(*)::int as n from public.ordenes_lampara where command_id = $1', [id])).rows[0].n, 1)

    // Mismo command_id con otro nivel, con otro solicitante o con otro módulo.
    const antes = await contar()
    await como('authenticated', dueño, () => assert.rejects(solicitar(id, lampara, '41'), enUso))
    const error = await como('authenticated', otroDueño, () => solicitar(id, lampara, '40')).catch((e) => e)
    assert.equal(error.code, '23505')
    assert.ok(!error.message.includes(dueño) && !error.message.includes('40'))
    assert.equal(await contar(), antes)
    const { rows } = await db.query('select * from public.ordenes_lampara where command_id = $1', [id])
    assert.deepEqual(rows[0], primera)
  })

  await t.test('rechaza usuario ajeno, módulo ajeno, inactivo o sesión ausente', async () => {
    const existente = (await db.query('select command_id from public.ordenes_lampara limit 1')).rows[0].command_id
    const antes = await contar()
    await como('authenticated', ajeno, async () => {
      await assert.rejects(solicitar(randomUUID(), lampara, '40'), sinPermiso)
      await assert.rejects(solicitar(randomUUID(), ambiente, '40'), sinPermiso) // dueño de otro módulo
      await assert.rejects(solicitar(existente, lampara, '40'), sinPermiso) // sin pista de que el id existe
    })
    await como('authenticated', dueño, async () => {
      await assert.rejects(solicitar(randomUUID(), ambiente, '40'), sinPermiso) // módulo que no es de lámpara
      await assert.rejects(solicitar(randomUUID(), 'cuna-lampara-02', '40'), sinPermiso) // formato válido, no registrado
      for (const malo of ['cuna-lampara-1', 'cuna-lampara-001', 'cuna-lampara-0a', 'x-cuna-lampara-01', 'cuna-lampara-01\n']) {
        await assert.rejects(solicitar(randomUUID(), malo, '40'), sinPermiso, malo)
      }
      await assert.rejects(solicitar(randomUUID(), null, '40'), sinPermiso)
    })
    await como('authenticated', null, () => assert.rejects(solicitar(randomUUID(), lampara, '40'), sinPermiso))
    await como('anon', null, () => assert.rejects(solicitar(randomUUID(), lampara, '40'), sinPermiso))
    await como('service_role', null, () => assert.rejects(solicitar(randomUUID(), lampara, '40'), sinPermiso))

    await db.exec("update cuna_private.dispositivos set activo = false where id = 'cuna-lampara-01'")
    await como('authenticated', dueño, () => assert.rejects(solicitar(randomUUID(), lampara, '40'), sinPermiso))
    await db.exec("update cuna_private.dispositivos set activo = true where id = 'cuna-lampara-01'")

    await db.query('update cuna_private.duenos_dispositivo set activo = false where usuario_id = $1', [otroDueño])
    await como('authenticated', otroDueño, () => assert.rejects(solicitar(randomUUID(), lampara, '40'), sinPermiso))
    await db.query('update cuna_private.duenos_dispositivo set activo = true where usuario_id = $1', [otroDueño])
    assert.equal(await contar(), antes)
  })

  await t.test('RLS: solo el dueño activo lee las órdenes', async () => {
    const leer = () => db.query('select command_id from public.ordenes_lampara')
    assert.equal((await como('authenticated', dueño, leer)).rows.length, await contar())
    assert.equal((await como('authenticated', otroDueño, leer)).rows.length, await contar())
    assert.deepEqual((await como('authenticated', ajeno, leer)).rows, [])
    assert.deepEqual((await como('authenticated', null, leer)).rows, [])
    await como('anon', null, () => assert.rejects(leer, sinPermiso))
    await como('service_role', null, () => assert.rejects(leer, sinPermiso))

    await db.query('update cuna_private.duenos_dispositivo set activo = false where usuario_id = $1', [dueño])
    assert.deepEqual((await como('authenticated', dueño, leer)).rows, [])
    await db.query('update cuna_private.duenos_dispositivo set activo = true where usuario_id = $1', [dueño])
  })

  await t.test('no hay escritura directa ni confirmaciones falsificadas', async () => {
    const antes = (await db.query('select * from public.ordenes_lampara order by command_id')).rows
    const escrituras = [
      ['insert', `insert into public.ordenes_lampara (command_id, device_id, solicitante_id, nivel, creado_en, vence_en)
        values (gen_random_uuid(), 'cuna-lampara-01', '${dueño}', 50, now(), now() + interval '15 seconds')`],
      ['update nivel', "update public.ordenes_lampara set nivel = 99"],
      ['update estado', "update public.ordenes_lampara set estado = 'confirmado'"],
      ['delete', 'delete from public.ordenes_lampara'],
      ['truncate', 'truncate public.ordenes_lampara'],
    ]
    for (const rol of ['authenticated', 'anon', 'service_role']) {
      await como(rol, dueño, async () => {
        for (const [nombre, sentencia] of escrituras) {
          await assert.rejects(db.exec(sentencia), sinPermiso, `${rol}: ${nombre}`)
        }
      })
    }
    // Incluso con privilegios totales, las restricciones impiden estados no previstos.
    await assert.rejects(db.exec("update public.ordenes_lampara set estado = 'confirmado'"), { code: '23514' })
    await assert.rejects(db.exec("update public.ordenes_lampara set vence_en = vence_en + interval '1 hour'"), { code: '23514' })
    // La restricción de formato de la tabla también rige para el propietario.
    await assert.rejects(db.exec(`insert into public.ordenes_lampara (command_id, device_id, solicitante_id, nivel, creado_en, vence_en)
      values (gen_random_uuid(), 'cuna-ambiente-01', '${dueño}', 50, now(), now() + interval '15 seconds')`), { code: '23514' })
    assert.deepEqual((await db.query('select * from public.ordenes_lampara order by command_id')).rows, antes)
  })

  // Debe ir al final: elimina una cuenta de la fixture.
  await t.test('eliminar la cuenta solicitante conserva la orden original', async () => {
    const id = randomUUID()
    const original = (await como('authenticated', dueño, () => solicitar(id, lampara, '55'))).rows[0]
    const antes = await contar()
    await db.query('delete from auth.users where id = $1', [dueño])
    assert.equal(await contar(), antes)
    const { rows } = await como('authenticated', otroDueño,
      () => db.query('select * from public.ordenes_lampara where command_id = $1', [id]))
    assert.deepEqual(rows, [original])
    assert.equal(rows[0].solicitante_id, dueño)
  })
})
