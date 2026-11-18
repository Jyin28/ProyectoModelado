import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearBase, invalido, sinPermiso, tokenDe } from './_base.mjs'

const AMBIENTE = 'cuna-ambiente-01'
const MOVIMIENTO = 'cuna-movimiento-01'
const LAMPARA = 'cuna-lampara-01'
const FIGURAS = 'cuna-figuras-01'
const COLCHON = 'cuna-colchon-01'
const HABITACION = 'cuna-habitacion-01'
const ALIMENTACION = 'cuna-alimentacion-01'

test('Recuperación: estado informado al conectar, episodios fuera de orden y recordatorios (fase 11)', async (t) => {
  const base = await crearBase()
  const { db, web, servicio, contar, usuario, bebe, modulo, asignar, cuentaDispositivo } = base
  t.after(() => db.close())

  const ana = await usuario()
  const carla = await usuario()
  const picoCuna = await usuario()
  const picoColchon = await usuario()
  const picoHabitacion = await usuario()
  const picoFiguras = await usuario()
  const luna = await bebe('Luna')

  await modulo(AMBIENTE, 'cuna', 'cuna-01', [ana])
  await modulo(MOVIMIENTO, 'cuna', 'cuna-01', [ana])
  await modulo(LAMPARA, 'cuna', 'cuna-01', [ana])
  await modulo(FIGURAS, 'figuras', 'figuras-01', [ana])
  await modulo(COLCHON, 'colchon', 'colchon-01', [ana])
  await modulo(HABITACION, 'habitacion', 'habitacion-01', [ana])
  await modulo(ALIMENTACION, 'alimentacion', 'alimentacion-01', [ana])
  for (const id of [AMBIENTE, MOVIMIENTO, LAMPARA, FIGURAS, COLCHON, HABITACION, ALIMENTACION]) {
    await asignar(id, '2026-01-01T00:00:00Z', luna)
  }
  await cuentaDispositivo(picoCuna, LAMPARA)
  await cuentaDispositivo(picoColchon, COLCHON)
  await cuentaDispositivo(picoHabitacion, HABITACION)
  await cuentaDispositivo(picoFiguras, FIGURAS)

  const reportar = (quien, estado) => web(quien, 'public.reportar_estado_modulo($1::jsonb)', [JSON.stringify(estado)])
  const estadoDe = (dispositivo) => web(ana, 'public.estado_de_modulo($1)', [dispositivo])
  const fijar = (dispositivo, estado) => db.query(
    `insert into cuna_private.estado_modulo (dispositivo_id, estado, actualizado_en)
     values ($1, $2::jsonb, '2026-11-18T10:00:00Z')
     on conflict (dispositivo_id) do update set estado = excluded.estado`,
    [dispositivo, JSON.stringify(estado)])
  const movimiento = (id, ts) => servicio(
    'public.ingestar_movimiento($1, $2, $3, $4::timestamptz, $5::timestamptz)',
    [id, MOVIMIENTO, tokenDe(MOVIMIENTO), ts, ts])

  await t.test('CA-28.3: tras reiniciar, el monitoreo de movimiento figura apagado y el servidor lo respeta', async () => {
    await fijar(MOVIMIENTO, { monitoreo: true })
    assert.equal(await movimiento(randomUUID(), '2026-11-18T11:00:00Z'), 'creado')

    // La Pico arranca con todo apagado y lo informa al conectarse.
    assert.deepEqual(await reportar(picoCuna, { monitoreo: false }), { actualizados: 1 })
    assert.equal((await estadoDe(MOVIMIENTO)).estado.monitoreo, false)
    assert.equal(await movimiento(randomUUID(), '2026-11-18T11:05:00Z'), 'monitoreo_inactivo')
    assert.equal(await contar('public.eventos_movimiento'), 1)

    // Un monitoreo que sigue activo en la Pico (solo se cayó la red) también se informa.
    await reportar(picoCuna, { monitoreo: true })
    assert.equal(await movimiento(randomUUID(), '2026-11-18T11:10:00Z'), 'creado')
  })

  await t.test('la habitación informa el monitoreo de cada sensor', async () => {
    await fijar(HABITACION, { monitoreo_puerta: true, monitoreo_movimiento: true })
    assert.deepEqual(await reportar(picoHabitacion, { monitoreo_puerta: false, monitoreo_movimiento: true }), { actualizados: 2 })
    const { estado } = await estadoDe(HABITACION)
    assert.equal(estado.monitoreo_puerta, false)
    assert.equal(estado.monitoreo_movimiento, true)
  })

  await t.test('las figuras informan que no hay secuencia en marcha', async () => {
    await fijar(FIGURAS, { secuencia: 'arcoiris' })
    await reportar(picoFiguras, { secuencia: null })
    assert.equal((await estadoDe(FIGURAS)).estado.secuencia, null)
    await reportar(picoFiguras, { secuencia: 'ola_suave' })
    assert.equal((await estadoDe(FIGURAS)).estado.secuencia, 'ola_suave')
  })

  await t.test('CA-28.3 y CA-28.4: un colchón informado detenido se muestra detenido y exige rearme', async () => {
    await fijar(COLCHON, { colchon: 'activo', referencia_g: 8000, colchon_ts: '2026-11-18T09:00:00Z' })
    await reportar(picoColchon, { colchon: 'detenido' })
    const { estado } = await estadoDe(COLCHON)
    assert.equal(estado.colchon, 'detenido')
    assert.equal(estado.motivo, 'reinicio')

    // Un evento de parada anterior que llega después precisa el motivo real.
    const fijarEstado = (tipo, datos, ts) => db.query(
      'select cuna_private.fijar_estado_colchon($1, $2, $3::jsonb, $4::timestamptz)',
      [COLCHON, tipo, JSON.stringify(datos), ts])
    await fijarEstado('colchon_detenido', { motivo: 'wifi' }, '2026-11-18T09:45:00Z')
    assert.equal((await estadoDe(COLCHON)).estado.motivo, 'wifi')

    // Si ya figuraba detenido con su motivo, informar detenido no lo pisa.
    await reportar(picoColchon, { colchon: 'detenido' })
    assert.equal((await estadoDe(COLCHON)).estado.motivo, 'wifi')

    // Informar «activo» no cambia nada: lo fija su propio evento de armado.
    await fijar(COLCHON, { colchon: 'activo', referencia_g: 8000 })
    assert.deepEqual(await reportar(picoColchon, { colchon: 'activo' }), { actualizados: 0 })
    assert.equal((await estadoDe(COLCHON)).estado.colchon, 'activo')
  })

  await t.test('cada Pico solo cambia los módulos de su producto', async () => {
    await fijar(COLCHON, { colchon: 'activo' })
    await fijar(MOVIMIENTO, { monitoreo: true })
    // La Pico de la cuna no tiene un colchón en su producto: no lo toca.
    assert.deepEqual(await reportar(picoCuna, { colchon: 'detenido' }), { actualizados: 0 })
    assert.equal((await estadoDe(COLCHON)).estado.colchon, 'activo')
    // La del colchón no toca el monitoreo de movimiento de la cuna.
    assert.deepEqual(await reportar(picoColchon, { monitoreo: false }), { actualizados: 0 })
    assert.equal((await estadoDe(MOVIMIENTO)).estado.monitoreo, true)
  })

  await t.test('solo una cuenta de dispositivo puede informar su estado', async () => {
    await assert.rejects(reportar(ana, { monitoreo: false }), sinPermiso)
    await assert.rejects(reportar(carla, { monitoreo: false }), sinPermiso)
    await assert.rejects(reportar(null, { monitoreo: false }), sinPermiso)
    await assert.rejects(servicio('public.reportar_estado_modulo($1::jsonb)', ['{"monitoreo":false}']), /permission denied|42501/)
  })

  await t.test('rechaza claves y valores que no son del contrato', async () => {
    for (const malo of [
      { monitoreo: 'si' },
      { monitoreo: 1 },
      { monitoreo: null },
      { desconocida: true },
      { secuencia: 'Arcoiris' },
      { secuencia: 7 },
      { secuencia: 'x'.repeat(41) },
      { colchon: 'raro' },
      { colchon: null },
      { monitoreo: true, monitoreo_puerta: true, monitoreo_movimiento: true, secuencia: null, colchon: 'activo', extra: 1 },
      [],
      'texto',
      null,
    ]) {
      await assert.rejects(reportar(picoCuna, malo), invalido, JSON.stringify(malo))
    }
  })

  await t.test('un estado inválido no cambia nada, ni siquiera lo válido que lo acompaña', async () => {
    await fijar(MOVIMIENTO, { monitoreo: true })
    await assert.rejects(reportar(picoCuna, { monitoreo: false, colchon: 'raro' }), invalido)
    assert.equal((await estadoDe(MOVIMIENTO)).estado.monitoreo, true)
  })

  // ------------------------------------------------ episodios fuera de orden
  await t.test('CA-07.5: una lectura atrasada no cierra ni reabre un episodio', async () => {
    await web(ana, 'public.guardar_limites($1, $2::double precision, $3::double precision, $4::double precision, $5::double precision)',
      [AMBIENTE, 20, 26, 40, 60])
    await db.query("insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001)", [AMBIENTE])
    const lectura = (ts, temperatura) => servicio(
      'public.ingestar_ambiente($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::double precision, $7::double precision)',
      [randomUUID(), AMBIENTE, tokenDe(AMBIENTE), ts, ts, temperatura, 50])
    const fuera = () => contar('public.eventos', "tipo = 'ambiente_fuera_rango'")
    const episodios = async () => (await db.query(
      "select abierto_desde, cerrado_en from cuna_private.episodios where dispositivo_id = $1 and variable = 'temperatura' order by abierto_desde", [AMBIENTE])).rows

    assert.equal(await lectura('2026-11-18T12:00:00Z', 23), 'creado')
    assert.equal(await lectura('2026-11-18T12:10:00Z', 30), 'creado') // abre
    assert.equal(await fuera(), 1)

    // Llega tarde una lectura normal de ANTES de abrirse el episodio: no lo cierra.
    assert.equal(await lectura('2026-11-18T12:05:00Z', 23), 'creado')
    let filas = await episodios()
    assert.equal(filas.length, 1)
    assert.equal(filas[0].cerrado_en, null)

    // Vuelve a rango de verdad: cierra con su propia hora.
    assert.equal(await lectura('2026-11-18T12:20:00Z', 23), 'creado')
    filas = await episodios()
    assert.equal(new Date(filas[0].cerrado_en).toISOString(), '2026-11-18T12:20:00.000Z')

    // Llega tarde una lectura fuera de rango de ANTES del cierre: no reabre ni avisa de nuevo.
    assert.equal(await lectura('2026-11-18T12:15:00Z', 31), 'creado')
    assert.equal((await episodios()).length, 1)
    assert.equal(await fuera(), 1)

    // Una lectura nueva fuera de rango sí abre otro episodio y avisa.
    assert.equal(await lectura('2026-11-18T12:30:00Z', 31), 'creado')
    assert.equal((await episodios()).length, 2)
    assert.equal(await fuera(), 2)
  })

  // --------------------------------------------------- orden de los avisos
  await t.test('los avisos de un mismo evento salen siempre en el orden de sus destinatarios', async () => {
    await db.query("insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Papá', 5002)", [AMBIENTE])
    await db.query("update cuna_private.avisos set estado = 'enviado'")
    for (let i = 0; i < 12; i++) {
      await servicio(
        'public.ingestar_evento($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, null, null, $8::jsonb, true)',
        [randomUUID(), AMBIENTE, tokenDe(AMBIENTE), 'prueba_orden', '2026-11-18T13:00:00Z', '2026-11-18T13:00:01Z', 'Evento', '{}'])
      const pendientes = await servicio('public.avisos_pendientes(20)')
      assert.deepEqual(pendientes.map((a) => a.chat_id), [5001, 5002], `vuelta ${i}`)
      await db.query("update cuna_private.avisos set estado = 'enviado'")
    }
  })

  // ------------------------------------------------------- recordatorios
  await t.test('CA-28.3: los recordatorios vencidos se omiten y el siguiente horario futuro se ejecuta una vez', async () => {
    await db.query("insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001)", [ALIMENTACION])
    await web(ana, 'public.reemplazar_horarios($1, $2, $3::time[])', [ALIMENTACION, 'recordatorio_alimentacion', ['08:00']])
    const recordatorios = () => contar('public.eventos', "tipo = 'recordatorio_alimentacion'")
    const procesar = (ts) => servicio('public.procesar_horarios($1::timestamptz)', [ts])

    // Corte entre las 07:30 y las 09:30 (hora de CR): las 08:00 se pierden y no se recuperan.
    assert.equal((await procesar('2026-11-18T15:30:00Z')).ejecutados, 0) // 09:30 CR
    assert.equal(await recordatorios(), 0)

    // El día siguiente a las 08:00 CR se ejecuta una sola vez.
    assert.equal((await procesar('2026-11-19T14:00:00Z')).ejecutados, 1)
    assert.equal((await procesar('2026-11-19T14:00:30Z')).ejecutados, 0)
    assert.equal(await recordatorios(), 1)

    // Tres días sin servicio no generan tres recordatorios al volver.
    assert.equal((await procesar('2026-11-22T20:00:00Z')).ejecutados, 0)
    assert.equal(await recordatorios(), 1)
  })
})
