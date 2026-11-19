// Medición de rendimiento (HU-30, CA-30.1 y CA-30.2) sobre PGlite.
//
// Escenario: 2 cuentas concurrentes, 2 bebés, un ejemplar de cada módulo con
// red (cuna, figuras, colchón, habitación y alimentación; el juego es local) y
// 1000 eventos. Mide:
//   - 100 consultas de historial (objetivo: al menos 95 en <= 3 s).
//   - 100 solicitudes de envío a Telegram, desde que el backend recibe el
//     evento hasta que el notificador llama al envío (objetivo: al menos 95 en
//     <= 5 s). La entrega externa de Telegram NO se mide aquí.
//
// Límites: PGlite corre en memoria, en un solo proceso y con una sola conexión,
// así que NO es el Supabase real: no hay red, ni PostgREST, ni pg_net, ni
// Telegram. Los resultados acreditan la lógica y el costo de las consultas, no
// los tiempos de la nube. Uso: npm run rendimiento (desde la carpeta supabase).
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { crearNotificador } from '../functions/notificador/handler.ts'
import { crearBase, tokenDe } from '../tests/_base.mjs'

const OBJETIVO_HISTORIAL_MS = 3000
const OBJETIVO_TELEGRAM_MS = 5000
const MINIMO_CUMPLEN = 95
const EVENTOS = 1000
const CONSULTAS = 100
const SOLICITUDES = 100
const SECRETO = 'secreto-de-prueba-solo-local'

const CUNA = 'cuna-ambiente-01'
const MOVIMIENTO = 'cuna-movimiento-01'
const FIGURAS = 'cuna-figuras-01'
const COLCHON = 'cuna-colchon-01'
const HABITACION = 'cuna-habitacion-01'
const ALIMENTACION = 'cuna-alimentacion-01'

const percentil = (valores, p) => {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)]
}
const redondear = (n) => Math.round(n * 10) / 10

const { db, web, servicio, contar, usuario, bebe, modulo, asignar, tutor } = await crearBase()
try {
  const ana = await usuario()
  const beto = await usuario()
  const luna = await bebe('Luna')
  const mateo = await bebe('Mateo')

  const modulos = [
    [CUNA, 'cuna', 'cuna-01', luna],
    [MOVIMIENTO, 'cuna', 'cuna-01', luna],
    [FIGURAS, 'figuras', 'figuras-01', luna],
    [COLCHON, 'colchon', 'colchon-01', mateo],
    [HABITACION, 'habitacion', 'habitacion-01', mateo],
    [ALIMENTACION, 'alimentacion', 'alimentacion-01', mateo],
  ]
  for (const [id, tipo, producto, bebeId] of modulos) {
    await modulo(id, tipo, producto, [ana, beto])
    await asignar(id, '2026-01-01T00:00:00Z', bebeId)
  }
  await tutor(luna, ana)
  await tutor(mateo, beto)
  await tutor(luna, beto)
  await tutor(mateo, ana)
  for (const dispositivo of [CUNA, HABITACION]) {
    await db.query(
      "insert into cuna_private.destinatarios_telegram (dispositivo_id, nombre, chat_id) values ($1, 'Mamá', 1001), ($1, 'Papá', 1002)",
      [dispositivo])
  }

  // ---- 1000 eventos por las mismas funciones que usa la Edge Function de ingesta.
  const inicio = Date.parse('2026-11-18T00:00:00Z')
  const tIngesta = performance.now()
  for (let i = 0; i < EVENTOS; i++) {
    const ts = new Date(inicio + i * 60_000).toISOString()
    if (i % 5 < 2) {
      await servicio(
        'public.ingestar_ambiente($1, $2, $3, $4::timestamptz, $4::timestamptz, $5::double precision, $6::double precision)',
        [randomUUID(), CUNA, tokenDe(CUNA), ts, 21 + (i % 7) / 2, 45 + (i % 11)])
    } else {
      const [dispositivo, tipo] = [
        [MOVIMIENTO, 'movimiento'], [HABITACION, 'puerta'], [FIGURAS, 'prueba_figuras'],
        [COLCHON, 'prueba_colchon'], [ALIMENTACION, 'peso_alimentacion'],
      ][i % 5]
      await servicio(
        'public.ingestar_evento($1, $2, $3, $4, $5::timestamptz, $5::timestamptz, $6, null, null, $7::jsonb, false)',
        [randomUUID(), dispositivo, tokenDe(dispositivo), tipo, ts, tipo, '{}'])
    }
  }
  const msIngesta = performance.now() - tIngesta
  const total = (await contar('public.eventos')) + (await contar('public.lecturas_ambiente'))
  if (total !== EVENTOS) throw new Error(`Se esperaban ${EVENTOS} registros y hay ${total}`)

  // ---- 100 consultas de historial, dos cuentas a la vez sobre dos bebés.
  const intervalo = ['2026-11-18T00:00:00Z', '2026-11-19T00:00:00Z']
  const consultas = []
  for (let i = 0; i < CONSULTAS; i += 2) {
    const par = await Promise.all([
      medir(ana, i % 4 === 0 ? luna : mateo),
      medir(beto, i % 4 === 0 ? mateo : luna),
    ])
    consultas.push(...par)
  }
  async function medir(quien, bebeId) {
    const t0 = performance.now()
    const r = await web(quien, 'public.historial_bebe($1, $2::timestamptz, $3::timestamptz)', [bebeId, ...intervalo])
    return { ms: performance.now() - t0, registros: r.registros.length }
  }
  const tiemposHistorial = consultas.map((c) => c.ms)
  const cumplenHistorial = tiemposHistorial.filter((ms) => ms <= OBJETIVO_HISTORIAL_MS).length

  // ---- 100 solicitudes de envío a Telegram (con un envío simulado, sin red).
  let llegada = 0
  const notificador = crearNotificador({
    secreto: SECRETO,
    avisosPendientes: (limite) => servicio('public.avisos_pendientes($1)', [limite]),
    registrarIntento: (id, ok, error, reintentable) =>
      servicio('public.registrar_intento_aviso($1, $2, $3, $4)', [id, ok, error, reintentable]),
    enviar: async () => {
      if (llegada === 0) llegada = performance.now()
      return { ok: true }
    },
  })
  const tiemposTelegram = []
  for (let i = 0; i < SOLICITUDES; i++) {
    llegada = 0
    const recepcion = performance.now()
    const dispositivo = i % 2 === 0 ? CUNA : HABITACION
    await servicio(
      'public.ingestar_evento($1, $2, $3, $4, now(), now(), $5, null, null, $6::jsonb, true)',
      [randomUUID(), dispositivo, tokenDe(dispositivo), 'prueba_aviso', 'Evento de rendimiento', '{}'])
    await notificador(new Request('http://localhost/n', { method: 'POST', headers: { Authorization: `Bearer ${SECRETO}` } }))
    if (llegada === 0) throw new Error('El notificador no envió el aviso')
    tiemposTelegram.push(llegada - recepcion)
  }
  const cumplenTelegram = tiemposTelegram.filter((ms) => ms <= OBJETIVO_TELEGRAM_MS).length

  const resumen = (valores) => ({
    p50: redondear(percentil(valores, 50)),
    p95: redondear(percentil(valores, 95)),
    max: redondear(Math.max(...valores)),
  })
  const informe = {
    escenario: { cuentas: 2, bebes: 2, modulos: modulos.length, eventos: EVENTOS, ingesta_total_ms: redondear(msIngesta) },
    historial: {
      consultas: CONSULTAS,
      objetivo: `>= ${MINIMO_CUMPLEN} de 100 en <= ${OBJETIVO_HISTORIAL_MS} ms`,
      cumplen: cumplenHistorial,
      ms: resumen(tiemposHistorial),
      registros_por_consulta: { min: Math.min(...consultas.map((c) => c.registros)), max: Math.max(...consultas.map((c) => c.registros)) },
      resultado: cumplenHistorial >= MINIMO_CUMPLEN ? 'cumple' : 'NO cumple',
    },
    telegram_solicitud: {
      solicitudes: SOLICITUDES,
      objetivo: `>= ${MINIMO_CUMPLEN} de 100 en <= ${OBJETIVO_TELEGRAM_MS} ms desde la recepción del evento`,
      cumplen: cumplenTelegram,
      ms: resumen(tiemposTelegram),
      resultado: cumplenTelegram >= MINIMO_CUMPLEN ? 'cumple' : 'NO cumple',
    },
    nota: 'PGlite en memoria, una conexión, sin red ni pg_net ni Telegram: no son tiempos del Supabase real.',
  }
  console.log(JSON.stringify(informe, null, 2))
  if (informe.historial.resultado !== 'cumple' || informe.telegram_solicitud.resultado !== 'cumple') {
    process.exitCode = 1
  }
} finally {
  await db.close()
}
