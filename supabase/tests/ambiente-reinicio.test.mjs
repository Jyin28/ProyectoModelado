// Aviso por Telegram si la cuna se enciende (o recupera la conexión) ya fuera de
// rango: un episodio abierto de antes no puede dejar la cuna sin avisar.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { crearBase, tokenDe } from './_base.mjs'

const AMBIENTE = 'cuna-ambiente-01'

test('ambiente: reiniciar fuera de rango avisa de nuevo, sin repetir mientras las lecturas son seguidas', async (t) => {
  const { db, web, servicio, contar, usuario, bebe, modulo, asignar } = await crearBase()
  t.after(() => db.close())

  const ana = await usuario()
  const luna = await bebe('Luna')
  await modulo(AMBIENTE, 'cuna', 'cuna-01', [ana])
  await asignar(AMBIENTE, '2026-01-01T00:00:00Z', luna)
  // Rango: 20–26 °C y 40–60 % de humedad.
  await web(ana, 'public.guardar_limites($1, $2::double precision, $3::double precision, $4::double precision, $5::double precision)',
    [AMBIENTE, 20, 26, 40, 60])
  await db.query("insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 5001)", [AMBIENTE])

  const lectura = (ts, temperatura, humedad = 50) => servicio(
    'public.ingestar_ambiente($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::double precision, $7::double precision)',
    [randomUUID(), AMBIENTE, tokenDe(AMBIENTE), ts, ts, temperatura, humedad])
  const fuera = (variable) => contar('public.eventos',
    "tipo = 'ambiente_fuera_rango' and datos ->> 'variable' = $1", [variable])
  const avisos = () => contar('cuna_private.avisos')
  const episodios = async (variable) => (await db.query(
    'select abierto_desde, cerrado_en from cuna_private.episodios where dispositivo_id = $1 and variable = $2 order by abierto_desde',
    [AMBIENTE, variable])).rows

  await t.test('lecturas seguidas fuera de rango: un solo aviso por episodio', async () => {
    assert.equal(await lectura('2026-11-19T05:00:00Z', 30), 'creado') // abre y avisa
    assert.equal(await lectura('2026-11-19T05:00:02Z', 30), 'creado')
    assert.equal(await lectura('2026-11-19T05:00:04Z', 31), 'creado')
    assert.equal(await lectura('2026-11-19T05:01:04Z', 31), 'creado') // 60 s justos: aún no es un corte
    assert.equal(await fuera('temperatura'), 1)
    assert.equal(await avisos(), 1)
    assert.equal((await episodios('temperatura')).length, 1)
  })

  await t.test('se apaga fuera de rango y al encender sigue fuera: cierra el episodio viejo, abre otro y avisa', async () => {
    // La cuna estuvo apagada (última lectura 05:01:04) y vuelve 12 horas después.
    assert.equal(await lectura('2026-11-19T17:30:00Z', 30), 'creado')
    const filas = await episodios('temperatura')
    assert.equal(filas.length, 2)
    assert.equal(new Date(filas[0].cerrado_en).toISOString(), '2026-11-19T05:01:04.000Z')
    assert.equal(filas[1].cerrado_en, null)
    assert.equal(await fuera('temperatura'), 2)
    assert.equal(await avisos(), 2)

    // Siguen llegando lecturas seguidas: no se repite.
    assert.equal(await lectura('2026-11-19T17:30:02Z', 30), 'creado')
    assert.equal(await lectura('2026-11-19T17:30:04Z', 32), 'creado')
    assert.equal(await avisos(), 2)
  })

  await t.test('cada variable se evalúa por separado', async () => {
    // Tras otro corte la temperatura vuelve a rango pero la humedad sigue fuera.
    assert.equal(await lectura('2026-11-19T18:00:00Z', 23, 70), 'creado')
    assert.equal(await fuera('temperatura'), 2) // volver a rango no avisa
    assert.equal(await fuera('humedad'), 1)
    const temp = await episodios('temperatura')
    assert.equal(new Date(temp[1].cerrado_en).toISOString(), '2026-11-19T18:00:00.000Z') // cierre normal
    assert.equal((await episodios('humedad')).length, 1)
  })

  await t.test('corte con la humedad ya abierta: solo se reinicia la variable que sigue fuera', async () => {
    const antes = await avisos()
    // Otro corte; vuelve con humedad fuera (sigue) y temperatura fuera (nueva).
    assert.equal(await lectura('2026-11-19T20:00:00Z', 30, 70), 'creado')
    assert.equal((await episodios('humedad')).length, 2)
    assert.equal(await fuera('humedad'), 2)
    assert.equal((await episodios('temperatura')).length, 3)
    assert.equal(await fuera('temperatura'), 3)
    assert.equal(await avisos(), antes + 2)
  })

  await t.test('una lectura atrasada no reinicia ni avisa', async () => {
    const antes = await avisos()
    // Llega tarde una lectura de ANTES de la última: tiene lecturas posteriores, no es "al encender".
    assert.equal(await lectura('2026-11-19T19:00:00Z', 31, 70), 'creado')
    assert.equal(await avisos(), antes)
    assert.equal((await episodios('temperatura')).length, 3)
  })

  await t.test('vuelve en rango tras un corte: no avisa y el cierre es el normal', async () => {
    const antes = await avisos()
    assert.equal(await lectura('2026-11-20T08:00:00Z', 22, 50), 'creado')
    assert.equal(await avisos(), antes)
    const temp = await episodios('temperatura')
    assert.equal(new Date(temp.at(-1).cerrado_en).toISOString(), '2026-11-20T08:00:00.000Z')
  })
})
