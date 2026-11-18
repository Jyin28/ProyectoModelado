import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { crearEnviarTelegram, secretosIguales } from '../functions/_shared/telegram.ts'
import { crearNotificador, textoAviso } from '../functions/notificador/handler.ts'
import { AYUDA, crearWebhookTelegram } from '../functions/telegram-webhook/handler.ts'

const TOKEN_BOT = '123456789:AAF-token-ficticio-solo-de-prueba'
const SECRETO = 'secreto-de-prueba-notificador'
const CUNA = 'cuna-ambiente-01'
const TOKEN = 'a'.repeat(64)

test('cliente de Telegram: solo texto, errores fijos y sin filtrar el token', async (t) => {
  const llamadas = []
  const con = (respuesta) =>
    crearEnviarTelegram(TOKEN_BOT, async (url, init) => {
      llamadas.push({ url, init })
      if (respuesta instanceof Error) throw respuesta
      return respuesta
    })

  await t.test('envía JSON de solo texto y reporta éxito', async () => {
    const r = await con(new Response('{"ok":true}', { status: 200 }))(1001, 'Hola')
    assert.deepEqual(r, { ok: true })
    const { url, init } = llamadas.at(-1)
    assert.equal(url, `https://api.telegram.org/bot${TOKEN_BOT}/sendMessage`)
    assert.deepEqual(JSON.parse(init.body), { chat_id: 1001, text: 'Hola', disable_web_page_preview: true })
    assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(), ['chat_id', 'disable_web_page_preview', 'text'])
  })

  await t.test('clasifica los errores sin guardar el texto de Telegram', async () => {
    const casos = [
      [403, 'telegram_403', false],
      [400, 'telegram_400', false],
      [429, 'telegram_429', true],
      [502, 'telegram_502', true],
    ]
    for (const [status, error, reintentable] of casos) {
      const r = await con(new Response(`{"description":"detalle con ${TOKEN_BOT}"}`, { status }))(1, 'x')
      assert.deepEqual(r, { ok: false, error, reintentable })
    }
    const red = await con(new Error(`fallo con ${TOKEN_BOT}`))(1, 'x')
    assert.deepEqual(red, { ok: false, error: 'red', reintentable: true })
    assert.ok(!JSON.stringify([red]).includes(TOKEN_BOT))
  })

  await t.test('compara secretos sin aceptar vacíos ni longitudes distintas', () => {
    assert.equal(secretosIguales('abc', 'abc'), true)
    assert.equal(secretosIguales('abc', 'abd'), false)
    assert.equal(secretosIguales('abc', 'abcd'), false)
    assert.equal(secretosIguales('', ''), false)
  })
})

test('webhook de Telegram: vincula con /start y valida su secreto', async (t) => {
  const respuestas = []
  const vinculaciones = []
  const crear = (estado = 'vinculado') =>
    crearWebhookTelegram({
      secreto: 'secreto-webhook',
      vincular: async (codigo, chatId) => {
        vinculaciones.push([codigo, chatId])
        return { estado, nombre: 'Mamá' }
      },
      responder: async (chatId, texto) => {
        respuestas.push([chatId, texto])
        return { ok: true }
      },
    })
  const actualizacion = (texto, chat = { id: 1001, type: 'private' }) => ({ message: { text: texto, chat } })
  const enviar = (webhook, cuerpo, secreto = 'secreto-webhook', metodo = 'POST') =>
    webhook(new Request('http://localhost/telegram-webhook', {
      method: metodo,
      headers: { 'X-Telegram-Bot-Api-Secret-Token': secreto },
      body: metodo === 'POST' ? (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) : undefined,
    }))
  const reiniciar = () => { respuestas.length = 0; vinculaciones.length = 0 }

  await t.test('rechaza secreto ausente o incorrecto y métodos distintos de POST', async () => {
    assert.equal((await enviar(crear(), actualizacion('/start abcdefgh12'), 'otro')).status, 401)
    assert.equal((await enviar(crear(), actualizacion('/start abcdefgh12'), '')).status, 401)
    assert.equal((await enviar(crear(), '', 'secreto-webhook', 'GET')).status, 405)
    assert.deepEqual(vinculaciones, [])
  })

  await t.test('/start con código vincula el chat y responde', async () => {
    reiniciar()
    const r = await enviar(crear(), actualizacion('/start abcdefgh12345678'))
    assert.equal(r.status, 200)
    assert.deepEqual(vinculaciones, [['abcdefgh12345678', 1001]])
    assert.match(respuestas[0][1], /Listo, Mamá/)
  })

  await t.test('código inválido o chat repetido responden sin vincular de nuevo', async () => {
    reiniciar()
    await enviar(crear('codigo_invalido'), actualizacion('/start abcdefgh12345678'))
    assert.match(respuestas[0][1], /no es válido o ya venció/)
    reiniciar()
    await enviar(crear('chat_duplicado'), actualizacion('/start@MiBot abcdefgh12345678'))
    assert.match(respuestas[0][1], /ya recibe/)
  })

  await t.test('/start sin código da ayuda; otros mensajes, grupos y basura se ignoran con 200', async () => {
    reiniciar()
    await enviar(crear(), actualizacion('/start'))
    assert.deepEqual(respuestas, [[1001, AYUDA]])
    reiniciar()
    for (const cuerpo of [
      actualizacion('hola'),
      actualizacion('/start abcdefgh12345678', { id: -500, type: 'group' }),
      actualizacion('/start corto'),
      actualizacion('/start abc def ghi jkl mno'),
      { edited_message: {} },
      '{no es json',
      '[]',
    ]) {
      assert.equal((await enviar(crear(), cuerpo)).status, 200)
    }
    assert.deepEqual(respuestas, [])
    assert.deepEqual(vinculaciones, [])
  })

  await t.test('un cuerpo enorme se ignora y un fallo del backend se responde sin filtrar', async () => {
    reiniciar()
    assert.equal((await enviar(crear(), 'x'.repeat(20000))).status, 200)
    assert.deepEqual(vinculaciones, [])
    const roto = crearWebhookTelegram({
      secreto: 'secreto-webhook',
      vincular: async () => { throw new Error('detalle interno con token') },
      responder: async (chatId, texto) => { respuestas.push([chatId, texto]); return { ok: true } },
    })
    assert.equal((await enviar(roto, actualizacion('/start abcdefgh12345678'))).status, 200)
    assert.match(respuestas[0][1], /No pude completar/)
    assert.ok(!respuestas[0][1].includes('interno'))
  })
})

test('notificador: texto, autenticación, reintentos y recorrido completo con la base', async (t) => {
  await t.test('el texto sale de tipo y descripción, en hora de Costa Rica, sin datos del evento', () => {
    const base = { aviso_id: 'a', chat_id: 1, device_id: CUNA, ts: '2026-11-18T14:00:00Z' }
    const texto = textoAviso({ ...base, tipo: 'movimiento', descripcion: 'Movimiento detectado' })
    assert.match(texto, /Movimiento detectado/)
    assert.match(texto, /08:00:00/)
    assert.match(texto, /hora de Costa Rica/)
    assert.match(textoAviso({ ...base, tipo: 'puerta_abierta', descripcion: null }), /puerta abierta/)
    assert.match(textoAviso({ ...base, ts: 'no-es-fecha', tipo: 'x_y', descripcion: null }), /hora desconocida/)
  })

  await t.test('exige POST y el secreto compartido antes de tocar la base', async () => {
    let consultas = 0
    const notificador = crearNotificador({
      secreto: SECRETO,
      avisosPendientes: async () => { consultas += 1; return [] },
      registrarIntento: async () => {},
      enviar: async () => ({ ok: true }),
    })
    const llamar = (metodo, credencial) => notificador(new Request('http://localhost/notificador', {
      method: metodo,
      headers: credencial === undefined ? {} : { Authorization: `Bearer ${credencial}` },
    }))
    assert.equal((await llamar('GET', SECRETO)).status, 405)
    assert.equal((await llamar('POST')).status, 401)
    assert.equal((await llamar('POST', 'otro')).status, 401)
    assert.equal(consultas, 0)
    const ok = await llamar('POST', SECRETO)
    assert.equal(ok.status, 200)
    assert.deepEqual(await ok.json(), { recibidos: 0, enviados: 0, fallidos: 0, sin_registrar: 0 })
  })

  await t.test('un fallo de la base responde 503 y un envío no registrado se cuenta aparte', async () => {
    const aviso = { aviso_id: 'a-1', chat_id: 5, tipo: 'x_y', descripcion: 'Algo', ts: '2026-11-18T14:00:00Z', device_id: CUNA }
    const sinBase = crearNotificador({
      secreto: SECRETO,
      avisosPendientes: async () => { throw new Error('caída') },
      registrarIntento: async () => {},
      enviar: async () => ({ ok: true }),
    })
    const peticion = () => new Request('http://localhost/n', { method: 'POST', headers: { Authorization: `Bearer ${SECRETO}` } })
    assert.equal((await sinBase(peticion())).status, 503)

    const sinRegistro = crearNotificador({
      secreto: SECRETO,
      avisosPendientes: async () => [aviso],
      registrarIntento: async () => { throw new Error('caída') },
      enviar: async () => ({ ok: true }),
    })
    assert.deepEqual(await (await sinRegistro(peticion())).json(), { recibidos: 1, enviados: 0, fallidos: 0, sin_registrar: 1 })

    // Presupuesto de tiempo agotado: lo pendiente queda reservado en la base.
    let reloj = 0
    const lento = crearNotificador({
      secreto: SECRETO,
      ahora: () => { reloj += 15_000; return reloj },
      avisosPendientes: async () => [aviso, { ...aviso, aviso_id: 'a-2' }, { ...aviso, aviso_id: 'a-3' }],
      registrarIntento: async () => {},
      enviar: async () => ({ ok: true }),
    })
    const r = await (await lento(peticion())).json()
    assert.ok(r.enviados < 3)
  })

  await t.test('recorrido completo: evento, avisos por destinatario, reintento y registro de intentos', async () => {
    const db = new PGlite()
    t.after(() => db.close())
    const dueno = randomUUID()
    const bebe = randomUUID()
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    `)
    for (const archivo of ['20261111000100_lecturas_ambiente.sql', '20261118000100_cuentas_propiedad.sql', '20261118000200_avisos_telegram.sql']) {
      await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
    }
    await db.query('insert into auth.users values ($1, $2)', [dueno, 'dueno@example.com'])
    await db.query("insert into cuna_private.bebes (id, nombre) values ($1, 'Luna')", [bebe])
    await db.query("insert into cuna_private.dispositivos (id, token_sha256) values ($1, $2)", [CUNA, TOKEN])
    await db.query("insert into cuna_private.asignaciones_bebe values ($1, '2026-01-01T00:00:00Z', $2)", [CUNA, bebe])
    await db.query(`
      insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values
        ($1, 'Mamá', 1001), ($1, 'Papá', 1002)
    `, [CUNA])

    const servicio = async (sql, params = []) => {
      await db.exec('set role service_role')
      try { return (await db.query(`select ${sql} as r`, params)).rows[0].r } finally { await db.exec('reset role') }
    }
    const idEvento = randomUUID()
    assert.equal(await servicio(
      "public.ingestar_evento($1, $2, $3, 'movimiento', '2026-11-18T14:00:00Z'::timestamptz, now(), 'Movimiento detectado', null, null, '{\"ruta\":\"privado/foto.jpg\"}'::jsonb, true)",
      [idEvento, CUNA, TOKEN]), 'creado')

    const enviados = []
    let fallaPapa = true
    const notificador = crearNotificador({
      secreto: SECRETO,
      avisosPendientes: (limite) => servicio('public.avisos_pendientes($1)', [limite]),
      registrarIntento: (id, ok, error, reintentable) =>
        servicio('public.registrar_intento_aviso($1, $2, $3, $4)', [id, ok, error, reintentable]),
      enviar: async (chatId, texto) => {
        enviados.push([chatId, texto])
        if (chatId === 1002 && fallaPapa) return { ok: false, error: 'telegram_429', reintentable: true }
        return { ok: true }
      },
    })
    const correr = async () => (await notificador(new Request('http://localhost/n', {
      method: 'POST', headers: { Authorization: `Bearer ${SECRETO}` } }))).json()

    // Primera pasada: Mamá recibe; Papá falla y queda pendiente.
    assert.deepEqual(await correr(), { recibidos: 2, enviados: 1, fallidos: 1, sin_registrar: 0 })
    assert.deepEqual(enviados.map(([chat]) => chat).sort(), [1001, 1002])
    for (const [, texto] of enviados) {
      assert.match(texto, /Movimiento detectado/)
      assert.match(texto, /08:00:00/)
      assert.ok(!texto.includes('foto.jpg'), 'el aviso no incluye datos del evento')
    }
    // Segunda pasada inmediata: nada que enviar (Papá espera su reintento).
    assert.deepEqual(await correr(), { recibidos: 0, enviados: 0, fallidos: 0, sin_registrar: 0 })

    // Al vencer la espera, Papá recibe una sola vez y Mamá no recibe otra copia.
    fallaPapa = false
    await db.query("update cuna_private.avisos set proximo_intento_en = now() - interval '1 second' where estado = 'pendiente'")
    assert.deepEqual(await correr(), { recibidos: 1, enviados: 1, fallidos: 0, sin_registrar: 0 })
    // La primera pasada no tiene orden definido (comparten marca de tiempo);
    // lo que importa es que Papá recibe una sola vez más y Mamá no repite.
    assert.deepEqual(enviados.slice(0, 2).map(([chat]) => chat).sort(), [1001, 1002])
    assert.deepEqual(enviados.slice(2).map(([chat]) => chat), [1002])

    const estados = (await db.query('select d.nombre, a.estado, a.intentos from cuna_private.avisos a join cuna_private.destinatarios_telegram d on d.id = a.destinatario_id order by d.nombre')).rows
    assert.deepEqual(estados, [
      { nombre: 'Mamá', estado: 'enviado', intentos: 1 },
      { nombre: 'Papá', estado: 'enviado', intentos: 2 },
    ])
    const intentos = (await db.query('select ok, error from cuna_private.intentos_aviso order by intento_en, id')).rows
    assert.equal(intentos.length, 3)
    assert.deepEqual(intentos.filter((i) => !i.ok), [{ ok: false, error: 'telegram_429' }])
    assert.deepEqual(await correr(), { recibidos: 0, enviados: 0, fallidos: 0, sin_registrar: 0 })
  })
})
