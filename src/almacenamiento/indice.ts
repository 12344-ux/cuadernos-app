import { VERSION_INDICE, type Cuaderno, type IndiceCuadernos } from '../tipos'

/**
 * Índice de materias. Vive en localStorage porque son unos pocos KB y conviene
 * leerlo de forma sincrónica al arrancar, para pintar el selector sin parpadeo.
 * Los lienzos, que sí crecen, van en IndexedDB (ver documentos.ts).
 */
const CLAVE = 'cuadernos:indice'

export function leerIndice(): IndiceCuadernos {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return { version: VERSION_INDICE, cuadernos: [] }

    const datos = JSON.parse(crudo) as unknown
    if (
      typeof datos !== 'object' ||
      datos === null ||
      !Array.isArray((datos as IndiceCuadernos).cuadernos)
    ) {
      return { version: VERSION_INDICE, cuadernos: [] }
    }

    // Normaliza para tolerar índices escritos por versiones anteriores.
    const cuadernos = (datos as IndiceCuadernos).cuadernos.map(
      (c): Cuaderno => ({
        id: String(c.id),
        nombre: String(c.nombre ?? 'Sin nombre'),
        creado: Number(c.creado) || Date.now(),
        modificado: Number(c.modificado) || Date.now(),
        archivado: Boolean(c.archivado),
        numIdeas: Number(c.numIdeas) || 0,
      }),
    )

    return { version: VERSION_INDICE, cuadernos }
  } catch (error) {
    console.error('No se pudo leer el índice de cuadernos', error)
    return { version: VERSION_INDICE, cuadernos: [] }
  }
}

export function escribirIndice(indice: IndiceCuadernos): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(indice))
  } catch (error) {
    console.error('No se pudo guardar el índice de cuadernos', error)
  }
}

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
