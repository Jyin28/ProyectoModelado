import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearBase, invalido, sinPermiso } from './_base.mjs'

const CUNA = 'cuna-ambiente-01'
const MOV = 'cuna-movimiento-01'
const HAB = 'cuna-habitacion-01'
const ALI = 'cuna-alimentacion-01'

test('Historial por bebé: separación, reasignación, intervalos, tomas y fotos (fase 10)', async (t) => {
  const { db, web, usuario, bebe, modulo, asignar, tutor, evento, lectura } = await crearBase()
  t.after(() => db.close())

  const ana = await usuario()
  const beto = await usuario()
  const carla = await usuario()
  const luna = await bebe('Luna')
  const mateo = await bebe('Mateo')

  await modulo(CUNA, 'cuna', 'cuna-01', [ana])
  await modulo(MOV, 'cuna', 'cuna-01', [ana])
  await modulo(HAB, 'habitacion', 'habitacion-01', [ana])
  await modulo(ALI, 'alimentacion', 'alimentacion-01', [ana])
  await tutor(luna, ana)
  await tutor(mateo, beto)
  // La cuna estuvo con Mateo hasta el 18 a las 12:00 UTC y desde entonces con Luna.
  await asignar(CUNA, '2026-11-01T00:00:00Z', mateo)
  await asignar(CUNA, '2026-11-18T12:00:00Z', luna)
  await asignar(MOV, '2026-11-01T00:00:00Z', luna)
  await asignar(HAB, '2026-11-01T00:00:00Z', luna)
  await asignar(ALI, '2026-11-01T00:00:00Z', luna)

  const pedir = (quien, bebeId, desde, hasta) =>
    web(quien, 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)', [bebeId, desde, hasta])

  await t.test('permisos: sesión ausente y personas ajenas se rechazan igual', async () => {
    const d = '2026-11-18T00:00:00Z'
    const h = '2026-11-19T00:00:00Z'
    await assert.rejects(pedir(null, luna, d, h), sinPermiso)
    await assert.rejects(pedir(beto, luna, d, h), sinPermiso)
    await assert.rejects(pedir(carla, luna, d, h), sinPermiso)
    await assert.rejects(pedir(ana, mateo, d, h), sinPermiso)
    await assert.rejects(pedir(ana, randomUUID(), d, h), sinPermiso)
  })

  await t.test('intervalo inválido: invertido, igual, nulo o mayor de 31 días', async () => {
    await assert.rejects(pedir(ana, luna, '2026-11-19T00:00:00Z', '2026-11-18T00:00:00Z'), invalido)
    await assert.rejects(pedir(ana, luna, '2026-11-18T00:00:00Z', '2026-11-18T00:00:00Z'), invalido)
    await assert.rejects(pedir(ana, luna, null, '2026-11-18T00:00:00Z'), invalido)
    await assert.rejects(pedir(ana, luna, '2026-10-01T00:00:00Z', '2026-11-02T00:00:00Z'), invalido)
    const r = await pedir(ana, luna, '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')
    assert.deepEqual(r.registros, [])
  })

  await t.test('intervalo sin registros devuelve lista vacía, sin inventar actividad (CA-25.4)', async () => {
    const r = await pedir(ana, luna, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z')
    assert.deepEqual(r.registros, [])
    assert.equal(r.truncado, false)
  })

  await t.test('reasignación: cada registro conserva su bebé original (CA-34.4)', async () => {
    await evento({ device: CUNA, bebe: mateo, tipo: 'prueba', ts: '2026-11-18T10:00:00Z' })
    await evento({ device: CUNA, bebe: luna, tipo: 'prueba', ts: '2026-11-18T13:00:00Z' })
    await lectura({ device: CUNA, bebe: mateo, ts: '2026-11-18T09:00:00Z', temp: 21, hum: 50 })
    await lectura({ device: CUNA, bebe: luna, ts: '2026-11-18T14:00:00Z', temp: 23, hum: 45 })

    const deLuna = await pedir(ana, luna, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z')
    const deMateo = await pedir(beto, mateo, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z')
    assert.deepEqual(deLuna.registros.map((x) => x.tipo),
      ['prueba', 'temperatura_ambiente', 'humedad_ambiente'])
    assert.deepEqual(deMateo.registros.map((x) => x.tipo),
      ['temperatura_ambiente', 'humedad_ambiente', 'prueba'])
    assert.ok(deLuna.registros.every((x) => x.bebe_id === luna))
    assert.ok(deMateo.registros.every((x) => x.bebe_id === mateo))
    // Ana ya es dueña de la cuna pero no del bebé anterior: no ve su historial.
    await assert.rejects(pedir(ana, mateo, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z'), sinPermiso)
  })

  await t.test('ambiente: una lectura son dos registros con unidad (CA-26.3)', async () => {
    const r = await pedir(ana, luna, '2026-11-18T14:00:00Z', '2026-11-18T15:00:00Z')
    assert.equal(r.registros.length, 2)
    const [temp, hum] = r.registros
    assert.deepEqual([temp.tipo, temp.valor, temp.unidad], ['temperatura_ambiente', 23, '°C'])
    assert.deepEqual([hum.tipo, hum.valor, hum.unidad], ['humedad_ambiente', 45, '% HR'])
    assert.notEqual(temp.registro_id, hum.registro_id)
  })

  await t.test('intervalo [desde, hasta): el límite superior no entra y el inferior sí', async () => {
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-17T08:15:00Z' })
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-17T08:59:00Z' })
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-17T09:00:00Z' })
    const a = await pedir(ana, luna, '2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z')
    assert.equal(a.registros.length, 2)
    const b = await pedir(ana, luna, '2026-11-17T09:00:00Z', '2026-11-17T10:00:00Z')
    assert.equal(b.registros.length, 1)
  })

  await t.test('movimiento: no se cuenta dos veces si ya está en eventos, y sí si solo está en su tabla', async () => {
    const enAmbas = randomUUID()
    const soloTabla = randomUUID()
    await evento({ id: enAmbas, device: MOV, bebe: luna, tipo: 'movimiento', ts: '2026-11-16T22:00:00Z' })
    for (const [id, ts] of [[enAmbas, '2026-11-16T22:00:00Z'], [soloTabla, '2026-11-16T22:30:00Z']]) {
      await db.query(
        'insert into public.eventos_movimiento (event_id, device_id, bebe_id, ts, recibido_en) values ($1, $2, $3, $4::timestamptz, $4::timestamptz)',
        [id, MOV, luna, ts])
    }
    const r = await pedir(ana, luna, '2026-11-16T00:00:00Z', '2026-11-17T00:00:00Z')
    assert.deepEqual(r.registros.map((x) => x.registro_id), [enAmbas, soloTabla])
  })

  await t.test('tomas: peso inicial, final, cantidad y duración salen de la toma, con la corrección (DAT-02)', async () => {
    const toma = randomUUID()
    await db.query(
      `insert into public.tomas (id, device_id, bebe_id, estado, peso_inicial_g, peso_final_g, ingerido_g,
         creada_por, creada_en, inicio, fin)
       values ($1, $2, $3, 'completa', 250, 190, 60, $4, '2026-11-15T20:00:00Z',
         '2026-11-15T20:00:00Z', '2026-11-15T20:20:00Z')`,
      [toma, ALI, luna, ana])
    await db.query(
      `insert into public.pausas_toma (id, toma_id, inicio, fin)
       values ($1, $2, '2026-11-15T20:05:00Z', '2026-11-15T20:10:00Z')`,
      [randomUUID(), toma])
    await evento({ device: ALI, bebe: luna, tipo: 'toma_iniciada', ts: '2026-11-15T20:00:00Z',
      datos: { toma_id: toma } })
    await evento({ device: ALI, bebe: luna, tipo: 'toma_completa', ts: '2026-11-15T20:20:00Z',
      valor: 60, unidad: 'g', datos: { toma_id: toma } })
    await evento({ device: ALI, bebe: luna, tipo: 'peso_alimentacion', ts: '2026-11-15T20:21:00Z',
      valor: 190, unidad: 'g' })

    const r = await pedir(ana, luna, '2026-11-15T00:00:00Z', '2026-11-16T00:00:00Z')
    const completa = r.registros.find((x) => x.tipo === 'toma_completa')
    assert.deepEqual(completa.toma, { peso_inicial_g: 250, peso_final_g: 190, cantidad_g: 60, duracion_s: 900 })
    assert.equal(completa.valor, 60)
    assert.equal(r.registros.find((x) => x.tipo === 'peso_alimentacion').toma, null)

    // Una corrección posterior cambia la cantidad guardada: el historial la refleja.
    await db.query(
      `update public.tomas set peso_final_g = 180, ingerido_g = 70 where id = $1`, [toma])
    const corregida = (await pedir(ana, luna, '2026-11-15T00:00:00Z', '2026-11-16T00:00:00Z'))
      .registros.find((x) => x.tipo === 'toma_completa')
    assert.equal(corregida.valor, 70)
    assert.equal(corregida.toma.cantidad_g, 70)
    assert.equal(corregida.toma.peso_final_g, 180)
  })

  await t.test('fotos: la ruta solo se entrega a un dueño del módulo (CA-24.6)', async () => {
    const evFoto = randomUUID()
    await evento({ id: evFoto, device: HAB, bebe: luna, tipo: 'foto_tomada', ts: '2026-11-14T03:00:00Z' })
    await db.query(
      `insert into public.fotos (event_id, device_id, bebe_id, estado, ruta, solicitada_en, resuelta_en)
       values ($1, $2, $3, 'guardada', $4, '2026-11-14T03:00:00Z', '2026-11-14T03:00:05Z')`,
      [evFoto, HAB, luna, `${HAB}/${randomUUID()}.jpg`])
    const dueno = await pedir(ana, luna, '2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z')
    assert.equal(dueno.registros[0].foto.estado, 'guardada')
    assert.match(dueno.registros[0].foto.ruta, /^cuna-habitacion-01\//)

    // Una persona que es tutora del bebé pero no dueña del módulo ve el evento sin foto.
    const tutora = await usuario()
    await tutor(luna, tutora)
    const sinFoto = await pedir(tutora, luna, '2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z')
    assert.equal(sinFoto.registros.length, 1)
    assert.equal(sinFoto.registros[0].foto, null)
  })

  await t.test('cruce de medianoche en Costa Rica: una noche 19:00-07:00 reúne ambos días', async () => {
    // 19:00 CR del 10 = 01:00 UTC del 11; 07:00 CR del 11 = 13:00 UTC del 11.
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-11T01:00:00Z' }) // 19:00 CR
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-11T05:59:00Z' }) // 23:59 CR
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-11T06:00:00Z' }) // 00:00 CR
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-11T12:59:00Z' }) // 06:59 CR
    await evento({ device: HAB, bebe: luna, tipo: 'puerta', ts: '2026-11-11T13:00:00Z' }) // 07:00 CR: fuera
    const r = await pedir(ana, luna, '2026-11-11T01:00:00Z', '2026-11-11T13:00:00Z')
    assert.equal(r.registros.length, 4)
  })

  await t.test('tope de registros: se avisa cuando la respuesta se trunca', async () => {
    await db.query(
      `insert into public.eventos (event_id, device_id, bebe_id, tipo, descripcion, ts, recibido_en)
       select gen_random_uuid(), $1, $2, 'masivo', 'masivo',
              '2026-10-05T00:00:00Z'::timestamptz + (n || ' seconds')::interval,
              '2026-10-05T00:00:00Z'::timestamptz + (n || ' seconds')::interval
       from generate_series(1, 5200) as n`, [HAB, luna])
    const r = await pedir(ana, luna, '2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z')
    assert.equal(r.registros.length, 5000)
    assert.equal(r.truncado, true)
  })

  await t.test('es de solo lectura: no cambia ninguna tabla', async () => {
    const antes = (await db.query('select count(*)::int as n from public.eventos')).rows[0].n
    await pedir(ana, luna, '2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z')
    const despues = (await db.query('select count(*)::int as n from public.eventos')).rows[0].n
    assert.equal(despues, antes)
  })
})
