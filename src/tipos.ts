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

/**
 * Marcadores de texto, al estilo de un subrayador. Son tres y no siete a
 * propósito: un marcador sirve para clasificar (importante / definición / duda),
 * y con demasiados colores se pierde el significado de cada uno.
 *
 * Igual que en la paleta, en el documento se guarda la clave ('amarillo'), no
 * el color: el tono real vive en el CSS y se puede retocar sin migrar nada.
 */
export const MARCADORES = {
  amarillo: { nombre: 'Importante' },
  verde: { nombre: 'Definición' },
  rosa: { nombre: 'Duda' },
} as const

export type Marcador = keyof typeof MARCADORES

/**
 * Tipografías elegibles por cuadro. Las tres primeras son pilas del sistema y
 * no pesan nada; 'fraunces' es la única autoalojada.
 * La familia concreta se define en el CSS (clase '.fuente-<clave>').
 */
export const FUENTES = {
  sistema: { nombre: 'Sistema' },
  serif: { nombre: 'Serif' },
  mono: { nombre: 'Mono' },
  fraunces: { nombre: 'Fraunces' },
} as const

export type Fuente = keyof typeof FUENTES

export const FUENTE_POR_DEFECTO: Fuente = 'sistema'

/** Tamaños de texto por cuadro. El valor en rem vive en el CSS. */
export const TAMANOS = {
  pequeno: { nombre: 'Pequeño', abreviatura: 'A' },
  normal: { nombre: 'Normal', abreviatura: 'A' },
  titulo: { nombre: 'Título', abreviatura: 'A' },
} as const

export type Tamano = keyof typeof TAMANOS

export const TAMANO_POR_DEFECTO: Tamano = 'normal'

export const ALINEACIONES = {
  izquierda: { nombre: 'Alinear a la izquierda' },
  centro: { nombre: 'Centrar' },
  derecha: { nombre: 'Alinear a la derecha' },
} as const

export type Alineacion = keyof typeof ALINEACIONES

export const ALINEACION_POR_DEFECTO: Alineacion = 'izquierda'

/**
 * Datos de un elemento del lienzo, sea cuadro o post-it. Los dos comparten
 * exactamente los mismos ajustes de apariencia; lo que los diferencia es el
 * campo 'type' del nodo (ver NodoCuaderno).
 */
export type DatosNodo = {
  /**
   * Contenido con formato, como HTML de Tiptap. Se guarda HTML y no el JSON de
   * ProseMirror porque ocupa mucho menos: una frase corta cabe en una línea
   * legible dentro del diff de GitHub, mientras que el JSON la convertiría en
   * un árbol de treinta líneas.
   *
   * Solo puede contener las etiquetas de ETIQUETAS_PERMITIDAS (ver saneador.ts):
   * cualquier cosa que llegue de fuera se limpia antes de mostrarse.
   */
  contenido: string
  color: ColorId
  fuente: Fuente
  tamano: Tamano
  alineacion: Alineacion
  /**
   * Marca efímera: pide al cuadro que entre en modo edición al montarse.
   * Se limpia sola y no se persiste.
   */
  autoenfocar?: boolean
}

/**
 * Cuadro del mapa conceptual: participa del flujo de flechas.
 * El tipo del nodo se llama 'texto' por continuidad con los documentos ya
 * guardados, donde todos los nodos son de ese tipo.
 */
export type NodoTexto = Node<DatosNodo, 'texto'>

/**
 * Post-it: nota suelta pegada sobre el lienzo. Se mueve y se edita como un
 * cuadro, pero no dibuja puntos de conexión, así que no entra en la estructura
 * del mapa ni cuenta como idea.
 */
export type NodoPostit = Node<DatosNodo, 'postit'>

export type NodoCuaderno = NodoTexto | NodoPostit

/** El 'type' del nodo es lo que distingue un cuadro de un post-it. */
export const TIPOS_ELEMENTO = ['texto', 'postit'] as const

export type TipoElemento = (typeof TIPOS_ELEMENTO)[number]

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

/**
 * Versión 2: los nodos pasan de 'texto' plano + 'resaltado' booleano a
 * 'contenido' con formato, y aparecen fuente, tamaño, alineación y los post-its.
 * La conversión de los documentos de la versión 1 la hace normalizar() en
 * almacenamiento/documentos.ts.
 */
export const VERSION_DOCUMENTO = 2 as const

/**
 * Contenido del lienzo de una materia. Este objeto es exactamente lo que se
 * sube como JSON a GitHub, así que conviene que sea plano y estable.
 */
export type DocumentoCuaderno = {
  version: typeof VERSION_DOCUMENTO
  nodes: NodoCuaderno[]
  edges: Edge[]
  viewport: Viewport | null
  notas: NotaRapida[]
}

export function documentoVacio(): DocumentoCuaderno {
  return { version: VERSION_DOCUMENTO, nodes: [], edges: [], viewport: null, notas: [] }
}

/** Apariencia de partida de cualquier elemento nuevo del lienzo. */
export function datosNodoPorDefecto(): DatosNodo {
  return {
    contenido: '',
    color: COLOR_POR_DEFECTO,
    fuente: FUENTE_POR_DEFECTO,
    tamano: TAMANO_POR_DEFECTO,
    alineacion: ALINEACION_POR_DEFECTO,
  }
}

export type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error'
