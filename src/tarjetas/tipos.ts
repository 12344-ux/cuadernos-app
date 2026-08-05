/** Estado de repetición espaciada de una tarjeta, según SM-2. */
export type Programacion = {
  /** Intervalo vigente en días. 0 significa nueva o recién fallada. */
  intervalo: number
  /** El E-Factor de SM-2. Arranca en 2.5 y nunca baja de 1.3. */
  facilidad: number
  /** Repasos acertados seguidos: es la 'n' de I(n). Vuelve a 0 al fallar. */
  repeticiones: number
  /** Día del próximo repaso, 'AAAA-MM-DD' local. null = nunca repasada. */
  proximoRepaso: string | null
  ultimoRepaso: number | null
  /**
   * Veces que se ha fallado en total. El algoritmo no lo usa; se guarda porque
   * es el dato que hace falta para señalar las tarjetas problemáticas, y
   * añadirlo más adelante obligaría a otra migración.
   */
  lapsos: number
}

export type Tarjeta = {
  id: string
  /**
   * Anverso y reverso como HTML de Tiptap, el mismo formato y el mismo saneado
   * que el contenido de los cuadros del lienzo.
   */
  anverso: string
  reverso: string
  creado: number
  programacion: Programacion
}

export type Mazo = {
  id: string
  nombre: string
  creado: number
  modificado: number
  tarjetas: Tarjeta[]
}

export const VERSION_MAZOS = 1 as const

/**
 * Los mazos de una materia. Viven en su propio archivo, aparte del lienzo:
 * si compartieran documento, repasar una tarjeta reescribiría el mapa entero,
 * lo marcaría como modificado y generaría un commit sobre él. Estudiar y
 * dibujar el mapa son cosas independientes.
 */
export type DocumentoMazos = {
  version: typeof VERSION_MAZOS
  mazos: Mazo[]
}

export function documentoMazosVacio(): DocumentoMazos {
  return { version: VERSION_MAZOS, mazos: [] }
}
