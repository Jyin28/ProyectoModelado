import { describe, expect, it } from 'vitest'
import { COLUMNAS_EXCEL, type RegistroHistorial } from '../src/models/historial.ts'
import { hojaDeFilas, nombreArchivo } from '../src/utils/excel.ts'
import {
  conteoPorHora,
  filasExcel,
  reducirSerie,
  resumirNoche,
  seriesMedicion,
  UMBRAL_HUECO_MS,
} from '../src/utils/historial.ts'
import { crAUtc, fechaYHoraCR, intervaloNoche, MS_POR_HORA } from '../src/utils/tiempo.ts'

const BEBE = 'bebe-luna'

function reg(extra: Partial<RegistroHistorial> & { ts: string; tipo: string }): RegistroHistorial {
  return {
    registro_id: `${extra.tipo}-${extra.ts}`,
    bebe_id: BEBE,
    device_id: 'cuna-habitacion-01',
    descripcion: null,
    valor: null,
    unidad: null,
    toma: null,
    foto: null,
    ...extra,
  }
}

// Instante UTC de una hora de reloj de Costa Rica (08:00 CR = 14:00 UTC).
const CR = (hhmm: string, dia = '2026-11-18') => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.parse(`${dia}T00:00:00Z`) + ((h + 6) * 60 + m) * 60000).toISOString()
}

describe('Tiempo en Costa Rica', () => {
  it('convierte fecha y hora de CR a UTC (UTC-6, sin horario de verano)', () => {
    expect(crAUtc('2026-11-18', '19:00')).toBe(Date.parse('2026-11-19T01:00:00Z'))
    expect(crAUtc('2026-07-01', '00:00')).toBe(Date.parse('2026-07-01T06:00:00Z'))
  })

  it('rechaza fechas y horas inexistentes', () => {
    expect(crAUtc('2026-02-31', '10:00')).toBeNull()
    expect(crAUtc('2026-11-18', '24:00')).toBeNull()
    expect(crAUtc('2026-11-18', '10:60')).toBeNull()
    expect(crAUtc('18/11/2026', '10:00')).toBeNull()
    expect(crAUtc('2026-11-18', '9:00')).toBeNull()
  })

  it('fechaYHoraCR devuelve la fecha civil de CR aunque en UTC sea otro día', () => {
    expect(fechaYHoraCR('2026-11-19T03:30:15Z')).toEqual({ fecha: '2026-11-18', hora: '21:30:15' })
    expect(fechaYHoraCR('no es fecha')).toBeNull()
  })

  it('una noche de 19:00 a 07:00 cruza la medianoche y dura 12 horas', () => {
    const r = intervaloNoche('2026-11-18', '19:00', '07:00')
    expect(r).toEqual({
      desde: Date.parse('2026-11-19T01:00:00Z'),
      hasta: Date.parse('2026-11-19T13:00:00Z'),
    })
    expect((r!.hasta - r!.desde) / MS_POR_HORA).toBe(12)
  })

  it('si el fin es posterior al inicio, no cruza la medianoche', () => {
    const r = intervaloNoche('2026-11-18', '08:00', '12:30')
    expect(r!.hasta - r!.desde).toBe(4.5 * MS_POR_HORA)
  })

  it('un fin igual al inicio abarca 24 horas', () => {
    const r = intervaloNoche('2026-11-18', '10:00', '10:00')
    expect(r!.hasta - r!.desde).toBe(24 * MS_POR_HORA)
  })

  it('intervaloNoche devuelve null con datos inválidos', () => {
    expect(intervaloNoche('', '19:00', '07:00')).toBeNull()
    expect(intervaloNoche('2026-11-18', '', '07:00')).toBeNull()
  })
})

describe('Eventos por hora (CA-26.3 y CA-26.4)', () => {
  const intervalo = {
    desde: crAUtc('2026-11-18', '08:00')!,
    hasta: crAUtc('2026-11-18', '11:00')!,
  }

  it('08:15 y 08:59 cuentan en [08:00, 09:00); 09:00 cuenta en [09:00, 10:00)', () => {
    const cubos = conteoPorHora(
      [
        reg({ tipo: 'puerta', ts: CR('08:15') }),
        reg({ tipo: 'puerta', ts: CR('08:59') }),
        reg({ tipo: 'puerta', ts: CR('09:00') }),
      ],
      intervalo,
    )
    expect(cubos.map((c) => c.eventos)).toEqual([2, 1, 0])
    expect(cubos[0].inicio).toBe(crAUtc('2026-11-18', '08:00'))
  })

  it('el límite superior del intervalo no entra', () => {
    const cubos = conteoPorHora([reg({ tipo: 'puerta', ts: CR('11:00') })], intervalo)
    expect(cubos).toHaveLength(3)
    expect(cubos.every((c) => c.eventos === 0 && c.estado === 'sin_datos')).toBe(true)
  })

  it('distingue una hora sin datos de una con mediciones y cero eventos', () => {
    const cubos = conteoPorHora(
      [
        reg({ tipo: 'temperatura_ambiente', ts: CR('09:30'), valor: 22, unidad: '°C' }),
        reg({ tipo: 'puerta', ts: CR('10:10') }),
      ],
      intervalo,
    )
    expect(cubos.map((c) => [c.estado, c.eventos])).toEqual([
      ['sin_datos', 0],
      ['con_datos', 0],
      ['con_datos', 1],
    ])
  })

  it('las mediciones no se cuentan como eventos', () => {
    const cubos = conteoPorHora(
      [reg({ tipo: 'humedad_ambiente', ts: CR('08:10'), valor: 50, unidad: '% HR' })],
      intervalo,
    )
    expect(cubos[0]).toMatchObject({ estado: 'con_datos', eventos: 0 })
  })

  it('un intervalo vacío o invertido no produce horas', () => {
    expect(conteoPorHora([], { desde: 10, hasta: 10 })).toEqual([])
  })

  it('cuenta por tipo dentro de cada hora', () => {
    const cubos = conteoPorHora(
      [reg({ tipo: 'puerta', ts: CR('08:05') }), reg({ tipo: 'movimiento_habitacion', ts: CR('08:06') })],
      intervalo,
    )
    expect(cubos[0].porTipo).toEqual({ puerta: 1, movimiento_habitacion: 1 })
  })
})

describe('Series de medición', () => {
  it('ordena por tiempo y corta la línea ante un hueco (CA-26.4)', () => {
    const a = Date.parse(CR('08:00'))
    const series = seriesMedicion([
      reg({ tipo: 'temperatura_ambiente', ts: new Date(a + 60_000).toISOString(), valor: 22, unidad: '°C' }),
      reg({ tipo: 'temperatura_ambiente', ts: new Date(a).toISOString(), valor: 21, unidad: '°C' }),
      reg({
        tipo: 'temperatura_ambiente',
        ts: new Date(a + 60_000 + UMBRAL_HUECO_MS + 1).toISOString(),
        valor: 23,
        unidad: '°C',
      }),
    ])
    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({ tipo: 'temperatura_ambiente', unidad: '°C', total: 3 })
    expect(series[0].puntos.map((p) => p.valor)).toEqual([21, 22, null, 23])
  })

  it('separa una serie por tipo y deja fuera los eventos', () => {
    const series = seriesMedicion([
      reg({ tipo: 'temperatura_ambiente', ts: CR('08:00'), valor: 21, unidad: '°C' }),
      reg({ tipo: 'humedad_ambiente', ts: CR('08:00'), valor: 50, unidad: '% HR' }),
      reg({ tipo: 'puerta', ts: CR('08:00') }),
    ])
    expect(series.map((s) => [s.tipo, s.unidad])).toEqual([
      ['temperatura_ambiente', '°C'],
      ['humedad_ambiente', '% HR'],
    ])
  })

  it('reducirSerie conserva el mínimo y el máximo', () => {
    const puntos = Array.from({ length: 2000 }, (_, i) => ({ t: i * 1000, valor: i === 700 ? 99 : i === 1200 ? -5 : 20 }))
    const reducida = reducirSerie(puntos, 100)
    expect(reducida.length).toBeLessThanOrEqual(110)
    expect(reducida.some((p) => p.valor === 99)).toBe(true)
    expect(reducida.some((p) => p.valor === -5)).toBe(true)
    expect(reducida.map((p) => p.t)).toEqual([...reducida.map((p) => p.t)].sort((x, y) => x - y))
  })

  it('reducirSerie no toca una serie corta', () => {
    const puntos = [{ t: 1, valor: 1 }, { t: 2, valor: 2 }]
    expect(reducirSerie(puntos, 100)).toEqual(puntos)
  })
})

describe('Resumen de noche (CA-25.4)', () => {
  const intervalo = intervaloNoche('2026-11-18', '19:00', '07:00')!

  it('sin registros devuelve null: no se inventa actividad', () => {
    expect(resumirNoche([], intervalo)).toBeNull()
  })

  it('cuenta movimientos, hora de más actividad, rangos y tomas', () => {
    const resumen = resumirNoche(
      [
        reg({ tipo: 'movimiento', ts: CR('22:10') }),
        reg({ tipo: 'movimiento', ts: CR('22:40') }),
        reg({ tipo: 'movimiento_habitacion', ts: CR('23:05') }),
        reg({ tipo: 'temperatura_ambiente', ts: CR('22:00'), valor: 21, unidad: '°C' }),
        reg({ tipo: 'temperatura_ambiente', ts: CR('23:00'), valor: 24.5, unidad: '°C' }),
        reg({
          tipo: 'toma_completa',
          ts: CR('21:00'),
          valor: 60,
          unidad: 'g',
          toma: { peso_inicial_g: 250, peso_final_g: 190, cantidad_g: 60, duracion_s: 900 },
        }),
        reg({ tipo: 'foto_tomada', ts: CR('23:05') }),
      ],
      intervalo,
    )!
    expect(resumen.totalRegistros).toBe(7)
    expect(resumen.movimientos).toBe(3)
    expect(resumen.horaMasActiva).toEqual({ inicio: crAUtc('2026-11-18', '22:00'), movimientos: 2 })
    expect(resumen.temperatura).toEqual({ minimo: 21, maximo: 24.5, unidad: '°C' })
    expect(resumen.humedad).toBeNull()
    expect(resumen.tomas).toEqual({ cantidad: 1, gramos: 60 })
    expect(resumen.fotos).toBe(1)
    expect(resumen.eventosPorTipo.find((e) => e.tipo === 'movimiento')).toEqual({ tipo: 'movimiento', cantidad: 2 })
    expect(resumen.eventosPorTipo.some((e) => e.tipo === 'temperatura_ambiente')).toBe(false)
  })

  it('sin movimientos no hay hora de mayor actividad', () => {
    const resumen = resumirNoche([reg({ tipo: 'puerta', ts: CR('22:00') })], intervalo)!
    expect(resumen.movimientos).toBe(0)
    expect(resumen.horaMasActiva).toBeNull()
  })
})

describe('Filas del Excel (DEC-06, CA-27.x)', () => {
  const toma: RegistroHistorial = reg({
    tipo: 'toma_completa',
    ts: '2026-11-19T03:30:15Z',
    device_id: 'cuna-alimentacion-01',
    descripcion: 'Toma completada',
    valor: 60,
    unidad: 'g',
    toma: { peso_inicial_g: 250, peso_final_g: 190, cantidad_g: 60, duracion_s: 900 },
  })
  const foto: RegistroHistorial = reg({
    tipo: 'foto_tomada',
    ts: '2026-11-19T04:00:00Z',
    descripcion: 'Foto',
    foto: { estado: 'guardada', ruta: 'cuna-habitacion-01/x.jpg', motivo: null },
  })

  it('usa las columnas de DEC-06 en su orden', () => {
    expect([...COLUMNAS_EXCEL]).toEqual([
      'fecha', 'hora', 'evento', 'bebe_id', 'dispositivo_id', 'descripcion', 'valor', 'unidad',
      'peso_inicial_g', 'peso_final_g', 'cantidad_g', 'duracion_s',
    ])
  })

  it('una fila por registro, con fecha y hora de Costa Rica', () => {
    const filas = filasExcel([toma, foto])
    expect(filas).toHaveLength(2)
    expect(filas[0]).toEqual({
      fecha: '2026-11-18',
      hora: '21:30:15',
      evento: 'toma_completa',
      bebe_id: BEBE,
      dispositivo_id: 'cuna-alimentacion-01',
      descripcion: 'Toma completada',
      valor: 60,
      unidad: 'g',
      peso_inicial_g: 250,
      peso_final_g: 190,
      cantidad_g: 60,
      duracion_s: 900,
    })
  })

  it('los campos que no aplican quedan vacíos', () => {
    const fila = filasExcel([foto])[0]
    expect(fila.valor).toBeNull()
    expect(fila.unidad).toBeNull()
    expect(fila.cantidad_g).toBeNull()
    expect(fila.duracion_s).toBeNull()
  })

  it('no lleva fotos ni enlaces', () => {
    const texto = JSON.stringify(filasExcel([foto]))
    expect(texto).not.toContain('jpg')
    expect(texto).not.toContain('ruta')
    expect(texto).not.toContain('http')
  })

  it('un período sin registros genera solo encabezados (CA-27.5)', () => {
    const hoja = hojaDeFilas(filasExcel([]))
    expect(hoja).toHaveLength(1)
    expect(hoja[0]!.map((c) => c?.value)).toEqual([...COLUMNAS_EXCEL])
  })

  it('las celdas vacías no llevan valor', () => {
    const hoja = hojaDeFilas(filasExcel([foto]))
    expect(hoja).toHaveLength(2)
    expect(hoja[1]![6]).toBeNull()
    expect(hoja[1]![2]).toEqual({ value: 'foto_tomada' })
  })

  it('el nombre del archivo es seguro', () => {
    expect(nombreArchivo('Luna María', '2026-11-18')).toBe('historial-luna-maria-2026-11-18.xlsx')
    expect(nombreArchivo('???', '2026-11-18')).toBe('historial-bebe-2026-11-18.xlsx')
  })
})
