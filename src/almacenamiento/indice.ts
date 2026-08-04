import { VERSION_INDICE, type Cuaderno, type IndiceCuadernos } from '../tipos'

/**
 * Índice de materias. Vive en localStorage porque son unos pocos KB y conviene
 * leerlo de forma sincrónica al arrancar, para pintar el selector sin parpadeo.
 * Los lienzos, que sí crecen, van en IndexedDB (ver documentos.ts).
 */
const CLAVE = 'cuadernos:indice'

const INDICE_VACIO: IndiceCuadernos = {
  version: VERSION_INDICE,
  cuadernos: [],
  ultimoCuaderno: null,
  actualizado: 0,
}

/** Normaliza un índice venido de localStorage o de la nube. */
export function normalizarIndice(datos: unknown): IndiceCuadernos {
  if (
    typeof datos !== 'object' ||
    datos === null ||
    !Array.isArray((datos as IndiceCuadernos).cuadernos)
  ) {
    return { ...INDICE_VACIO }
  }

  const entrada = datos as IndiceCuadernos

  return {
    version: VERSION_INDICE,
    ultimoCuaderno: entrada.ultimoCuaderno ?? null,
    actualizado: Number(entrada.actualizado) || 0,
    cuadernos: entrada.cuadernos.map(
      (c): Cuaderno => ({
        id: String(c.id),
        nombre: String(c.nombre ?? 'Sin nombre'),
        creado: Number(c.creado) || Date.now(),
        modificado: Number(c.modificado) || Date.now(),
        archivado: Boolean(c.archivado),
        numIdeas: Number(c.numIdeas) || 0,
        ...(c.eliminado ? { eliminado: true as const } : {}),
      }),
    ),
  }
}

export function leerIndice(): IndiceCuadernos {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return { ...INDICE_VACIO }
    return normalizarIndice(JSON.parse(crudo))
  } catch (error) {
    console.error('No se pudo leer el índice de cuadernos', error)
    return { ...INDICE_VACIO }
  }
}

/** Las materias que la interfaz debe mostrar: sin lápidas de borrado. */
export function cuadernosVisibles(indice: IndiceCuadernos): Cuaderno[] {
  return indice.cuadernos.filter((c) => !c.eliminado)
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
