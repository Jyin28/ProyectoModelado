import { fireEvent, screen } from '@testing-library/react'

/**
 * Abre el panel de una función de producto (lista «Funciones») y espera a que
 * exista. Es idempotente: si ya está abierto, no lo cierra.
 */
export async function abrirFuncion(nombre: string | RegExp) {
  const boton = await screen.findByRole('button', { name: nombre })
  if (boton.getAttribute('aria-expanded') !== 'true') fireEvent.click(boton)
}
