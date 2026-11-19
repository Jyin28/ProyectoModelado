import { fireEvent, screen } from '@testing-library/react'

/**
 * Abre la pestaña de una función de producto y espera a que exista. Es
 * idempotente: si ya está elegida, no hace nada.
 */
export async function abrirFuncion(nombre: string | RegExp) {
  const pestana = await screen.findByRole('tab', { name: nombre })
  if (pestana.getAttribute('aria-selected') !== 'true') fireEvent.click(pestana)
}
