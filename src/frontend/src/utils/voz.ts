// Captura y conversión de voz para el canal en vivo. Contrato:
// src/shared/contracts/voz.md (PCM de 16 bits, mono, 8000 Hz, fragmentos de
// 20 a 100 ms). Nada de aquí guarda audio: cada fragmento se envía y se descarta.

export const TASA_VOZ_HZ = 8000
/** 40 ms a 8 kHz: dentro del rango de 160 a 800 muestras del contrato. */
export const MUESTRAS_POR_FRAGMENTO = 320

/** Lleva muestras float (-1 a 1) de `tasaEntrada` a PCM de 16 bits a 8 kHz. */
export function aPcm8k(entrada: Float32Array, tasaEntrada: number): Int16Array {
  if (!(tasaEntrada >= TASA_VOZ_HZ) || !Number.isFinite(tasaEntrada)) {
    throw new Error('tasa_invalida')
  }
  const razon = tasaEntrada / TASA_VOZ_HZ
  const largo = Math.floor(entrada.length / razon)
  const salida = new Int16Array(largo)
  for (let i = 0; i < largo; i++) {
    // Promedio de la ventana: filtro simple contra el aliasing al bajar la tasa.
    const inicio = Math.floor(i * razon)
    const fin = Math.max(inicio + 1, Math.min(entrada.length, Math.floor((i + 1) * razon)))
    let suma = 0
    for (let j = inicio; j < fin; j++) suma += entrada[j]
    const media = Math.max(-1, Math.min(1, suma / (fin - inicio)))
    salida[i] = Math.round(media < 0 ? media * 0x8000 : media * 0x7fff)
  }
  return salida
}

/** Junta muestras y entrega fragmentos de tamaño fijo; el resto espera al siguiente bloque. */
export function crearFragmentador(
  alFragmento: (pcm: Int16Array) => void,
  muestras = MUESTRAS_POR_FRAGMENTO,
) {
  let pendiente = new Int16Array(0)
  return {
    agregar(pcm: Int16Array) {
      const junto = new Int16Array(pendiente.length + pcm.length)
      junto.set(pendiente)
      junto.set(pcm, pendiente.length)
      let pos = 0
      while (junto.length - pos >= muestras) {
        alFragmento(junto.slice(pos, pos + muestras))
        pos += muestras
      }
      pendiente = junto.slice(pos)
    },
    /** Descarta lo pendiente (no se envía un fragmento incompleto). */
    vaciar() {
      pendiente = new Int16Array(0)
    },
  }
}

/** Base64 del PCM en little endian, como espera la Pico. */
export function aBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.length * 2)
  const vista = new DataView(bytes.buffer)
  pcm.forEach((m, i) => vista.setInt16(i * 2, m, true))
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x2000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x2000))
  }
  return btoa(texto)
}

export type Captura = { detener: () => void }

/** Abre el micrófono y entrega fragmentos de 40 ms. Falla si no hay permiso. */
export type Capturador = (alFragmento: (pcm: Int16Array) => void) => Promise<Captura>

const CODIGO_WORKLET = `
class CapturaVoz extends AudioWorkletProcessor {
  process(entradas) {
    const canal = entradas[0] && entradas[0][0]
    if (canal) this.port.postMessage(canal.slice(0))
    return true
  }
}
registerProcessor('captura-voz', CapturaVoz)
`

/** Captura real con el micrófono del navegador (no se prueba en jsdom). */
export const capturarMicrofono: Capturador = async (alFragmento) => {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
    throw new Error('sin_microfono')
  }
  const flujo = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  const contexto = new AudioContext()
  try {
    const url = URL.createObjectURL(new Blob([CODIGO_WORKLET], { type: 'text/javascript' }))
    try {
      await contexto.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    const fuente = contexto.createMediaStreamSource(flujo)
    const nodo = new AudioWorkletNode(contexto, 'captura-voz')
    const fragmentador = crearFragmentador(alFragmento)
    nodo.port.onmessage = (evento: MessageEvent<Float32Array>) =>
      fragmentador.agregar(aPcm8k(evento.data, contexto.sampleRate))
    fuente.connect(nodo)
    return {
      detener() {
        nodo.port.onmessage = null
        fuente.disconnect()
        nodo.disconnect()
        flujo.getTracks().forEach((p) => p.stop())
        fragmentador.vaciar()
        void contexto.close()
      },
    }
  } catch (error) {
    flujo.getTracks().forEach((p) => p.stop())
    void contexto.close()
    throw error
  }
}
