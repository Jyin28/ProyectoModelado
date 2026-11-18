// Destinatarios de avisos por Telegram (HU-06). Un destinatario no es un
// dueño: recibir avisos no concede control del módulo.

export type DestinatarioTelegram = {
  id: string
  nombre: string
  /** true cuando la persona ya completó la vinculación con su código. */
  vinculado: boolean
}

export type CodigoVinculacion = {
  codigo: string
  /** Instante ISO UTC en que el código deja de servir. */
  vence_en: string
}
