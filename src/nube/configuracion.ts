/** Repositorio privado donde viven los apuntes. */
export const REPO_DATOS = {
  propietario: '12344-ux',
  nombre: 'cuadernos-data',
  rama: 'main',
} as const

/** Rutas dentro del repositorio de datos. */
export const RUTA_INDICE = 'indice.json'

export function rutaMateria(idCuaderno: string): string {
  return `materias/${idCuaderno}.json`
}

/** Cada cuánto se sube a la nube si hay cambios pendientes. */
export const INTERVALO_SUBIDA_MS = 2 * 60 * 1000

/**
 * No se sube en cada pulsación como en local: cada escritura es un commit en
 * GitHub, así que se agrupa. Además se sube al cerrar la pestaña y con el botón
 * manual, para que nunca se pierda nada por esperar al intervalo.
 */
export const RETARDO_SUBIDA_MS = 4000
