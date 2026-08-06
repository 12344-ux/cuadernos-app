import { VERSION_APUNTE, apunteVacio, type Apunte } from '../apuntes/tipos'
import { sanearHtml } from '../texto/saneador'
import * as idb from './idb'

/**
 * Los apuntes de cada clase, un registro por clase.
 *
 * Se conserva el prefijo 'apuntes' con el que ya estaban guardados para no dejar
 * registros huérfanos en IndexedDB de los dispositivos que vengan de la versión
 * anterior: la misma clave se sobrescribe con el formato nuevo.
 */
function clave(idClase: string): string {
  return `apuntes:${idClase}`
}

/**
 * Interpreta unos apuntes, vengan de IndexedDB o de un archivo de GitHub.
 *
 * Los apuntes nacieron como un lienzo de cuadros con coordenadas ({ nodes, edges }).
 * Ese formato se descarta en lugar de convertirse: pegar los cuadros uno detrás de
 * otro por su posición daba un orden que no tenía por qué ser el que su autor tenía
 * en la cabeza, y en la práctica lo único que había escrito eran pruebas. Vale más
 * empezar la hoja limpia que arrastrar un texto reordenado a medias.
 */
export function normalizarApunte(datos: unknown): Apunte | null {
  const crudo = (datos ?? {}) as Record<string, unknown>

  // La huella del formato de lienzo. Se reconoce y se deja atrás.
  if (Array.isArray(crudo.nodes) || Array.isArray(crudo.edges)) return apunteVacio()

  /*
   * Una versión posterior a la que este código entiende no se toca: se devuelve null y
   * quien llama lo trata como "no he podido leerlo", que impide subir encima. Adivinar
   * y guardar sería la forma de que una versión vieja de la aplicación vaciara una hoja
   * escrita con una nueva.
   */
  if (typeof crudo.version === 'number' && crudo.version > VERSION_APUNTE) return null

  const contenido = typeof crudo.contenido === 'string' ? crudo.contenido : ''
  const escrito =
    typeof crudo.escrito === 'number' && Number.isFinite(crudo.escrito) ? crudo.escrito : 0

  return {
    version: VERSION_APUNTE,
    // Se sanea también al cargar, y no solo al mostrar, para no reescribir en el
    // repositorio el contenido manipulado que pudiera traer un archivo ajeno.
    contenido: sanearHtml(contenido),
    escrito: Math.max(0, escrito),
  }
}

export async function cargarApunte(idClase: string): Promise<Apunte> {
  const guardado = await idb.leer<Apunte>(clave(idClase))
  // En local, una versión que no se entiende se muestra vacía pero no se sobrescribe
  // hasta que el usuario escriba: es lo mismo que hace el resto de la aplicación.
  return (guardado && normalizarApunte(guardado)) || apunteVacio()
}

export async function guardarApunte(idClase: string, apunte: Apunte): Promise<void> {
  await idb.escribir<Apunte>(clave(idClase), { ...apunte, version: VERSION_APUNTE })
}

export async function eliminarApunte(idClase: string): Promise<void> {
  await idb.eliminar(clave(idClase))
}

/**
 * Combina los apuntes de una clase vistos por dos dispositivos.
 *
 * Gana el que se escribió más tarde, sin preguntar. Es lo que hace un procesador de
 * textos con un archivo en la nube, y la alternativa no existe: dos versiones de un
 * texto continuo no se pueden unir como se unen los cuadros de un mapa por su
 * identificador, porque no hay forma de saber dónde encaja cada párrafo.
 */
export function fusionarApuntes(local: Apunte, remoto: Apunte, ganaLocal: boolean): Apunte {
  if (local.escrito !== remoto.escrito) return local.escrito > remoto.escrito ? local : remoto
  // A igualdad de fecha decide quien lleve la razón según el índice de clases.
  return ganaLocal ? local : remoto
}
