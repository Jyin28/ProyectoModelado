import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearBase, sinPermiso, tokenDe } from './_base.mjs'

const CUNA = 'cuna-ambiente-01'
const FIGURAS = 'cuna-figuras-01'
const HABITACION = 'cuna-habitacion-01'
const ALIMENTACION = 'cuna-alimentacion-01'
const AUDIO = 'cuna-audio-01'

test('Privacidad y acceso: permisos, revocación, reasignación y ausencia de audio (HU-34)', async (t) => {
  const { db, como, web, servicio, contar, usuario, bebe, modulo, asignar, tutor, evento, lectura } = await crearBase()
  t.after(() => db.close())

  // Ana y Beto son dueños; Carla es ajena; Dani es destinataria de Telegram de la cuna (sin cuenta de dueña).
  const ana = await usuario()
  const beto = await usuario()
  const carla = await usuario()
  const dani = await usuario()
  const luna = await bebe('Luna')
  const mateo = await bebe('Mateo')

  await modulo(CUNA, 'cuna', 'cuna-01', [ana, beto])
  await modulo(FIGURAS, 'figuras', 'figuras-01', [ana, beto])
  await modulo(HABITACION, 'habitacion', 'habitacion-01', [ana, beto])
  await modulo(ALIMENTACION, 'alimentacion', 'alimentacion-01', [ana, beto])
  await modulo(AUDIO, 'cuna', 'cuna-01', [ana, beto])
  await tutor(luna, ana)
  await tutor(mateo, ana)
  for (const id of [CUNA, FIGURAS, HABITACION, ALIMENTACION, AUDIO]) {
    await asignar(id, '2026-01-01T00:00:00Z', luna)
  }
  await db.query(
    "insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Dani', 7001)", [CUNA])

  const fotoEvento = randomUUID()
  const rutaFoto = `${HABITACION}/${randomUUID()}.jpg`
  await evento({ device: CUNA, bebe: luna, tipo: 'prueba', ts: '2026-11-18T10:00:00Z' })
  await evento({ id: fotoEvento, device: HABITACION, bebe: luna, tipo: 'foto_tomada', ts: '2026-11-18T10:05:00Z' })
  await lectura({ device: CUNA, bebe: luna, ts: '2026-11-18T10:00:00Z', temp: 22, hum: 50 })
  await db.query(
    `insert into public.fotos (event_id, device_id, bebe_id, estado, ruta, solicitada_en, resuelta_en)
     values ($1, $2, $3, 'guardada', $4, '2026-11-18T10:05:00Z', '2026-11-18T10:05:05Z')`,
    [fotoEvento, HABITACION, luna, rutaFoto])
  await db.query("insert into storage.objects (bucket_id, name) values ('fotos-habitacion', $1)", [rutaFoto])
  await db.query(
    `insert into public.tomas (id, device_id, bebe_id, estado, creada_por) values ($1, $2, $3, 'preparando', $4)`,
    [randomUUID(), ALIMENTACION, luna, ana])

  const filas = (quien, sql, params = []) =>
    como('authenticated', quien, async () => (await db.query(sql, params)).rows)

  await t.test('CA-34.1: una persona ajena no ve datos, fotos ni controles (tablas con RLS)', async () => {
    for (const tabla of ['public.eventos', 'public.lecturas_ambiente', 'public.fotos']) {
      assert.equal((await filas(ana, `select 1 from ${tabla}`)).length > 0, true, `${tabla} dueña`)
      assert.equal((await filas(carla, `select 1 from ${tabla}`)).length, 0, `${tabla} ajena`)
      assert.equal((await filas(dani, `select 1 from ${tabla}`)).length, 0, `${tabla} destinataria`)
      assert.equal((await filas(null, `select 1 from ${tabla}`)).length, 0, `${tabla} sin sesión`)
    }
  })

  await t.test('CA-34.1: una persona ajena no ve la foto en el almacén y una dueña sí', async () => {
    assert.equal((await filas(ana, "select 1 from storage.objects where bucket_id = 'fotos-habitacion'")).length, 1)
    assert.equal((await filas(beto, "select 1 from storage.objects where bucket_id = 'fotos-habitacion'")).length, 1)
    assert.equal((await filas(carla, "select 1 from storage.objects where bucket_id = 'fotos-habitacion'")).length, 0)
    assert.equal((await filas(dani, "select 1 from storage.objects where bucket_id = 'fotos-habitacion'")).length, 0)
  })

  await t.test('CA-34.1: las funciones rechazan a una persona ajena y a la destinataria', async () => {
    const intentos = [
      ['historial_bebe', 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)', [luna, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z']],
      ['mis_tomas', 'public.mis_tomas($1, 20)', [ALIMENTACION]],
      ['estado_de_modulo', 'public.estado_de_modulo($1)', [CUNA]],
      ['solicitar_orden', "public.solicitar_orden($1, $2, 'led_stop', '{}'::jsonb)", [randomUUID(), FIGURAS]],
      ['mis_horarios', "public.mis_horarios($1, 'recordatorio_alimentacion')", [ALIMENTACION]],
      ['mis_destinatarios', 'public.mis_destinatarios($1)', [CUNA]],
      ['duenos_de', 'public.duenos_de($1)', [CUNA]],
      ['mis_limites', 'public.mis_limites($1)', [CUNA]],
    ]
    for (const quien of [carla, dani]) {
      for (const [nombre, sql, params] of intentos) {
        await assert.rejects(web(quien, sql, params), sinPermiso, nombre)
      }
    }
    for (const [nombre, sql, params] of intentos) {
      await assert.rejects(web(null, sql, params), sinPermiso, `${nombre} sin sesión`)
    }
  })

  await t.test('CA-34.1: los registros no se pueden escribir ni borrar desde la API', async () => {
    const tablas = (await db.query(
      `select format('%I.%I', n.nspname, c.relname) as tabla
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'r' and n.nspname in ('public', 'cuna_private')`)).rows.map((r) => r.tabla)
    assert.ok(tablas.length >= 15, 'se esperaban las tablas del proyecto')
    for (const tabla of tablas) {
      for (const rol of ['authenticated', 'anon', 'service_role']) {
        for (const permiso of ['insert', 'update', 'delete', 'truncate']) {
          const r = await db.query('select has_table_privilege($1, $2, $3) as p', [rol, tabla, permiso])
          assert.equal(r.rows[0].p, false, `${rol} no debe poder ${permiso} en ${tabla}`)
        }
      }
    }
    for (const tabla of tablas.filter((x) => x.startsWith('cuna_private.'))) {
      for (const rol of ['authenticated', 'anon']) {
        const r = await db.query('select has_table_privilege($1, $2, $3) as p', [rol, tabla, 'select'])
        assert.equal(r.rows[0].p, false, `${rol} no debe leer ${tabla}`)
      }
    }
    for (const rol of ['anon']) {
      for (const tabla of tablas.filter((x) => x.startsWith('public.'))) {
        const r = await db.query('select has_table_privilege($1, $2, $3) as p', [rol, tabla, 'select'])
        assert.equal(r.rows[0].p, false, `${rol} no debe leer ${tabla}`)
      }
    }
  })

  await t.test('CA-34.2: ser destinataria de Telegram no da control; revocar a una dueña le quita el acceso', async () => {
    // Dani recibe avisos de la cuna pero no puede operar nada.
    await assert.rejects(web(dani, "public.solicitar_orden($1, $2, 'led_stop', '{}'::jsonb)", [randomUUID(), FIGURAS]), sinPermiso)
    assert.equal((await web(ana, 'public.mis_destinatarios($1)', [CUNA])).length, 1)
    assert.equal((await filas(dani, 'select 1 from public.eventos')).length, 0)

    // Beto ve y opera mientras es dueño.
    assert.ok((await filas(beto, 'select 1 from public.eventos')).length > 0)
    assert.equal((await web(beto, 'public.solicitar_orden($1, $2, $3, $4::jsonb)', [randomUUID(), FIGURAS, 'led_stop', '{}'])).estado, 'pendiente')
    const historialAntes = await web(beto, 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)',
      [luna, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z'])
    assert.ok(historialAntes.registros.length >= 3)

    // Ana retira a Beto de todos los módulos.
    for (const id of [CUNA, FIGURAS, HABITACION, ALIMENTACION, AUDIO]) {
      await web(ana, 'public.retirar_dueno($1, $2)', [id, beto])
    }
    for (const id of [CUNA, HABITACION]) {
      assert.equal((await filas(beto, 'select 1 from public.eventos where device_id = $1', [id])).length, 0, id)
    }
    assert.equal((await filas(beto, 'select 1 from public.lecturas_ambiente')).length, 0)
    assert.equal((await filas(beto, 'select 1 from public.fotos')).length, 0)
    assert.equal((await filas(beto, "select 1 from storage.objects where bucket_id = 'fotos-habitacion'")).length, 0)
    await assert.rejects(web(beto, "public.solicitar_orden($1, $2, 'led_stop', '{}'::jsonb)", [randomUUID(), FIGURAS]), sinPermiso)
    await assert.rejects(web(beto, 'public.mis_tomas($1, 20)', [ALIMENTACION]), sinPermiso)
    await assert.rejects(web(beto, 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)',
      [luna, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z']), sinPermiso)

    // Los registros no se borraron: Ana los sigue viendo.
    assert.ok((await filas(ana, 'select 1 from public.eventos')).length >= 2)
  })

  await t.test('CA-34.3 y CA-34.4: reasignar un módulo conserva los registros y vincula los nuevos al bebé nuevo', async () => {
    const antes = await contar('public.eventos')
    const antesLecturas = await contar('public.lecturas_ambiente')
    const r = await web(ana, 'public.asignar_dispositivo($1, $2)', [CUNA, mateo])
    assert.equal(r.cambio, true)

    const ts = new Date(Date.now() + 2000).toISOString()
    assert.equal(await servicio(
      'public.ingestar_evento($1, $2, $3, $4, $5::timestamptz, $5::timestamptz, $6, null, null, $7::jsonb, false)',
      [randomUUID(), CUNA, tokenDe(CUNA), 'prueba_nueva', ts, 'Después de reasignar', '{}']), 'creado')

    // Nada se borró ni cambió de dueño de bebé.
    assert.equal(await contar('public.eventos'), antes + 1)
    assert.equal(await contar('public.lecturas_ambiente'), antesLecturas)
    assert.equal(await contar('public.eventos', "tipo = 'prueba' and bebe_id = $1", [luna]), 1)
    assert.equal(await contar('public.eventos', "tipo = 'prueba_nueva' and bebe_id = $1", [mateo]), 1)
    assert.equal(await contar('public.lecturas_ambiente', 'bebe_id = $1', [luna]), 1)

    // El historial de cada bebé muestra lo suyo.
    const intervalo = ['2026-11-18T00:00:00Z', new Date(Date.now() + 86400000).toISOString()]
    const deLuna = await web(ana, 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)', [luna, ...intervalo])
    const deMateo = await web(ana, 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)', [mateo, ...intervalo])
    assert.ok(deLuna.registros.some((x) => x.tipo === 'prueba'))
    assert.ok(!deLuna.registros.some((x) => x.tipo === 'prueba_nueva'))
    assert.deepEqual(deMateo.registros.map((x) => x.tipo), ['prueba_nueva'])
  })

  await t.test('CA-34.5: no se guarda audio ni voz: solo la actividad permitida', async () => {
    // Ninguna columna del esquema puede guardar sonido.
    const binarias = await db.query(
      `select table_schema, table_name, column_name from information_schema.columns
       where table_schema in ('public', 'cuna_private') and data_type = 'bytea'`)
    assert.deepEqual(binarias.rows, [])

    // Una sesión de voz deja solo dos registros de actividad, sin datos.
    const inicio = randomUUID()
    const fin = randomUUID()
    assert.equal((await web(ana, 'public.registrar_actividad_voz($1, $2, $3)', [inicio, AUDIO, 'inicio'])).resultado, 'creado')
    assert.equal((await web(ana, 'public.registrar_actividad_voz($1, $2, $3)', [fin, AUDIO, 'fin'])).resultado, 'creado')
    const voz = (await db.query("select tipo, valor, unidad, datos from public.eventos where tipo like 'voz\\_%' order by tipo")).rows
    assert.deepEqual(voz, [
      { tipo: 'voz_fin', valor: null, unidad: null, datos: {} },
      { tipo: 'voz_inicio', valor: null, unidad: null, datos: {} },
    ])
    // Los fragmentos de voz viajan por difusión de Realtime y no se persisten.
    assert.equal(await contar('realtime.messages', "topic like 'realtime:voz:%' or event = 'voz'"), 0)
    // Una persona ajena no puede registrar actividad de voz.
    await assert.rejects(web(carla, 'public.registrar_actividad_voz($1, $2, $3)', [randomUUID(), AUDIO, 'inicio']), sinPermiso)
  })
})
