import type { Extensions } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { MARCADORES } from '../tipos'

/**
 * Marcador de texto, a partir de la extensión Highlight.
 *
 * Se reescribe su atributo de color porque el original, además de 'data-color',
 * escribe un estilo en línea con el valor concreto:
 *
 *   style="background-color: #fef08a; color: inherit"
 *
 * Eso incrustaría el color en cada <mark> del JSON que se sube a GitHub y
 * obligaría a migrar todos los documentos para retocar un tono. Aquí se guarda
 * solo la clave del marcador y el color real se aplica desde el CSS, igual que
 * se hace con la paleta de los cuadros.
 */
const Marcador = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (elemento) => elemento.getAttribute('data-color'),
        renderHTML: (atributos) => {
          const color: unknown = atributos.color
          if (typeof color !== 'string') return {}
          // Un valor desconocido no se escribe: así un documento manipulado no
          // puede colar un atributo arbitrario en el HTML.
          if (!Object.prototype.hasOwnProperty.call(MARCADORES, color)) return {}
          return { 'data-color': color }
        },
      },
    }
  },
})

/**
 * Esquema deliberadamente mínimo: un cuadro de mapa conceptual es texto corto.
 * Se desactiva todo lo que no aporta (listas, citas, código, encabezados,
 * enlaces, líneas horizontales) para que el HTML guardado se mantenga pequeño y
 * predecible, y para que la lista blanca del saneador pueda ser igual de corta.
 *
 * Queda activo: párrafos, texto, negrilla, cursiva, subrayado, salto de línea
 * manual y deshacer/rehacer.
 */
export const EXTENSIONES_TEXTO: Extensions = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    // Sin bloques que arrastrar ni huecos entre bloques, estos dos cursores
    // solo añaden plugins y estilos que no se llegan a ver.
    dropcursor: false,
    gapcursor: false,
    heading: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    // Añadiría un párrafo vacío al final de cada cuadro.
    trailingNode: false,
  }),
  Marcador.configure({ multicolor: true }),
  Placeholder.configure({ placeholder: 'Escribe tu idea…' }),
]
