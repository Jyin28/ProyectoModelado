import { useEffect, useState } from 'react'

export function useAhora(intervaloMs = 1000): Date {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])

  return ahora
}
