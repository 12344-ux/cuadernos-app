import { lazy } from 'react'

/**
 * Tiptap y ProseMirror pesan más que el resto de la aplicación junta, y solo
 * hacen falta cuando se está escribiendo dentro de un cuadro: en reposo el
 * contenido se dibuja como HTML estático. Cargarlos aparte deja el arranque en
 * lo que costaba antes de que existiera el editor.
 *
 * La carga se dispara al empezar a editar, pero el lienzo la adelanta en cuanto
 * el navegador está desocupado (ver precargarEditor) para que la primera edición
 * no espere a la red.
 */
export const cargarEditorNodo = () => import('./EditorNodo')

export const EditorNodoDiferido = lazy(async () => ({
  default: (await cargarEditorNodo()).EditorNodo,
}))

let precargaPedida = false

/** Trae el editor por adelantado, una sola vez y sin estorbar al hilo principal. */
export function precargarEditor(): void {
  if (precargaPedida) return
  precargaPedida = true

  const traer = () => void cargarEditorNodo()

  // Safari no tenía requestIdleCallback hasta hace poco; el temporizador es el
  // recambio. Se comprueba el tipo y no con 'in' porque para TypeScript la
  // función siempre existe y daría la rama alternativa por inalcanzable.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(traer, { timeout: 3000 })
  } else {
    window.setTimeout(traer, 1500)
  }
}
