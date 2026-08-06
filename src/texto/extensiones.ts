import { Extension, Mark, Node, type Extensions } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import {
  ALINEACIONES_TEXTO,
  FUENTES,
  MARCADORES,
  TAMANOS_TEXTO,
  type AlineacionTexto,
  type Fuente,
  type TamanoTexto,
} from '../tipos'
// La validación del src vive en el saneador y no aquí a propósito: el saneador se
// carga siempre y este módulo arrastra todo Tiptap, que va en un fragmento
// aparte. Importar en este sentido mantiene el editor fuera de la carga inicial.
import { esImagenValida, pesoDeDataUrl } from './saneador'

/**
 * Tope de una imagen que llega pegada como HTML, sin pasar por el reescalado.
 *
 * Es más bajo que el de una imagen preparada porque esta entra tal cual: si se
 * pega un trozo de página con una foto enorme, se descarta en lugar de meterla en
 * un documento que se sube entero a GitHub en cada guardado.
 */
const TOPE_IMAGEN_PEGADA = 1024 * 1024

/**
 * Comprueba que una clave venga de la tabla que toca.
 *
 * Con hasOwnProperty y no con 'clave in tabla' para que un documento manipulado
 * no pueda colar '__proto__' o 'constructor' y acabar escribiendo un atributo
 * arbitrario en el HTML que luego se inyecta.
 */
function claveConocida(tabla: object, valor: unknown): valor is string {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(tabla, valor)
}

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
          // Un valor desconocido no se escribe: así un documento manipulado no
          // puede colar un atributo arbitrario en el HTML.
          if (!claveConocida(MARCADORES, color)) return {}
          return { 'data-color': color }
        },
      },
    }
  },
})

/**
 * Tipografía de un trozo de texto seleccionado.
 *
 * Mismo criterio que el marcador: en el documento va la clave ('serif'), no la
 * pila de fuentes, y el CSS traduce '[data-fuente="serif"]' a la familia real.
 * Guardar la familia entera repetiría una cadena larga en cada span del JSON y
 * ataría los documentos ya guardados a la lista de fuentes de hoy.
 */
const FuenteTexto = Mark.create({
  name: 'fuenteTexto',

  addAttributes() {
    return {
      fuente: {
        default: null,
        parseHTML: (elemento) => elemento.getAttribute('data-fuente'),
        renderHTML: (atributos) =>
          claveConocida(FUENTES, atributos.fuente) ? { 'data-fuente': atributos.fuente } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-fuente]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },

  addCommands() {
    return {
      ponerFuente:
        (fuente: Fuente) =>
        ({ commands }) =>
          commands.setMark(this.name, { fuente }),
      quitarFuente:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})

/** Tamaño de un trozo de texto seleccionado. Ver TAMANOS_TEXTO. */
const TamanoTextoMarca = Mark.create({
  name: 'tamanoTexto',

  addAttributes() {
    return {
      tamano: {
        default: null,
        parseHTML: (elemento) => elemento.getAttribute('data-tamano'),
        renderHTML: (atributos) =>
          claveConocida(TAMANOS_TEXTO, atributos.tamano)
            ? { 'data-tamano': atributos.tamano }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-tamano]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },

  addCommands() {
    return {
      ponerTamanoTexto:
        (tamano: TamanoTexto) =>
        ({ commands }) =>
          commands.setMark(this.name, { tamano }),
      quitarTamanoTexto:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})

/**
 * Alineación párrafo a párrafo.
 *
 * Es un atributo global de los párrafos y encabezados en vez de una marca,
 * porque alinear es propio del bloque y no del trozo de texto seleccionado. Se
 * escribe como 'data-alinear' y no como 'style="text-align:…"' para que el
 * saneador pueda validarlo contra una lista de claves en lugar de tener que
 * interpretar CSS que llega de un archivo remoto.
 */
const AlineacionDeParrafo = Extension.create({
  name: 'alineacionDeParrafo',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          alinear: {
            default: null,
            parseHTML: (elemento) => elemento.getAttribute('data-alinear'),
            renderHTML: (atributos) =>
              claveConocida(ALINEACIONES_TEXTO, atributos.alinear)
                ? { 'data-alinear': atributos.alinear }
                : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      alinearParrafo:
        (alinear: AlineacionTexto | null) =>
        ({ commands }) => {
          /*
           * Se ajustan los dos tipos, no el primero que responda: una selección
           * que abarque un título y sus párrafos debe alinearse entera. Con un
           * 'some' se cortaba en el primero y el resto se quedaba sin alinear.
           */
          const parrafos = commands.updateAttributes('paragraph', { alinear })
          const titulos = commands.updateAttributes('heading', { alinear })
          return parrafos || titulos
        },
    }
  },
})

/**
 * Imagen incrustada en el texto.
 *
 * La imagen viaja dentro del propio documento como data URL, no como archivo
 * aparte en el repositorio. Es lo que mantiene la sincronización tal como está:
 * un apunte sigue siendo un único JSON que se sube de una vez, sin tener que
 * coordinar la subida de binarios con la del texto que los referencia ni
 * arrastrar imágenes huérfanas al borrar una nota. El precio es el tamaño del
 * JSON, y por eso al pegar se reescala (ver texto/imagenes.ts).
 */
const Imagen = Node.create({
  name: 'imagen',
  group: 'block',
  // Sin contenido editable dentro: se selecciona y se borra como una unidad.
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (elemento) => elemento.getAttribute('src'),
        // Segunda barrera, además del saneador: si el valor no es una data URL
        // de mapa de bits no se escribe ningún src.
        renderHTML: (atributos) => (esImagenValida(atributos.src) ? { src: atributos.src } : {}),
      },
      alt: {
        default: null,
        parseHTML: (elemento) => elemento.getAttribute('alt'),
        renderHTML: (atributos) =>
          typeof atributos.alt === 'string' && atributos.alt ? { alt: atributos.alt } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        /*
         * Aquí se filtra lo que entra al pegar HTML, que es un camino que no pasa
         * por prepararImagen y por tanto no se reescala ni se recomprime. Antes,
         * copiar un trozo de página web metía la imagen original en el documento,
         * de cualquier tamaño, saltándose los topes.
         *
         * Devolver false hace que ProseMirror descarte el nodo.
         */
        getAttrs: (elemento) => {
          if (!(elemento instanceof HTMLElement)) return false
          const src = elemento.getAttribute('src')
          // Una imagen remota tampoco: se acabaría guardando sin src y el
          // saneador la borraría al salir de la edición, sin explicar nada.
          if (!esImagenValida(src)) return false
          if (pesoDeDataUrl(src) > TOPE_IMAGEN_PEGADA) return false
          return { src, alt: elemento.getAttribute('alt') }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes]
  },

  addCommands() {
    return {
      insertarImagen:
        (src: string, alt?: string) =>
        ({ commands }) => {
          if (!esImagenValida(src)) return false
          return commands.insertContent({ type: this.name, attrs: { src, alt: alt ?? null } })
        },
    }
  },
})

/*
 * Los comandos propios se declaran para que 'editor.chain()' los conozca con
 * tipos, igual que los que trae Tiptap de serie.
 */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fuenteTexto: {
      ponerFuente: (fuente: Fuente) => ReturnType
      quitarFuente: () => ReturnType
    }
    tamanoTexto: {
      ponerTamanoTexto: (tamano: TamanoTexto) => ReturnType
      quitarTamanoTexto: () => ReturnType
    }
    alineacionDeParrafo: {
      alinearParrafo: (alinear: AlineacionTexto | null) => ReturnType
    }
    imagen: {
      insertarImagen: (src: string, alt?: string) => ReturnType
    }
  }
}

/**
 * Esquema de texto de la aplicación.
 *
 * Antes era deliberadamente mínimo, pensando en que un cuadro del mapa y la cara
 * de una flashcard son textos cortos. Estudio Activo cambió el planteamiento: una
 * nota de clase se escribe como en un procesador de textos, con encabezados,
 * listas, tamaños distintos e imágenes pegadas. Y el esquema es uno solo para
 * toda la aplicación a propósito, porque el saneador también es uno: teniendo dos
 * esquemas, lo que la lista blanca dejara pasar para una nota se vería con formato
 * en un cuadro del mapa y se perdería nada más entrar a editarlo.
 *
 * Queda fuera: enlaces (obligarían a validar href, y un 'javascript:' es
 * justo lo que no debe poder llegar de un archivo remoto), bloques de código y
 * citas, que no aportan a unos apuntes de clase.
 *
 * Cualquier cosa que se añada aquí hay que añadirla a la vez en saneador.ts.
 *
 * Es una función y no una constante porque el texto de ayuda cambia según dónde
 * se use: "Escribe tu idea…" en el lienzo, "Pregunta" y "Respuesta" en una
 * tarjeta.
 */
export function extensionesDeTexto(placeholder = 'Escribe tu idea…'): Extensions {
  return [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      /*
       * Estos dos sí hacen falta ahora que hay imágenes. El de huecos permite
       * poner el cursor antes o después de una imagen, que es un bloque sin texto
       * dentro y podría quedar imposible de rodear; el de arrastre marca dónde va
       * a caer la imagen que se está moviendo. Antes, sin ningún bloque que
       * arrastrar, ninguno de los dos se llegaba a ver.
       */
      horizontalRule: false,
      link: false,
      // Tres niveles bastan para unos apuntes y evitan un desplegable largo.
      heading: { levels: [1, 2, 3] },
      // Añadiría un párrafo vacío al final de cada cuadro.
      trailingNode: false,
    }),
    Marcador.configure({ multicolor: true }),
    FuenteTexto,
    TamanoTextoMarca,
    AlineacionDeParrafo,
    Imagen,
    Placeholder.configure({ placeholder }),
  ]
}
