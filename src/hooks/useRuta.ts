import { useEffect, useState } from 'react'

/**
 * Enrutado por hash, sin librería.
 *
 * Se usa hash y no rutas reales a propósito: GitHub Pages sirve archivos
 * estáticos, así que recargar /c/<id> devolvería 404 y habría que recurrir al
 * truco del 404.html. Con hash, recargar dentro de un cuaderno funciona.
 */
export type Ruta =
  | { tipo: 'selector' }
  | { tipo: 'cuaderno'; id: string }
  | { tipo: 'flashcards'; id: string }
  | { tipo: 'agenda' }

function analizar(hash: string): Ruta {
  const partes = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  // El historial de la agenda no cuelga de ninguna materia.
  if (partes[0] === 'agenda') return { tipo: 'agenda' }
  if (partes[0] === 'c' && partes[1]) {
    const id = decodeURIComponent(partes[1])
    // Las flashcards cuelgan de la materia: #/c/<id>/flashcards
    if (partes[2] === 'flashcards') return { tipo: 'flashcards', id }
    return { tipo: 'cuaderno', id }
  }
  return { tipo: 'selector' }
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(() => analizar(window.location.hash))

  useEffect(() => {
    const alCambiar = () => setRuta(analizar(window.location.hash))
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  return ruta
}

export function irAlSelector(): void {
  window.location.hash = '#/'
}

export function irAlCuaderno(id: string): void {
  window.location.hash = `#/c/${encodeURIComponent(id)}`
}

export function irAlasFlashcards(id: string): void {
  window.location.hash = `#/c/${encodeURIComponent(id)}/flashcards`
}

export function irALaAgenda(): void {
  window.location.hash = '#/agenda'
}
