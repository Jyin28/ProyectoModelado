// Exportación a .xlsx (HU-27). Solo datos: sin formato decorativo, sin fotos y
// sin enlaces. La librería se carga al exportar para no engordar la carga inicial.
import { COLUMNAS_EXCEL, type FilaExcel } from '../models/historial.ts'

type Celda = { value: string | number } | null

/** Matriz de celdas: encabezados simples y una fila por registro; vacío = celda sin valor. */
export function hojaDeFilas(filas: readonly FilaExcel[]): Celda[][] {
  const encabezados: Celda[] = COLUMNAS_EXCEL.map((nombre) => ({ value: nombre }))
  const cuerpo = filas.map((fila) =>
    COLUMNAS_EXCEL.map((columna): Celda => {
      const valor = fila[columna]
      return valor === null || valor === '' ? null : { value: valor }
    }),
  )
  return [encabezados, ...cuerpo]
}

export async function generarXlsx(filas: readonly FilaExcel[]): Promise<Blob> {
  const { default: escribir } = await import('write-excel-file/universal')
  return escribir(hojaDeFilas(filas) as never, { sheet: 'Historial' }).toBlob()
}

export function nombreArchivo(bebe: string, fechaCR: string): string {
  const limpio = bebe
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `historial-${limpio || 'bebe'}-${fechaCR}.xlsx`
}

/** Entrega el archivo al navegador. No toca la red. */
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
