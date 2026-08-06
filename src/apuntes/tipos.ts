/**
 * Los apuntes de una clase: un único documento continuo.
 *
 * Antes esto era un lienzo infinito de cuadros con coordenadas, el mismo que el
 * mapa conceptual. No servía para lo que son unos apuntes de clase: se toma nota de
 * arriba abajo, siguiendo lo que se explica, y tener que crear y colocar un cuadro
 * por idea añadía trabajo justo en el momento en el que no hay tiempo para nada.
 * El lienzo infinito se queda donde sí aporta, que es el mapa conceptual.
 *
 * Así que un apunte es ahora una hoja: HTML de Tiptap, y crece hacia abajo.
 */
/*
 * Va en 2 y no en 1 a propósito. El formato de lienzo que había antes en este mismo
 * archivo también se numeraba, así que con el 1 los dos formatos se habrían llamado
 * igual y solo se distinguirían por llevar 'nodes'. Un cliente de la versión anterior
 * leería el archivo nuevo como un lienzo vacío y podría subirlo así, vaciando la clase
 * para el cliente nuevo: basta una pestaña abierta en otro dispositivo.
 */
export const VERSION_APUNTE = 2 as const

export type Apunte = {
  version: typeof VERSION_APUNTE
  /**
   * El apunte entero como HTML. Solo puede traer las etiquetas de
   * ETIQUETAS_PERMITIDAS (ver texto/saneador.ts).
   */
  contenido: string
  /**
   * Última escritura, en milisegundos.
   *
   * Es lo que decide quién gana al sincronizar. Dos versiones de un texto continuo
   * no se pueden entrelazar sin inventarse cosas, así que se conserva la más
   * reciente, igual que hace un procesador de textos con su archivo.
   */
  escrito: number
}

export function apunteVacio(): Apunte {
  return { version: VERSION_APUNTE, contenido: '', escrito: 0 }
}

/**
 * Palabras del apunte, para dar idea del avance en la lista de clases.
 *
 * Sustituye al número de cuadros, que era lo que se mostraba cuando los apuntes
 * eran un lienzo y aquí ya no significa nada.
 */
export function contarPalabras(html: string): number {
  if (!html) return 0

  /*
   * Se cuenta sobre la cadena y no recorriendo el DOM. Esto se ejecuta en cada guardado
   * de la hoja, o sea cada 700 ms mientras se escribe, y el camino del DOM saneaba y
   * volvía a serializar el documento completo: con imágenes pegadas eran megabytes de
   * base64 parseados una y otra vez. Aquí las imágenes se descartan primero, justo para
   * no arrastrar su contenido.
   *
   * Vale una expresión regular porque el HTML lo genera el propio editor y ya está
   * saneado, y porque el resultado solo alimenta un contador informativo.
   */
  const texto = html
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, 'x')
    .trim()

  if (!texto) return 0
  return texto.split(/\s+/).filter(Boolean).length
}
