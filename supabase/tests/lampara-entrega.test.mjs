import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const lampara = 'cuna-lampara-01'
const lampara2 = 'cuna-lampara-02'
const sinPermiso = { code: '42501' }
const invalido = { code: '22023' }
const noEnviable = { code: '55000' }
const conflicto = { code: '23505' }
const restriccion = { code: '23514' }
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('Entrega y confirmación de lámpara (fase local 2)', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const [dueño, dueño2, pico, pico2, picoSinVinculo] = Array.from({ length: 5 }, () => randomUUID())

  // Stubs mínimos de Supabase: auth y realtime.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema realtime;
    create table realtime.messages (
      id uuid primary key default gen_random_uuid(),
      topic text not null,
      extension text not null,
      payload jsonb,
      event text,
      private boolean default false,
      inserted_at timestamptz not null default now()
    );
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$
      select nullif(current_setting('realtime.topic', true), '')
    $$;
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language sql as $$
      insert into realtime.messages (topic, extension, payload, event, private)
      values (topic, 'broadcast', payload, event, private)
    $$;
    grant usage on schema realtime to authenticated, anon;
    grant select, insert on realtime.messages to authenticated;
  `)
  for (const archivo of [
    '20261111000100_lecturas_ambiente.sql',
    '20261111000200_comandos_lampara.sql',
    '20261111000300_entrega_lampara.sql',
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${archivo}`, import.meta.url), 'utf8'))
  }

  // Fixture: el alta real de cuentas y módulos es una fase posterior.
  await db.query('insert into auth.users values ($1), ($2), ($3), ($4), ($5)',
    [dueño, dueño2, pico, pico2, picoSinVinculo])
  await db.query('insert into cuna_private.dispositivos (id, token_sha256) values ($1, $2), ($3, $4)',
    [lampara, '1'.repeat(64), lampara2, '3'.repeat(64)])
  await db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2), ($3, $4)',
    [lampara, dueño, lampara2, dueño2])
  await db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2), ($3, $4)',
    [pico, lampara, pico2, lampara2])

  async function como(rol, usuario, consultar) {
    await db.exec(`set role ${rol}`)
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario ?? ''])
      return await consultar()
    } finally {
      await db.exec('reset role')
    }
  }

  const solicitar = (usuario, id, modulo, nivel) => como('authenticated', usuario,
    () => db.query('select * from public.solicitar_lampara($1, $2, $3::numeric)', [id, modulo, nivel]))
  const tomar = async (usuario, rol = 'authenticated') =>
    (await como(rol, usuario, () => db.query('select public.tomar_orden_lampara() as r'))).rows[0].r
  const confirmar = async (usuario, id, ok, nivel, error, rol = 'authenticated') =>
    (await como(rol, usuario, () => db.query(
      'select public.confirmar_orden_lampara($1, $2, $3::numeric, $4) as r', [id, ok, nivel, error]))).rows[0].r
  const fila = async (id) =>
    (await db.query('select * from public.ordenes_lampara where command_id = $1', [id])).rows[0]
  const senales = async () =>
    (await db.query("select * from realtime.messages where extension = 'broadcast' order by inserted_at, id")).rows
  // Lo que ve un cliente Realtime: el tópico se fija por sesión y las políticas filtran.
  const veCanal = (rol, usuario, topico) => como(rol, usuario, async () => {
    await db.query("select set_config('realtime.topic', $1, false)", [topico])
    try {
      // Sin WHERE: el aislamiento por tópico lo aporta solo la política.
      return (await db.query('select * from realtime.messages')).rows
    } finally {
      await db.query("select set_config('realtime.topic', '', false)")
    }
  })
  // Envejece una orden como administrador conservando todas las invariantes.
  const envejecer = (id, segundos = 20) => db.query(`
    update public.ordenes_lampara set
      creado_en = creado_en - make_interval(secs => $2::double precision),
      vence_en = vence_en - make_interval(secs => $2::double precision),
      entregado_en = entregado_en - make_interval(secs => $2::double precision),
      confirmado_en = confirmado_en - make_interval(secs => $2::double precision)
    where command_id = $1`, [id, segundos])
  const limpiar = async () => {
    await db.exec('delete from public.ordenes_lampara; delete from realtime.messages')
  }

  await t.test('señal privada una sola vez, sin datos de la orden', async () => {
    await limpiar()
    const id = randomUUID()
    await solicitar(dueño, id, lampara, '40')
    let lista = await senales()
    assert.equal(lista.length, 1)
    assert.equal(lista[0].topic, `lampara:${lampara}`)
    assert.equal(lista[0].event, 'orden_disponible')
    assert.equal(lista[0].private, true)
    assert.deepEqual(lista[0].payload, { command_id: id })

    await solicitar(dueño, id, lampara, '40.0') // reenvío idempotente
    // dueño2 está autorizado en lampara2, pero el UUID es global y ya se usó.
    await assert.rejects(solicitar(dueño2, id, lampara2, '40'), conflicto)
    // Usuario no autorizado en el módulo: 42501 aunque el command_id exista.
    await assert.rejects(solicitar(dueño2, id, lampara, '40'), sinPermiso)
    await assert.rejects(solicitar(picoSinVinculo, id, lampara, '40'), sinPermiso)
    await assert.rejects(solicitar(dueño, id, lampara, '41'), conflicto)
    await assert.rejects(solicitar(dueño, randomUUID(), lampara, '101'), invalido)
    lista = await senales()
    assert.equal(lista.length, 1)
  })

  await t.test('ACL del canal por tópico y rol; nadie publica', async () => {
    await limpiar()
    await solicitar(dueño, randomUUID(), lampara, '10')
    await solicitar(dueño2, randomUUID(), lampara2, '20')
    await db.query(`insert into realtime.messages (topic, extension, payload) values ($1, 'presence', '{}')`,
      [`lampara:${lampara}`])

    assert.equal((await veCanal('authenticated', pico, `lampara:${lampara}`)).length, 1)
    assert.equal((await veCanal('authenticated', pico2, `lampara:${lampara2}`)).length, 1)
    // Tópico ajeno, inexacto o con otra forma.
    for (const topico of [`lampara:${lampara2}`, `lampara:${lampara} `, 'lampara:cuna-lampara-0',
      `Lampara:${lampara}`, lampara, `lampara:${lampara}:x`, `%`]) {
      assert.equal((await veCanal('authenticated', pico, topico)).length, 0, topico)
    }
    assert.equal((await veCanal('authenticated', pico2, `lampara:${lampara}`)).length, 0)
    // Cuidadores, cuentas sin vínculo, sin sesión y otros roles.
    assert.equal((await veCanal('authenticated', dueño, `lampara:${lampara}`)).length, 0)
    assert.equal((await veCanal('authenticated', picoSinVinculo, `lampara:${lampara}`)).length, 0)
    assert.equal((await veCanal('authenticated', null, `lampara:${lampara}`)).length, 0)
    await assert.rejects(veCanal('anon', pico, `lampara:${lampara}`), sinPermiso)
    await assert.rejects(veCanal('service_role', pico, `lampara:${lampara}`), sinPermiso)

    // Vínculo o módulo inactivos cierran el canal.
    await db.query('update cuna_private.cuentas_dispositivo set activo = false where usuario_id = $1', [pico])
    assert.equal((await veCanal('authenticated', pico, `lampara:${lampara}`)).length, 0)
    await db.query('update cuna_private.cuentas_dispositivo set activo = true where usuario_id = $1', [pico])
    await db.query('update cuna_private.dispositivos set activo = false where id = $1', [lampara])
    assert.equal((await veCanal('authenticated', pico, `lampara:${lampara}`)).length, 0)
    await db.query('update cuna_private.dispositivos set activo = true where id = $1', [lampara])
    assert.equal((await veCanal('authenticated', pico, `lampara:${lampara}`)).length, 1)

    // Sin permiso de publicar.
    const antes = (await db.query('select count(*)::int as n from realtime.messages')).rows[0].n
    for (const usuario of [pico, dueño]) {
      await como('authenticated', usuario, () => assert.rejects(
        db.query(`insert into realtime.messages (topic, extension, payload, event, private)
          values ($1, 'broadcast', '{}', 'orden_disponible', true)`, [`lampara:${lampara}`]), sinPermiso))
    }
    assert.equal((await db.query('select count(*)::int as n from realtime.messages')).rows[0].n, antes)
  })

  await t.test('el vínculo es privado, sin permisos de API ni cuenta de cuidador', async () => {
    for (const rol of ['authenticated', 'anon', 'service_role']) {
      await como(rol, pico, async () => {
        await assert.rejects(db.query('select * from cuna_private.cuentas_dispositivo'), sinPermiso, rol)
        await assert.rejects(db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)',
          [picoSinVinculo, lampara]), sinPermiso, rol)
        await assert.rejects(db.query('update cuna_private.cuentas_dispositivo set device_id = $1', [lampara2]), sinPermiso, rol)
      })
    }
    // Ni siquiera un administrador puede mezclar los dos roles.
    await assert.rejects(db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)',
      [dueño, lampara]), restriccion)
    await assert.rejects(db.query('insert into cuna_private.duenos_dispositivo (dispositivo_id, usuario_id) values ($1, $2)',
      [lampara, pico]), restriccion)
    await assert.rejects(db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)',
      [picoSinVinculo, 'cuna-ambiente-01']), restriccion) // solo módulos de lámpara
    // Un módulo tiene una sola cuenta de dispositivo.
    await assert.rejects(db.query('insert into cuna_private.cuentas_dispositivo (usuario_id, device_id) values ($1, $2)',
      [picoSinVinculo, lampara]), conflicto)
    // La cuenta del dispositivo no es cuidador.
    await assert.rejects(solicitar(pico, randomUUID(), lampara, '30'), sinPermiso)
    const lectura = await como('authenticated', pico, () => db.query('select * from public.ordenes_lampara'))
    assert.deepEqual(lectura.rows, [])
  })

  await t.test('entrega única de la última orden, sin datos del solicitante', async () => {
    await limpiar()
    assert.equal(await tomar(pico), null)
    const id = randomUUID()
    await solicitar(dueño, id, lampara, '40')
    const entrega = await tomar(pico)
    assert.deepEqual(Object.keys(entrega).sort(), ['command', 'command_id', 'params', 'vence_en'])
    assert.equal(entrega.command_id, id)
    assert.equal(entrega.command, 'lamp_set')
    assert.deepEqual(entrega.params, { level: 40 })
    const guardada = await fila(id)
    assert.equal(new Date(entrega.vence_en).getTime(), guardada.vence_en.getTime())
    assert.equal(guardada.estado, 'enviado')
    assert.ok(guardada.entregado_en >= guardada.creado_en && guardada.entregado_en <= guardada.vence_en)
    assert.ok(!JSON.stringify(entrega).includes(dueño))

    // Sin segunda entrega, ni por reenvío idempotente de la solicitud.
    assert.equal(await tomar(pico), null)
    await solicitar(dueño, id, lampara, '40')
    assert.equal(await tomar(pico), null)
    assert.equal((await senales()).length, 1)
    assert.equal((await fila(id)).estado, 'enviado')

    // El cuidador ve el estado por su RLS.
    const vista = await como('authenticated', dueño, () => db.query('select estado from public.ordenes_lampara where command_id = $1', [id]))
    assert.equal(vista.rows[0].estado, 'enviado')
  })

  await t.test('solo se entrega la última; nunca una anterior ni una vencida', async () => {
    await limpiar()
    const a = randomUUID()
    const b = randomUUID()
    await solicitar(dueño, a, lampara, '10')
    await pausa(5)
    await solicitar(dueño, b, lampara, '90')
    assert.equal((await tomar(pico)).command_id, b)
    assert.equal((await fila(a)).estado, 'pendiente')
    assert.equal(await tomar(pico), null) // A no se recupera
    assert.equal((await fila(a)).estado, 'pendiente')

    // Reconexión: la última venció sin tomarse.
    await limpiar()
    const c = randomUUID()
    await solicitar(dueño, c, lampara, '55')
    await envejecer(c)
    assert.equal(await tomar(pico), null)
    assert.equal((await fila(c)).estado, 'pendiente')

    // Última ya confirmada o con error.
    await limpiar()
    const d = randomUUID()
    await solicitar(dueño, d, lampara, '25')
    await tomar(pico)
    await confirmar(pico, d, true, '25', null)
    assert.equal(await tomar(pico), null)
    const e = randomUUID()
    await pausa(5)
    await solicitar(dueño, e, lampara, '26')
    await tomar(pico)
    await confirmar(pico, e, false, null, 'fuera_de_rango:level')
    assert.equal(await tomar(pico), null)

    // Una orden nueva necesita otro UUID y se entrega.
    const nueva = randomUUID()
    await pausa(5)
    await solicitar(dueño, nueva, lampara, '26')
    assert.equal((await tomar(pico)).command_id, nueva)
  })

  await t.test('aislamiento entre dos dispositivos y rechazos de identidad', async () => {
    await limpiar()
    const uno = randomUUID()
    const dos = randomUUID()
    await solicitar(dueño, uno, lampara, '11')
    await solicitar(dueño2, dos, lampara2, '22')
    assert.equal((await tomar(pico2)).command_id, dos)
    assert.equal((await tomar(pico)).command_id, uno)
    assert.deepEqual((await senales()).map((s) => s.topic).sort(),
      [`lampara:${lampara}`, `lampara:${lampara2}`])

    // Una cuenta ajena o desconocida recibe el mismo error que una orden inexistente.
    const mensajes = []
    for (const id of [dos, randomUUID()]) {
      const error = await confirmar(pico, id, true, '22', null).catch((e) => e)
      assert.equal(error.code, '42501')
      mensajes.push(error.message)
    }
    assert.equal(mensajes[0], mensajes[1])
    assert.equal((await fila(dos)).estado, 'enviado')

    // Sin vínculo, cuidador, anon, service_role y sin sesión.
    for (const [usuario, rol] of [[picoSinVinculo, 'authenticated'], [dueño, 'authenticated'],
      [null, 'authenticated'], [pico, 'anon'], [pico, 'service_role']]) {
      await assert.rejects(tomar(usuario, rol), sinPermiso, `${rol} ${usuario}`)
      await assert.rejects(confirmar(usuario, uno, true, '11', null, rol), sinPermiso, `${rol} ${usuario}`)
    }
    // Vínculo o módulo inactivos.
    await db.query('update cuna_private.cuentas_dispositivo set activo = false where usuario_id = $1', [pico])
    await assert.rejects(tomar(pico), sinPermiso)
    await assert.rejects(confirmar(pico, uno, true, '11', null), sinPermiso)
    await db.query('update cuna_private.cuentas_dispositivo set activo = true where usuario_id = $1', [pico])
    await db.query('update cuna_private.dispositivos set activo = false where id = $1', [lampara])
    await assert.rejects(tomar(pico), sinPermiso)
    await db.query('update cuna_private.dispositivos set activo = true where id = $1', [lampara])
    assert.equal((await fila(uno)).estado, 'enviado')
  })

  await t.test('confirmación válida, idempotente y de error', async () => {
    await limpiar()
    const id = randomUUID()
    await solicitar(dueño, id, lampara, '70')
    await tomar(pico)
    const respuesta = await confirmar(pico, id, true, '70.0', null)
    assert.deepEqual(Object.keys(respuesta).sort(), ['command_id', 'confirmado_en', 'estado'])
    assert.equal(respuesta.estado, 'confirmado')
    const guardada = await fila(id)
    assert.equal(guardada.estado, 'confirmado')
    assert.equal(guardada.nivel_confirmado, 70)
    assert.equal(new Date(respuesta.confirmado_en).getTime(), guardada.confirmado_en.getTime())
    assert.ok(guardada.confirmado_en >= guardada.entregado_en)

    // Idéntica: misma respuesta, también después de vencer.
    await pausa(5)
    assert.deepEqual(await confirmar(pico, id, true, '70', null), respuesta)
    await envejecer(id)
    const envejecida = await fila(id)
    const repetida = await confirmar(pico, id, true, '70', null)
    assert.equal(repetida.command_id, id)
    assert.equal(repetida.estado, envejecida.estado)
    assert.equal(new Date(repetida.confirmado_en).getTime(), envejecida.confirmado_en.getTime())
    assert.deepEqual(await fila(id), envejecida) // repetir no cambia la fila
    // Distinta: falla sin mutar.
    const antes = await fila(id)
    await assert.rejects(confirmar(pico, id, true, '71', null), conflicto)
    await assert.rejects(confirmar(pico, id, false, null, 'fallo'), conflicto)
    assert.deepEqual(await fila(id), antes)

    // Error normalizado.
    await limpiar()
    const err = randomUUID()
    await solicitar(dueño, err, lampara, '80')
    await tomar(pico)
    const r = await confirmar(pico, err, false, null, 'fuera_de_rango:level')
    assert.equal(r.estado, 'error')
    const conError = await fila(err)
    assert.equal(conError.error, 'fuera_de_rango:level')
    assert.equal(conError.nivel_confirmado, null)
    assert.deepEqual(await confirmar(pico, err, false, null, 'fuera_de_rango:level'), r)
    await assert.rejects(confirmar(pico, err, false, null, 'otro_error'), conflicto)
    await assert.rejects(confirmar(pico, err, true, '80', null), conflicto)
    assert.deepEqual(await fila(err), conError)
  })

  await t.test('rechaza confirmaciones incorrectas, tardías o sin entrega sin mutar', async () => {
    await limpiar()
    const id = randomUUID()
    await solicitar(dueño, id, lampara, '60')
    // Sin entrega previa.
    await assert.rejects(confirmar(pico, id, true, '60', null), noEnviable)
    assert.equal((await fila(id)).estado, 'pendiente')
    await tomar(pico)
    const enviada = await fila(id)

    const largo = 'a'.repeat(81)
    const malas = [
      [true, '61', null, '22023'], [true, '60.5', null, '22023'], [true, '-1', null, '22023'],
      [true, '101', null, '22023'], [true, 'NaN', null, '22023'], [true, 'Infinity', null, '22023'],
      [true, null, null, '22023'], [true, '60', 'algo', '22023'], [null, '60', null, '22023'],
      [false, '60', 'fallo', '22023'], [false, null, null, '22023'], [false, null, '', '22023'],
      [false, null, 'Mayus', '22023'], [false, null, 'con espacio', '22023'], [false, null, largo, '22023'],
      [false, null, 'linea\n', '22023'],
    ]
    for (const [ok, nivel, error, codigo] of malas) {
      await assert.rejects(confirmar(pico, id, ok, nivel, error), { code: codigo }, JSON.stringify([ok, nivel, error]))
    }
    await assert.rejects(confirmar(pico, null, true, '60', null), invalido)
    assert.deepEqual(await fila(id), enviada)

    // Falsificada por el cuidador o por otros roles.
    await assert.rejects(confirmar(dueño, id, true, '60', null), sinPermiso)
    await como('authenticated', dueño, async () => {
      await assert.rejects(db.exec(`update public.ordenes_lampara set estado = 'confirmado'`), sinPermiso)
    })
    assert.deepEqual(await fila(id), enviada)

    // Tardía: vence después de entregarse.
    await envejecer(id)
    const vencida = await fila(id)
    await assert.rejects(confirmar(pico, id, true, '60', null), noEnviable)
    await assert.rejects(confirmar(pico, id, false, null, 'fallo'), noEnviable)
    assert.deepEqual(await fila(id), vencida)
    assert.equal(vencida.estado, 'enviado') // sin-respuesta se deriva de vence_en
  })

  await t.test('las restricciones de la tabla impiden estados incoherentes', async () => {
    await limpiar()
    const id = randomUUID()
    await solicitar(dueño, id, lampara, '33')
    const incoherentes = [
      `estado = 'enviado'`,
      `estado = 'confirmado', entregado_en = creado_en, confirmado_en = creado_en, nivel_confirmado = 34`,
      `estado = 'confirmado', entregado_en = creado_en, confirmado_en = creado_en`,
      `estado = 'error', entregado_en = creado_en, confirmado_en = creado_en, error = 'MAL'`,
      `estado = 'error', entregado_en = creado_en, confirmado_en = creado_en`,
      `estado = 'enviado', entregado_en = creado_en - interval '1 second'`,
      `estado = 'enviado', entregado_en = vence_en + interval '1 second'`,
      `estado = 'pendiente', entregado_en = creado_en`,
      `estado = 'otro'`,
      `estado = 'confirmado', entregado_en = creado_en + interval '2 seconds', confirmado_en = creado_en + interval '1 second', nivel_confirmado = 33`,
    ]
    for (const cambio of incoherentes) {
      await assert.rejects(db.exec(`update public.ordenes_lampara set ${cambio}`), restriccion, cambio)
    }
    assert.equal((await fila(id)).estado, 'pendiente')
    // Las solicitudes nuevas conservan estado inicial y vigencia de 15 s.
    const nueva = (await solicitar(dueño, randomUUID(), lampara, '5')).rows[0]
    assert.equal(nueva.estado, 'pendiente')
    assert.equal(nueva.vence_en.getTime() - nueva.creado_en.getTime(), 15000)
    assert.equal(nueva.entregado_en, null)
    assert.equal(nueva.confirmado_en, null)
  })
})
