/** Repositorio privado donde viven los apuntes. */
export const REPO_DATOS = {
  propietario: '12344-ux',
  nombre: 'cuadernos-data',
  rama: 'main',
} as const

/** Rutas dentro del repositorio de datos. */
export const RUTA_INDICE = 'indice.json'

/**
 * La agenda de tareas, en la raíz y no dentro de una materia: son tareas tuyas y
 * no pertenecen a ninguna asignatura.
 */
export const RUTA_AGENDA = 'agenda.json'

export function rutaMateria(idCuaderno: string): string {
  return `materias/${idCuaderno}.json`
}

/**
 * Los mazos de flashcards, en un archivo aparte del mapa de la materia. Así
 * repasar tarjetas no reescribe el lienzo ni genera commits sobre él.
 */
export function rutaMazos(idCuaderno: string): string {
  return `mazos/${idCuaderno}.json`
}

/** La lista de clases de una materia: solo metadatos, sin apuntes. */
export function rutaClases(idCuaderno: string): string {
  return `clases/${idCuaderno}.json`
}

/**
 * Los apuntes de una clase, en un archivo por clase y no todos juntos por
 * materia. Así escribir los apuntes de hoy no reescribe los de todo el semestre
 * en cada commit; y las clases que no han cambiado no cuestan ninguna petición,
 * porque su fecha de modificación viaja en la lista.
 */
export function rutaApuntes(idClase: string): string {
  return `apuntes/${idClase}.json`
}

/**
 * El registro de documentos adjuntos de una materia: solo metadatos (nombre,
 * peso, fecha), nunca el contenido.
 *
 * Es un archivo nuevo y no un campo dentro de 'clases/<id>.json' para que una
 * versión antigua de la app no pueda vaciarlo sin saberlo; el razonamiento
 * completo está en adjuntos/tipos.ts.
 */
export function rutaRegistroAdjuntos(idCuaderno: string): string {
  return `archivos/${idCuaderno}.json`
}

/**
 * El archivo en sí, en su propio archivo y fuera de cualquier JSON.
 *
 * Es lo que hace que la función sea gratis en el día a día: el adjunto se sube
 * una vez y no se vuelve a escribir nunca, así que editar los apuntes no lo
 * arrastra. Si viviera incrustado dentro del JSON de la clase, cada autoguardado
 * volvería a subir el archivo completo.
 *
 * La ruta lleva el identificador y no el nombre original, porque un nombre real
 * trae espacios, tildes y paréntesis; el nombre para descargar viaja en el
 * registro. La extensión sí se conserva, deducida de ese nombre, para que el
 * archivo se reconozca al mirarlo en GitHub.
 */
export function rutaAdjunto(idAdjunto: string, extension: string): string {
  return extension ? `adjuntos/${idAdjunto}.${extension}` : `adjuntos/${idAdjunto}`
}

/**
 * Red de seguridad: cada cuánto se revisa si quedó algo pendiente por subir.
 * La subida normal no espera a esto, la dispara RETARDO_SUBIDA_MS.
 */
export const INTERVALO_SUBIDA_MS = 2 * 60 * 1000

/**
 * Cuánto se espera tras el último cambio antes de subir.
 *
 * No se sube en cada pulsación como en local, porque cada escritura es un commit
 * en GitHub: el retardo agrupa una ráfaga de ediciones en una sola subida. Pero
 * es corto a propósito, para que nunca haya que acordarse de guardar. Además se
 * sube al ocultar la pestaña y al recuperar la conexión.
 */
export const RETARDO_SUBIDA_MS = 4000
