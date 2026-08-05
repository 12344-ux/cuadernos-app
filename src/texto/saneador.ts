import { MARCADORES, type Marcador } from '../tipos'

/**
 * Etiquetas que se permiten en el contenido de un cuadro.
 *
 * Esta lista debe corresponderse con el esquema de Tiptap (ver extensiones.ts):
 * si aquí se admitiera algo que el editor no entiende, el texto se vería con
 * formato en reposo y lo perdería al empezar a editarlo. 'B' e 'I' se toleran
 * porque Tiptap también las reconoce y las convierte a 'STRONG' y 'EM'.
 */
const ETIQUETAS_PERMITIDAS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK'])

/**
 * Etiquetas que se borran con todo su contenido en lugar de desenvolverse.
 * Para el resto basta con quitar la etiqueta y conservar el texto de dentro.
 */
const ETIQUETAS_PELIGROSAS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'BASE',
  'FORM',
  'INPUT',
  'BUTTON',
  'SVG',
  'MATH',
  'TEMPLATE',
  'NOSCRIPT',
])

/**
 * Limpia el HTML de un cuadro dejando solo formato de texto conocido.
 *
 * Hace falta porque el contenido se inyecta con dangerouslySetInnerHTML para
 * poder mostrar los cuadros sin montar un editor en cada uno, y los documentos
 * llegan de un repositorio de GitHub. Aunque el repositorio sea privado y del
 * propio dueño, un archivo manipulado no debe poder ejecutar código en la
 * sesión, que es justo donde vive el token cifrado.
 *
 * Se descartan todos los atributos salvo el 'data-color' de un <mark>, y solo
 * si su valor es uno de los marcadores conocidos.
 */
/**
 * Documento inerte reutilizado en todas las llamadas.
 *
 * Se crea con createHTMLDocument y no con 'new DOMParser()' en cada llamada por
 * velocidad: al abrir un cuaderno grande esto se ejecuta una vez por cuadro.
 * Un documento así no tiene contexto de navegación, de modo que al asignar el
 * HTML no se ejecuta ningún script ni se descarga ningún recurso.
 */
let documentoInerte: Document | null = null

function cuerpoInerte(html: string): HTMLElement {
  documentoInerte ??= document.implementation.createHTMLDocument('')
  documentoInerte.body.innerHTML = html
  return documentoInerte.body
}

export function sanearHtml(html: string): string {
  if (!html) return ''

  const cuerpo = cuerpoInerte(html)
  limpiarHijos(cuerpo)
  const limpio = cuerpo.innerHTML
  // No se deja el contenido dentro del documento reutilizado.
  cuerpo.innerHTML = ''
  return limpio
}

function limpiarHijos(padre: Element): void {
  // Se recorre una copia de la lista porque el bucle modifica el árbol.
  for (const hijo of Array.from(padre.children)) {
    const etiqueta = hijo.tagName.toUpperCase()

    if (ETIQUETAS_PELIGROSAS.has(etiqueta)) {
      hijo.remove()
      continue
    }

    // Primero los descendientes: así, al desenvolver este nodo, lo que sube al
    // padre ya viene limpio.
    limpiarHijos(hijo)

    if (!ETIQUETAS_PERMITIDAS.has(etiqueta)) {
      hijo.replaceWith(...Array.from(hijo.childNodes))
      continue
    }

    for (const atributo of Array.from(hijo.attributes)) {
      if (!atributoPermitido(etiqueta, atributo.name, atributo.value)) {
        hijo.removeAttribute(atributo.name)
      }
    }
  }
}

function atributoPermitido(etiqueta: string, nombre: string, valor: string): boolean {
  if (etiqueta !== 'MARK' || nombre !== 'data-color') return false
  // hasOwnProperty y no 'valor in MARCADORES' para que '__proto__' no cuele.
  return Object.prototype.hasOwnProperty.call(MARCADORES, valor)
}

/**
 * Convierte el texto plano de un documento de la versión 1 en HTML.
 *
 * Cada salto de línea del textarea antiguo pasa a ser un párrafo. Si el cuadro
 * estaba resaltado, todo su texto se envuelve en el marcador indicado, que es
 * la traducción más fiel del antiguo booleano 'resaltado'.
 */
export function textoPlanoAHtml(texto: string, marcador?: Marcador): string {
  if (!texto) return ''

  return texto
    .split('\n')
    .map((linea) => {
      const escapada = escaparHtml(linea)
      if (!escapada) return '<p></p>'
      return marcador
        ? `<p><mark data-color="${marcador}">${escapada}</mark></p>`
        : `<p>${escapada}</p>`
    })
    .join('')
}

/** Evita que un texto con '<', '>' o '&' se interprete como etiquetas. */
function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Un cuadro sin texto útil. Tiptap deja '<p></p>' al borrar todo el contenido,
 * así que no basta con comprobar que la cadena esté vacía.
 *
 * Quitar etiquetas con una expresión regular vale aquí porque el contenido ya
 * está saneado y la respuesta solo decide si se muestra el texto de ayuda.
 */
export function htmlEstaVacio(html: string): boolean {
  if (!html) return true
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

/**
 * El texto de un contenido con formato, para vistas previas de una línea.
 *
 * Se recorre el DOM en lugar de quitar las etiquetas con una expresión regular:
 * sustituirlas por espacios separaría del texto los signos que van pegados a una
 * palabra en negrilla, y "¿Qué es la <strong>mitosis</strong>?" acabaría escrito
 * como "¿Qué es la mitosis ?". Los bloques sí se unen con un espacio, para que
 * dos párrafos seguidos no queden pegados.
 */
export function htmlATextoLlano(html: string): string {
  if (!html) return ''

  const cuerpo = cuerpoInerte(sanearHtml(html))
  const texto = Array.from(cuerpo.childNodes)
    .map((nodo) => nodo.textContent ?? '')
    .join(' ')
  cuerpo.innerHTML = ''

  return texto.replace(/\s+/g, ' ').trim()
}
