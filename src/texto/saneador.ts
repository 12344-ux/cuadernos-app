import {
  ALINEACIONES_TEXTO,
  FUENTES,
  MARCADORES,
  TAMANOS_TEXTO,
  type Marcador,
} from '../tipos'

/**
 * Etiquetas que se permiten en el contenido de un cuadro.
 *
 * Esta lista debe corresponderse con el esquema de Tiptap (ver extensiones.ts):
 * si aquí se admitiera algo que el editor no entiende, el texto se vería con
 * formato en reposo y lo perdería al empezar a editarlo. 'B' e 'I' se toleran
 * porque Tiptap también las reconoce y las convierte a 'STRONG' y 'EM'; 'STRIKE'
 * y 'DEL' por lo mismo respecto a 'S'.
 */
const ETIQUETAS_PERMITIDAS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'MARK',
  'H1',
  'H2',
  'H3',
  'UL',
  'OL',
  'LI',
  'SPAN',
  'IMG',
])

/** Bloques que admiten alineación propia (ver AlineacionDeParrafo). */
const ETIQUETAS_ALINEABLES = new Set(['P', 'H1', 'H2', 'H3'])

/**
 * Formatos de imagen aceptados.
 *
 * SVG queda fuera a propósito: es XML y puede traer <script> o manejadores de
 * eventos dentro, así que un SVG incrustado sería justo el agujero que este
 * archivo existe para cerrar. Solo se admiten data URLs, nunca 'http(s):': una
 * imagen remota delataría la lectura del apunte a un tercero y dejaría el
 * contenido dependiendo de que ese servidor siga en pie.
 */
const PATRON_IMAGEN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/

export function esImagenValida(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_IMAGEN.test(valor)
}

/**
 * Bytes que ocupa lo que hay codificado en una data URL.
 *
 * Vive aquí, junto a la validación, porque la necesitan tanto el editor (para
 * rechazar una imagen pegada como HTML, que no pasa por el reescalado) como el
 * preparador de imágenes. Y este módulo no arrastra Tiptap.
 */
export function pesoDeDataUrl(datos: string): number {
  const base64 = datos.slice(datos.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

/** Numeración de una lista ordenada: '<ol start="3">'. */
const PATRON_INICIO_LISTA = /^\d{1,6}$/

/** Estilo de numeración: '<ol type="a">'. */
const TIPOS_DE_NUMERACION = new Set(['1', 'a', 'A', 'i', 'I'])

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

    // Una imagen cuyo origen no pasa el filtro se va entera. Si solo se le
    // quitara el 'src', como se hace con el resto de atributos, quedaría un
    // <img> suelto que el navegador dibuja como icono roto.
    if (etiqueta === 'IMG' && !esImagenValida(hijo.getAttribute('src') ?? '')) {
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

/**
 * Decide si un atributo concreto sobrevive.
 *
 * Todo lo que no aparezca aquí se borra, incluidos 'style', 'class' y cualquier
 * 'on…'. Los valores no se admiten por su forma sino por pertenecer a una tabla
 * conocida, que es lo que permite comprobarlos sin interpretar CSS ni URLs.
 */
function atributoPermitido(etiqueta: string, nombre: string, valor: string): boolean {
  if (etiqueta === 'MARK' && nombre === 'data-color') return esClaveDe(MARCADORES, valor)
  if (etiqueta === 'SPAN' && nombre === 'data-fuente') return esClaveDe(FUENTES, valor)
  if (etiqueta === 'SPAN' && nombre === 'data-tamano') return esClaveDe(TAMANOS_TEXTO, valor)

  if (nombre === 'data-alinear' && ETIQUETAS_ALINEABLES.has(etiqueta)) {
    return esClaveDe(ALINEACIONES_TEXTO, valor)
  }

  if (etiqueta === 'IMG') {
    if (nombre === 'src') return esImagenValida(valor)
    // El texto alternativo es contenido del usuario, y al serializarse como
    // atributo el navegador ya escapa las comillas: no hay nada que validar.
    if (nombre === 'alt') return true
  }

  /*
   * Numeración de una lista ordenada. Son necesarios porque la extensión
   * OrderedList los escribe sola: teclear "3. " al empezar una lista produce
   * '<ol start="3">', y teclear "a) " produce 'type="a"'. Sin permitirlos, el
   * editor mostraba la numeración correcta y al guardar se renumeraba desde 1.
   */
  if (etiqueta === 'OL') {
    if (nombre === 'start') return PATRON_INICIO_LISTA.test(valor)
    if (nombre === 'type') return TIPOS_DE_NUMERACION.has(valor)
  }

  return false
}

/** hasOwnProperty y no 'valor in tabla' para que '__proto__' no cuele. */
function esClaveDe(tabla: object, valor: string): boolean {
  return Object.prototype.hasOwnProperty.call(tabla, valor)
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
 * Un cuadro sin contenido útil. Tiptap deja '<p></p>' al borrar todo el texto,
 * así que no basta con comprobar que la cadena esté vacía.
 *
 * Una imagen sola cuenta como contenido aunque no aporte ni una letra: sin esta
 * comprobación, una nota con solo una captura pegada mostraría encima el texto
 * de "Doble clic para escribir".
 *
 * Quitar etiquetas con una expresión regular vale aquí porque el contenido ya
 * está saneado y la respuesta solo decide si se muestra el texto de ayuda.
 */
export function htmlEstaVacio(html: string): boolean {
  if (!html) return true
  if (/<img\b/i.test(html)) return false
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
