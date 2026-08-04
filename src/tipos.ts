import type { Edge, Node, Viewport } from '@xyflow/react'

/**
 * Paleta de colores para los cuadros. Se guarda el identificador, no el valor
 * hexadecimal, para poder retocar la paleta sin migrar documentos antiguos.
 */
export const PALETA = {
  // 'mini' es un tono medio para el minimapa: el color de borde es demasiado
  // claro y a tamaño reducido los cuadros se veían lavados.
  pizarra: { nombre: 'Pizarra', borde: '#cbd5e1', fondo: '#f8fafc', texto: '#0f172a', mini: '#94a3b8' },
  amarillo: { nombre: 'Amarillo', borde: '#fcd34d', fondo: '#fffbeb', texto: '#4a2c05', mini: '#f59e0b' },
  verde: { nombre: 'Verde', borde: '#86efac', fondo: '#f0fdf4', texto: '#052e16', mini: '#22c55e' },
  azul: { nombre: 'Azul', borde: '#93c5fd', fondo: '#eff6ff', texto: '#0b2a54', mini: '#3b82f6' },
  violeta: { nombre: 'Violeta', borde: '#c4b5fd', fondo: '#f5f3ff', texto: '#2e1065', mini: '#8b5cf6' },
  rosa: { nombre: 'Rosa', borde: '#f9a8d4', fondo: '#fdf2f8', texto: '#500724', mini: '#ec4899' },
  naranja: { nombre: 'Naranja', borde: '#fdba74', fondo: '#fff7ed', texto: '#431407', mini: '#f97316' },
} as const

export type ColorId = keyof typeof PALETA

export const COLOR_POR_DEFECTO: ColorId = 'pizarra'

/** Datos propios de un cuadro de texto en el lienzo. */
export type DatosNodoTexto = {
  texto: string
  color: ColorId
  /** Resaltado tipo marcador sobre el texto del cuadro. */
  resaltado: boolean
  /**
   * Marca efímera: pide al cuadro que entre en modo edición al montarse.
   * Se limpia sola y no se persiste.
   */
  autoenfocar?: boolean
}

export type NodoTexto = Node<DatosNodoTexto, 'texto'>

/** Nota suelta del panel de notas rápidas (se llena en la Fase 2). */
export type NotaRapida = {
  id: string
  texto: string
  creado: number
}

/** Metadatos de una materia. Viven en el índice, no en el documento. */
export type Cuaderno = {
  id: string
  nombre: string
  creado: number
  modificado: number
  archivado: boolean
  /** Cache para mostrar en la tarjeta sin abrir el documento. */
  numIdeas: number
  /**
   * Lápida de borrado. Una materia eliminada no se quita del índice, se marca:
   * si se borrara sin más, al sincronizar volvería desde otro dispositivo que
   * todavía la tuviera. Se oculta de la interfaz y su archivo remoto se elimina.
   */
  eliminado?: boolean
}

export const VERSION_INDICE = 1 as const

export type IndiceCuadernos = {
  version: typeof VERSION_INDICE
  cuadernos: Cuaderno[]
  /** Última materia abierta, para retomar el trabajo en cualquier dispositivo. */
  ultimoCuaderno?: string | null
  /** Marca de tiempo de la última escritura, para fusionar índices. */
  actualizado?: number
}

export const VERSION_DOCUMENTO = 1 as const

/**
 * Contenido del lienzo de una materia. Este objeto es exactamente lo que en la
 * Fase 3 se subirá como JSON a GitHub, así que conviene que sea plano y estable.
 */
export type DocumentoCuaderno = {
  version: typeof VERSION_DOCUMENTO
  nodes: NodoTexto[]
  edges: Edge[]
  viewport: Viewport | null
  notas: NotaRapida[]
}

export function documentoVacio(): DocumentoCuaderno {
  return { version: VERSION_DOCUMENTO, nodes: [], edges: [], viewport: null, notas: [] }
}

export type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error'
