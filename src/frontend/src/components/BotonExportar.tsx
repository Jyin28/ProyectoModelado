import { useState } from 'react'
import type { RegistroHistorial } from '../models/historial.ts'
import { filasExcel } from '../utils/historial.ts'
import { descargar, generarXlsx, nombreArchivo } from '../utils/excel.ts'
import { fechaYHoraCR } from '../utils/tiempo.ts'

type Props = {
  registros: RegistroHistorial[]
  nombreBebe: string
  /** Inicio del intervalo (ms UTC): da la fecha del nombre del archivo. */
  desde: number
  /** Si el servidor devolvió solo una parte, no se exporta un archivo incompleto. */
  truncado: boolean
  /** Reemplazo de la generación y entrega del archivo; solo lo usan las pruebas. */
  exportar?: (registros: RegistroHistorial[], nombre: string) => Promise<void>
}

const MENSAJE_EXPORTAR = 'No se pudo generar el archivo de Excel.'

async function exportarReal(registros: RegistroHistorial[], nombre: string): Promise<void> {
  descargar(await generarXlsx(filasExcel(registros)), nombre)
}

/**
 * Exporta el bebé y el intervalo consultados: una fila por registro, solo
 * datos. Un intervalo sin registros genera el archivo con los encabezados y
 * ninguna fila. No incluye fotos ni enlaces.
 */
function BotonExportar({ registros, nombreBebe, desde, truncado, exportar = exportarReal }: Props) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  async function pulsar() {
    setError(null)
    setListo(false)
    setOcupado(true)
    const fecha = fechaYHoraCR(new Date(desde).toISOString())?.fecha ?? 'intervalo'
    try {
      await exportar(registros, nombreArchivo(nombreBebe, fecha))
      setListo(true)
    } catch {
      setError(MENSAJE_EXPORTAR)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="exportar-historial" aria-labelledby="titulo-exportar">
      <h2 id="titulo-exportar">Exportar a Excel</h2>
      {truncado ? (
        <p role="alert">
          El intervalo tiene más registros de los que se pueden cargar. Acórtalo para poder exportar un archivo
          completo.
        </p>
      ) : (
        <>
          <p>
            Un archivo .xlsx con una fila por registro ({registros.length}). Solo datos: no incluye fotos ni enlaces a
            fotos.
          </p>
          <button type="button" onClick={() => void pulsar()} disabled={ocupado}>
            {ocupado ? 'Generando…' : 'Exportar a Excel'}
          </button>
        </>
      )}
      {listo && <p role="status">Archivo generado.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

export default BotonExportar
