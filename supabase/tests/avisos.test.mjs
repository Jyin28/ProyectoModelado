import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }

const CUNA = 'cuna-ambiente-01'
const ALIMENTACION = 'cuna-alimentacion-01'
const TOKEN = 'a'.repeat(64)
const TOKEN_ALIM = 'b'.repeat(64)

test('Eventos, destinatarios de Telegram, avisos, horarios y episodios (HU-06, HU-07)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const ana = randomUUID()
  const beto = randomUUID()
  const carla = randomUUID()
  const bebe = randomUUID()

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
  for (const archivo of [
    '20261111000100_lecturas_ambiente.sql',
    '20261118000100_cuentas_propiedad.sql',
    '20261118000200_avisos_telegram.sql',
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }
  for (const id of [ana, beto, carla]) {
    await db.query('insert into auth.users values ($1, $2)', [id, `${id}@example.com`])
  }
  await db.query("insert into cuna_private.bebes (id, nombre) values ($1, 'Luna')", [bebe])
  await db.query(`
    insert into cuna_private.dispositivos (id, token_sha256, tipo, producto_id) values
      ($1, $3, 'cuna', 'cuna-01'), ($2, $4, 'alimentacion', null)
  `, [CUNA, ALIMENTACION, TOKEN, TOKEN_ALIM])
  await db.query(`
    insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values
      ($1, $3), ($1, $4), ($2, $3)
  `, [CUNA, ALIMENTACION, ana, beto])
  await db.query(`
    insert into cuna_private.asignaciones_bebe values
      ($1, '2026-01-01T00:00:00Z', $3), ($2, '2026-01-01T00:00:00Z', $3)
  `, [CUNA, ALIMENTACION, bebe])

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

  const ingestar = (extra = {}) => {
    const e = {
      id: randomUUID(), device: CUNA, token: TOKEN, tipo: 'prueba_aviso',
      ts: '2026-11-18T10:00:00Z', descripcion: 'Evento de prueba', valor: null, unidad: null,
      datos: '{}', avisar: true, ...extra,
    }
    return servicio(
      'public.ingestar_evento($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8::double precision, $9, $10::jsonb, $11)',
      [e.id, e.device, e.token, e.tipo, e.ts, '2026-11-18T10:00:01Z', e.descripcion, e.valor, e.unidad, e.datos, e.avisar],
    ).then((r) => ({ r, id: e.id }))
  }

  let mama, papa
  let eventoBase

  await t.test('CA-06.1 y CA-06.2: varios destinatarios por módulo, compartidos por los dueños', async () => {
    await assert.rejects(web(carla, 'public.crear_destinatario($1, $2)', [CUNA, 'Intrusa']), sinPermiso)
    await assert.rejects(web(null, 'public.crear_destinatario($1, $2)', [CUNA, 'Anónima']), sinPermiso)
    for (const nombre of ['', '   ', null]) {
      await assert.rejects(web(ana, 'public.crear_destinatario($1, $2)', [CUNA, nombre]), invalido)
    }
    mama = await web(ana, 'public.crear_destinatario($1, $2)', [CUNA, 'Mamá'])
    papa = await web(beto, 'public.crear_destinatario($1, $2)', [CUNA, 'Papá'])
    assert.equal(mama.vinculado, false)

    const deAna = await web(ana, 'public.mis_destinatarios($1)', [CUNA])
    assert.deepEqual(deAna.map((d) => d.nombre), ['Mamá', 'Papá'])
    assert.deepEqual(await web(beto, 'public.mis_destinatarios($1)', [CUNA]), deAna)
    for (const d of deAna) assert.deepEqual(Object.keys(d).sort(), ['id', 'nombre', 'vinculado'])
    await assert.rejects(web(carla, 'public.mis_destinatarios($1)', [CUNA]), sinPermiso)
    // La lista pertenece al módulo: el otro módulo no la ve.
    assert.deepEqual(await web(ana, 'public.mis_destinatarios($1)', [ALIMENTACION]), [])
  })

  await t.test('CA-06.3: el código vincula una sola vez, vence y se guarda solo su hash', async () => {
    await assert.rejects(web(carla, 'public.generar_codigo_vinculacion($1)', [mama.id]), sinPermiso)
    const { codigo, vence_en } = await web(ana, 'public.generar_codigo_vinculacion($1)', [mama.id])
    assert.equal(codigo.length, 20)
    assert.ok(new Date(vence_en).getTime() > Date.now())
    assert.equal(await contar('cuna_private.codigos_vinculacion', 'codigo_sha256 = $1', [codigo]), 0)

    for (const malo of [null, 'corto', 'x'.repeat(20)]) {
      assert.equal((await servicio('public.vincular_telegram($1, $2)', [malo, 1001])).estado, 'codigo_invalido')
    }
    const ok = await servicio('public.vincular_telegram($1, $2)', [codigo, 1001])
    assert.equal(ok.estado, 'vinculado')
    assert.equal(ok.destinatario_id, mama.id)
    assert.equal((await servicio('public.vincular_telegram($1, $2)', [codigo, 1002])).estado, 'codigo_invalido')

    // Un código nuevo invalida el anterior; un código vencido no sirve.
    const primero = (await web(beto, 'public.generar_codigo_vinculacion($1)', [papa.id])).codigo
    const segundo = (await web(beto, 'public.generar_codigo_vinculacion($1)', [papa.id])).codigo
    assert.equal((await servicio('public.vincular_telegram($1, $2)', [primero, 1002])).estado, 'codigo_invalido')
    await db.query("update cuna_private.codigos_vinculacion set vence_en = now() - interval '1 minute'")
    assert.equal((await servicio('public.vincular_telegram($1, $2)', [segundo, 1002])).estado, 'codigo_invalido')

    const tercero = (await web(beto, 'public.generar_codigo_vinculacion($1)', [papa.id])).codigo
    // La misma conversación no puede ser dos destinatarios del módulo.
    assert.equal((await servicio('public.vincular_telegram($1, $2)', [tercero, 1001])).estado, 'chat_duplicado')
    assert.equal((await servicio('public.vincular_telegram($1, $2)', [tercero, 1002])).estado, 'vinculado')

    const lista = await web(ana, 'public.mis_destinatarios($1)', [CUNA])
    assert.deepEqual(lista.map((d) => d.vinculado), [true, true])
  })

  await t.test('CA-07.1 y CA-07.3: un aviso por destinatario; el reenvío no duplica; eventos distintos se conservan', async () => {
    const primero = await ingestar()
    eventoBase = primero.id
    assert.equal(primero.r, 'creado')
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [primero.id]), 2)

    // Reenvío idéntico: no hay otra fila ni otros avisos.
    const repetido = await servicio(
      'public.ingestar_evento($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, null, null, $8::jsonb, true)',
      [primero.id, CUNA, TOKEN, 'prueba_aviso', '2026-11-18T10:00:00Z', '2026-11-18T10:00:09Z', 'Evento de prueba', '{}'])
    assert.equal(repetido, 'duplicado')
    assert.equal(await contar('public.eventos', 'event_id = $1', [primero.id]), 1)
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [primero.id]), 2)

    // Mismo event_id con otros datos: se rechaza sin tocar el original.
    assert.equal((await ingestar({ id: primero.id, descripcion: 'Otro texto' })).r, 'id_reutilizado')

    // Dos eventos distintos con la misma hora: ambos se conservan, cada uno con sus avisos.
    const gemelo = await ingestar({ ts: '2026-11-18T10:00:00Z' })
    assert.equal(gemelo.r, 'creado')
    assert.equal(await contar('public.eventos', "ts = '2026-11-18T10:00:00Z' and tipo = 'prueba_aviso'"), 2)
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [gemelo.id]), 2)

    // Sin aviso solicitado no se crea ninguno.
    const mudo = await ingestar({ avisar: false })
    assert.equal(mudo.r, 'creado')
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [mudo.id]), 0)
  })

  await t.test('credencial incorrecta, módulo ajeno y evento sin bebé asignado', async () => {
    assert.equal((await ingestar({ token: 'c'.repeat(64) })).r, 'no_autorizado')
    assert.equal((await ingestar({ token: TOKEN_ALIM })).r, 'no_autorizado')
    assert.equal((await ingestar({ ts: '2025-12-31T23:59:59Z' })).r, 'sin_asignacion')
    assert.equal(await contar('public.eventos', "ts = '2025-12-31T23:59:59Z'"), 0)
  })

  await t.test('CA-07.4: el aviso lleva solo texto, nunca datos ni imágenes', async () => {
    await ingestar({ tipo: 'foto_prueba', datos: JSON.stringify({ ruta: 'privado/foto.jpg' }), descripcion: 'Se tomó una foto' })
    const pendientes = await servicio('public.avisos_pendientes($1)', [100])
    assert.ok(pendientes.length > 0)
    for (const aviso of pendientes) {
      assert.deepEqual(Object.keys(aviso).sort(), ['aviso_id', 'chat_id', 'descripcion', 'device_id', 'tipo', 'ts'])
    }
    assert.ok(!JSON.stringify(pendientes).includes('foto.jpg'))
    // Devolver los avisos a la cola para las pruebas siguientes.
    await db.query('update cuna_private.avisos set proximo_intento_en = now() - interval \'1 second\'')
  })

  await t.test('avisos pendientes: arrendamiento, reintentos, fallo definitivo y registro de intentos', async () => {
    const primera = await servicio('public.avisos_pendientes($1)', [100])
    assert.ok(primera.length >= 2)
    assert.deepEqual(await servicio('public.avisos_pendientes($1)', [100]), [], 'reservados 2 minutos')
    await assert.rejects(servicio('public.avisos_pendientes($1)', [0]), invalido)

    const [a, b, c] = primera
    // Éxito.
    assert.equal((await servicio('public.registrar_intento_aviso($1, true)', [a.aviso_id])).estado, 'enviado')
    // Idempotente tras cerrarse.
    assert.equal((await servicio('public.registrar_intento_aviso($1, false, $2)', [a.aviso_id, 'telegram_500'])).estado, 'enviado')
    // Fallo reintentable: sigue pendiente con espera creciente.
    const f1 = await servicio('public.registrar_intento_aviso($1, false, $2, true)', [b.aviso_id, 'telegram_429'])
    assert.deepEqual([f1.estado, f1.intentos], ['pendiente', 1])
    const espera1 = (await db.query('select extract(epoch from proximo_intento_en - now())::float8 as e from cuna_private.avisos where id = $1', [b.aviso_id])).rows[0].e
    assert.ok(espera1 > 20 && espera1 <= 30, `primera espera de unos 30 s, fue ${espera1}`)
    // Fallo no reintentable: definitivo.
    assert.equal((await servicio('public.registrar_intento_aviso($1, false, $2, false)', [c.aviso_id, 'telegram_403'])).estado, 'fallido')
    // Texto de error no válido no se guarda tal cual.
    await servicio('public.registrar_intento_aviso($1, false, $2, true)', [b.aviso_id, 'Detalle <interno> con token 123:ABC'])
    const errores = (await db.query('select error from cuna_private.intentos_aviso where aviso_id = $1 order by intento_en, id', [b.aviso_id])).rows.map((r) => r.error)
    assert.deepEqual(errores, ['telegram_429', 'error_desconocido'])
    // Cinco intentos fallidos cierran el aviso.
    for (let i = 0; i < 3; i += 1) await servicio('public.registrar_intento_aviso($1, false, $2, true)', [b.aviso_id, 'telegram_500'])
    const ultimo = await servicio('public.registrar_intento_aviso($1, false, $2, true)', [b.aviso_id, 'telegram_500'])
    assert.equal(ultimo.estado, 'fallido', 'el quinto intento fallido es definitivo; el cuarto ya había pasado')
    assert.equal(await contar('cuna_private.intentos_aviso', 'aviso_id = $1', [b.aviso_id]), 5)
    await assert.rejects(servicio('public.registrar_intento_aviso($1, true)', [randomUUID()]), invalido)
  })

  await t.test('CA-06.3 y CA-34.2: retirar un destinatario evita avisos futuros y no toca a los dueños', async () => {
    const duenosAntes = await contar('cuna_private.duenos_dispositivo', 'activo')
    await assert.rejects(web(carla, 'public.retirar_destinatario($1)', [papa.id]), sinPermiso)
    await web(ana, 'public.retirar_destinatario($1)', [papa.id])
    assert.equal(await contar('cuna_private.duenos_dispositivo', 'activo'), duenosAntes)
    assert.deepEqual((await web(ana, 'public.mis_destinatarios($1)', [CUNA])).map((d) => d.nombre), ['Mamá'])
    await assert.rejects(web(ana, 'public.retirar_destinatario($1)', [papa.id]), sinPermiso)

    const nuevo = await ingestar()
    assert.equal(await contar('cuna_private.avisos', 'event_id = $1', [nuevo.id]), 1)
    // Los avisos que ya esperaban a Papá no se entregan.
    await db.query("update cuna_private.avisos set proximo_intento_en = now() - interval '1 second' where estado = 'pendiente'")
    const entregables = await servicio('public.avisos_pendientes($1)', [100])
    assert.ok(entregables.length > 0)
    assert.ok(entregables.every((a) => a.chat_id === 1001))
    // Seguía siendo dueño de la cuna.
    assert.equal((await web(beto, 'public.mis_dispositivos()')).length, 1)
  })

  await t.test('CA-22.3 y DEC-04: recordatorios a la hora exacta en America/Costa_Rica, sin horas intermedias ni vencidas', async () => {
    const dest = await web(ana, 'public.crear_destinatario($1, $2)', [ALIMENTACION, 'Cuidadora'])
    const { codigo } = await web(ana, 'public.generar_codigo_vinculacion($1)', [dest.id])
    await servicio('public.vincular_telegram($1, $2)', [codigo, 2001])

    await assert.rejects(web(carla, 'public.reemplazar_horarios($1, $2, $3::time[])', [ALIMENTACION, 'recordatorio_alimentacion', ['08:00']]), sinPermiso)
    for (const tipo of ['MAL TIPO', null]) {
      await assert.rejects(web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])', [ALIMENTACION, tipo, ['08:00']]), invalido)
    }
    const guardado = await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])',
      [ALIMENTACION, 'recordatorio_alimentacion', ['11:00', '08:00', '08:00:30']])
    assert.deepEqual(guardado, ['08:00', '11:00'])

    const procesar = (iso) => servicio('public.procesar_horarios($1::timestamptz)', [iso])
    // 14:00 UTC = 08:00 en Costa Rica.
    assert.deepEqual(await procesar('2026-11-18T14:00:00Z'), { ejecutados: 1, sin_bebe: 0 })
    // Mismo minuto otra vez: no repite.
    assert.deepEqual(await procesar('2026-11-18T14:00:30Z'), { ejecutados: 0, sin_bebe: 0 })
    // Hora intermedia (09:00 CR), hora vencida (08:05 CR) y la hora UTC equivocada (08:00 UTC): nada.
    for (const iso of ['2026-11-18T15:00:00Z', '2026-11-18T14:05:00Z', '2026-11-18T08:00:00Z']) {
      assert.deepEqual(await procesar(iso), { ejecutados: 0, sin_bebe: 0 }, iso)
    }
    // 11:00 CR.
    assert.deepEqual(await procesar('2026-11-18T17:00:00Z'), { ejecutados: 1, sin_bebe: 0 })
    // Todos los días.
    assert.deepEqual(await procesar('2026-11-19T14:00:00Z'), { ejecutados: 1, sin_bebe: 0 })

    const eventos = (await db.query("select descripcion, ts from public.eventos where tipo = 'recordatorio_alimentacion' order by ts")).rows
    assert.deepEqual(eventos.map((e) => e.ts.toISOString()), ['2026-11-18T14:00:00.000Z', '2026-11-18T17:00:00.000Z', '2026-11-19T14:00:00.000Z'])
    assert.ok(eventos.every((e) => e.descripcion === 'Recordatorio de alimentación'))
    assert.equal(await contar('cuna_private.avisos a join public.eventos e on e.event_id = a.event_id', "e.tipo = 'recordatorio_alimentacion'"), 3)

    // Quitar una hora la desactiva.
    assert.deepEqual(await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])', [ALIMENTACION, 'recordatorio_alimentacion', ['11:00']]), ['11:00'])
    assert.deepEqual(await procesar('2026-11-20T14:00:00Z'), { ejecutados: 0, sin_bebe: 0 })
    assert.deepEqual(await web(beto, 'public.mis_horarios($1, $2)', [CUNA, 'recordatorio_alimentacion']), [])
  })

  await t.test('un recordatorio sin bebé asignado no inventa un evento', async () => {
    await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-12-01T00:00:00Z', null)", [ALIMENTACION])
    await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])', [ALIMENTACION, 'recordatorio_alimentacion', ['08:00']])
    const antes = await contar('public.eventos')
    const r = await servicio('public.procesar_horarios($1::timestamptz)', ['2026-12-02T14:00:00Z'])
    assert.deepEqual(r, { ejecutados: 0, sin_bebe: 1 })
    assert.equal(await contar('public.eventos'), antes)
  })

  await t.test('CA-07.5: un aviso por episodio fuera de rango; volver al rango y salir produce otro', async () => {
    const paso = (fuera, ts) => db.query(
      "select cuna_private.actualizar_episodio($1, 'temperatura', $2, $3::timestamptz) as r", [CUNA, fuera, ts])
    const resultados = []
    for (const [fuera, ts] of [
      [false, '2026-11-18T10:00:00Z'], // dentro: nada
      [true, '2026-11-18T10:00:10Z'],  // sale: abre
      [true, '2026-11-18T10:00:20Z'],  // sigue fuera
      [true, '2026-11-18T10:00:30Z'],  // sigue fuera
      [false, '2026-11-18T10:00:40Z'], // vuelve
      [true, '2026-11-18T10:00:50Z'],  // sale otra vez: abre otro
    ]) resultados.push((await paso(fuera, ts)).rows[0].r)
    assert.deepEqual(resultados, [false, true, false, false, false, true])
    const filas = (await db.query("select cerrado_en from cuna_private.episodios where variable = 'temperatura' order by abierto_desde")).rows
    assert.equal(filas.length, 2)
    assert.equal(filas[0].cerrado_en.toISOString(), '2026-11-18T10:00:40.000Z')
    assert.equal(filas[1].cerrado_en, null)
    // Variables distintas llevan episodios distintos.
    assert.equal((await db.query("select cuna_private.actualizar_episodio($1, 'humedad', true, now()) as r", [CUNA])).rows[0].r, true)
  })

  await t.test('permisos: ningún rol de API usa las funciones de otro rol ni lee tablas privadas', async () => {
    const solo = (rol, usuario, sql, params = []) => como(rol, usuario, () => db.query(sql, params))
    for (const rol of ['authenticated', 'anon']) {
      await assert.rejects(solo(rol, ana, 'select public.avisos_pendientes(10)'), sinPermiso)
      await assert.rejects(solo(rol, ana, "select public.procesar_horarios(now())"), sinPermiso)
      await assert.rejects(solo(rol, ana, "select public.vincular_telegram('codigo-ficticio-1', 5)"), sinPermiso)
      await assert.rejects(
        solo(rol, ana, "select public.ingestar_evento($1, $2, $3, 'x_y', now(), now())", [randomUUID(), CUNA, TOKEN]), sinPermiso)
    }
    await assert.rejects(solo('service_role', null, "select public.crear_destinatario($1, 'X')", [CUNA]), sinPermiso)
    await assert.rejects(solo('authenticated', ana, 'select * from cuna_private.avisos'), sinPermiso)
    await assert.rejects(solo('authenticated', ana, 'select * from cuna_private.destinatarios_telegram'), sinPermiso)

    // RLS: la dueña lee eventos de sus módulos; una cuenta ajena, ninguno.
    assert.ok((await solo('authenticated', ana, 'select count(*)::int as n from public.eventos')).rows[0].n > 0)
    assert.equal((await solo('authenticated', carla, 'select count(*)::int as n from public.eventos')).rows[0].n, 0)
    // Sin escritura ni borrado directos.
    await assert.rejects(solo('authenticated', ana, 'delete from public.eventos'), sinPermiso)
    await assert.rejects(solo('authenticated', ana, "update public.eventos set tipo = 'otro_tipo'"), sinPermiso)
    await assert.rejects(solo('service_role', null, 'delete from public.eventos'), sinPermiso)
    assert.ok(eventoBase)
  })
})
