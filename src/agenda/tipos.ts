export type Tarea = {
  id: string
  texto: string
  /** Día en que debe aparecer en la agenda, 'AAAA-MM-DD' local. */
  fecha: string
  completada: boolean
  fechaCreacion: number
  /** Cuándo se marcó como hecha. null mientras está pendiente. */
  fechaCompletada: number | null
  /**
   * Última vez que se tocó la tarea, en cualquier sentido.
   *
   * Existe para poder combinar dos dispositivos sin adivinar: si editas el texto
   * en el portátil y marcas la misma tarea en el móvil, gana la versión tocada
   * más tarde. En una lista de tareas equivocarse en esto se nota mucho más que
   * en un mapa con cien cuadros.
   */
  modificado: number
  /**
   * Lápida de borrado, igual que en el índice de materias. Si la tarea se
   * quitara del archivo sin más, al sincronizar con un dispositivo que todavía
   * la tuviera reaparecería.
   */
  eliminada?: true
}

export const VERSION_AGENDA = 1 as const

/**
 * La agenda completa. Vive en su propio archivo y no dentro del índice de
 * materias ni de ningún cuaderno: son tareas tuyas, no de una materia concreta,
 * y borrar una materia no debe llevárselas.
 */
export type DocumentoAgenda = {
  version: typeof VERSION_AGENDA
  tareas: Tarea[]
}

export function documentoAgendaVacio(): DocumentoAgenda {
  return { version: VERSION_AGENDA, tareas: [] }
}
