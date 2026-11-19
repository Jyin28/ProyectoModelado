import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { COLUMNAS_EXCEL, type RegistroHistorial } from '../src/models/historial.ts'
import { generarXlsx } from '../src/utils/excel.ts'
import { filasExcel } from '../src/utils/historial.ts'

// En jsdom el Blob no es el de Node: se lee con FileReader.
const bytesDe = (blob: Blob) =>
  new Promise<Uint8Array>((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(new Uint8Array(lector.result as ArrayBuffer))
    lector.onerror = () => rechazar(lector.error)
    lector.readAsArrayBuffer(blob)
  })

async function leer(registros: RegistroHistorial[]) {
  const blob = await generarXlsx(filasExcel(registros))
  const bytes = await bytesDe(blob)
  const archivos = unzipSync(bytes)
  const texto = Object.fromEntries(Object.entries(archivos).map(([n, c]) => [n, strFromU8(c)]))
  return { archivos: Object.keys(archivos), texto }
}

const TOMA: RegistroHistorial = {
  registro_id: 'r-1',
  ts: '2026-11-19T03:30:15Z',
  tipo: 'toma_completa',
  bebe_id: 'bebe-luna',
  device_id: 'cuna-alimentacion-01',
  descripcion: 'Toma completada',
  valor: 60,
  unidad: 'g',
  toma: { peso_inicial_g: 250, peso_final_g: 190, cantidad_g: 60, duracion_s: 900 },
  foto: null,
}
const FOTO: RegistroHistorial = {
  ...TOMA,
  registro_id: 'r-2',
  tipo: 'foto_tomada',
  device_id: 'cuna-habitacion-01',
  valor: null,
  unidad: null,
  toma: null,
  foto: { estado: 'guardada', ruta: 'cuna-habitacion-01/x.jpg', motivo: null },
}

const hojaDe = (texto: Record<string, string>) => {
  const nombre = Object.keys(texto).find((n) => /xl\/worksheets\/sheet1\.xml$/.test(n))
  return texto[nombre!]
}
const cadenas = (texto: Record<string, string>) => {
  const nombre = Object.keys(texto).find((n) => /sharedStrings\.xml$/.test(n))
  return nombre ? texto[nombre] : ''
}

describe('Archivo .xlsx real (HU-27)', () => {
  it('es un libro con una hoja y contiene los encabezados de DEC-06', async () => {
    const { archivos, texto } = await leer([TOMA, FOTO])
    expect(archivos.some((n) => n.endsWith('xl/workbook.xml'))).toBe(true)
    const contenido = hojaDe(texto) + cadenas(texto)
    for (const columna of COLUMNAS_EXCEL) expect(contenido).toContain(columna)
  })

  it('lleva una fila por registro más la de encabezados', async () => {
    const { texto } = await leer([TOMA, FOTO])
    expect((hojaDe(texto).match(/<row\b/g) ?? []).length).toBe(3)
  })

  it('un período sin registros lleva solo la fila de encabezados (CA-27.5)', async () => {
    const { texto } = await leer([])
    expect((hojaDe(texto).match(/<row\b/g) ?? []).length).toBe(1)
  })

  it('guarda los valores de la toma y de la fecha civil de Costa Rica', async () => {
    const { texto } = await leer([TOMA])
    const contenido = hojaDe(texto) + cadenas(texto)
    expect(contenido).toContain('2026-11-18')
    expect(contenido).toContain('21:30:15')
    expect(contenido).toContain('toma_completa')
    expect(contenido).toContain('>250<')
    expect(contenido).toContain('>900<')
  })

  it('no contiene fotos, rutas ni enlaces (CA-27.2)', async () => {
    const { archivos, texto } = await leer([FOTO])
    expect(archivos.some((n) => /media\/|drawings\/|hyperlink/i.test(n))).toBe(false)
    const todo = Object.values(texto).join('\n')
    expect(todo).not.toContain('x.jpg')
    expect(todo).not.toContain('<hyperlink')
  })
})
