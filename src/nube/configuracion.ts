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
