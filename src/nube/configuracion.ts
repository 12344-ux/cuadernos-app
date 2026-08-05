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
