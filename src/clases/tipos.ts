/**
 * Una clase de una materia: el contenedor de los apuntes tomados ese día.
 *
 * Los apuntes en sí no están aquí. Viven en su propio archivo, y esta entrada
 * solo guarda los metadatos y las dos fechas de modificación. Así renombrar una
 * clase no reescribe sus apuntes, y escribir apuntes no reescribe la lista.
 */
export type Clase = {
  id: string
  nombre: string
  /** Día de la clase, 'AAAA-MM-DD' local. */
  fecha: string
  creado: number
  /** Última vez que cambiaron el nombre o la fecha. */
  modificado: number
  /**
   * Última vez que cambiaron los apuntes. Va aparte de 'modificado' para poder
   * sincronizar los dos archivos por separado: si compartieran fecha, renombrar
   * una clase en un dispositivo haría creer al otro que sus apuntes cambiaron.
   */
  notasModificado: number
  /** Cache para la lista, sin tener que abrir el lienzo. */
  numNotas: number
  /**
   * Lápida de borrado, igual que en las materias y en la agenda: si la entrada
   * se quitara sin más, al sincronizar con un dispositivo que todavía la tuviera
   * la clase reaparecería.
   */
  eliminada?: true
}

export const VERSION_CLASES = 1 as const

/** La lista de clases de una materia. Un archivo por materia. */
export type IndiceClases = {
  version: typeof VERSION_CLASES
  clases: Clase[]
}

export function indiceClasesVacio(): IndiceClases {
  return { version: VERSION_CLASES, clases: [] }
}

/** Las clases que la interfaz debe mostrar, de la más reciente a la más antigua. */
export function clasesVisibles(indice: IndiceClases): Clase[] {
  return indice.clases
    .filter((clase) => !clase.eliminada)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado)
}
