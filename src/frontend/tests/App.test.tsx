import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App.tsx'

describe('App', () => {
  it('muestra el nombre del proyecto', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cuna Inteligente IoT' }),
    ).toBeInTheDocument()
  })
})
