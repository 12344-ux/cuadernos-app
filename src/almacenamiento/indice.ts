import { PALETA, VERSION_INDICE, type ColorId, type Cuaderno, type IndiceCuadernos } from '../tipos'

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

/**
 * Valida el color de una materia contra las claves de la paleta.
 *
 * Un índice puede venir de un archivo de GitHub escrito por otra versión de la
 * app, así que la clave se comprueba en lugar de confiar en ella: si no se
 * reconoce, la materia se queda sin color y se pinta con el neutro.
 */
function colorValido(valor: unknown): ColorId | undefined {
  return typeof valor === 'string' && valor in PALETA ? (valor as ColorId) : undefined
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
        // Solo se incluye si es válido: así una materia sin color no acarrea la
        // clave con 'undefined' hasta el JSON que se sube a la nube.
        ...(colorValido(c.color) ? { color: colorValido(c.color) } : {}),
        mazosModificado: Number(c.mazosModificado) || 0,
        numTarjetas: Number(c.numTarjetas) || 0,
        clasesModificado: Number(c.clasesModificado) || 0,
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
