import { crearAlmacenDocumentos } from './documentos'

/**
 * Los apuntes de cada clase.
 *
 * Son un lienzo igual que el mapa conceptual, así que reutilizan el mismo tipo de
 * documento y la misma normalización: saneado del HTML, limpieza de campos
 * efímeros y descarte de flechas hacia post-its. Lo único propio es el prefijo de
 * la clave, para que no se pisen con los mapas.
 *
 * Que compartan tipo también da gratis la fusión sin pérdidas de la nube: al
 * sincronizar, los apuntes se combinan con la misma función que los mapas.
 */
export const apuntesDeClase = crearAlmacenDocumentos('apuntes')
