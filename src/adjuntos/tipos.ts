/*
 * Documentos adjuntos (PDF) de una materia.
 *
 * ¿Por qué un archivo de registro NUEVO en vez de una lista dentro de
 * 'clases/<id>.json', que ya existe?
 *
 * Porque los normalizadores de esta aplicación reconstruyen los objetos campo a
 * campo y descartan lo que no conocen (ver 'normalizarClase' en
 * almacenamiento/clases.ts, o 'normalizarIndice' en almacenamiento/indice.ts).
 * Si la lista de adjuntos viviera dentro de un archivo que ya existe, una
 * versión antigua de la app —la que quede en la caché del móvil, por ejemplo— lo
 * leería, borraría el campo por no conocerlo y lo subiría sin él. Los PDF
 * seguirían en el repositorio, pero la app dejaría de saber que existen, y sin
 * ningún error de por medio.
 *
 * Con un archivo propio eso es imposible: una versión antigua no sabe que
 * 'archivos/<idMateria>.json' existe, así que nunca lo lee ni lo escribe. Como
 * efecto secundario, tampoco hace falta subir la versión de ningún formato ya
 * publicado ni migrar nada.
 */

export const VERSION_ADJUNTOS = 1

/**
 * Una entrada del registro. El PDF en sí vive aparte, en
 * 'adjuntos/<id>.pdf', y este objeto es lo único que se lee para pintar la lista.
 */
export type Adjunto = {
  /** Identificador propio; es también el nombre del archivo remoto. */
  id: string
  /**
   * El nombre con el que se subió, que es el que se usará al descargar.
   *
   * Se guarda aquí y no en la ruta remota a propósito: un nombre real trae
   * espacios, tildes y paréntesis, y meterlo en la ruta obligaría a codificarlo
   * y arrastraría problemas al comparar rutas. La ruta lleva el identificador,
   * que es siempre seguro.
   */
  nombre: string
  /** Tamaño real del PDF, para poder mostrarlo sin descargarlo. */
  bytes: number
  subido: number
  /**
   * La clase a la que pertenece, si se subió desde Estudio Activo teniendo una
   * clase abierta. 'null' significa que es de la materia en general.
   *
   * Es una etiqueta, no una jerarquía: el registro sigue siendo uno por materia,
   * así que borrar o renombrar una clase nunca se lleva por delante sus PDF.
   */
  idClase: string | null
  /**
   * Lápida. Igual que en el índice de materias y en la agenda: si la entrada se
   * quitara del archivo sin más, otro dispositivo que aún la tuviera la
   * resucitaría al combinar.
   */
  eliminado?: true
}

export type RegistroAdjuntos = {
  version: number
  adjuntos: Adjunto[]
}

export function registroVacio(): RegistroAdjuntos {
  return { version: VERSION_ADJUNTOS, adjuntos: [] }
}

/** Solo PDF. Es lo que se pidió, y es lo que mantiene la función previsible. */
export const TIPO_ADJUNTO = 'application/pdf'

/**
 * Tope duro por archivo.
 *
 * No lo impone GitHub —su API admite bastante más— sino la forma de la subida:
 * es un único PUT sin reanudación, así que si falla a mitad se reintenta desde
 * cero. Veinticinco megas ya es un envío largo con datos móviles; más allá, la
 * probabilidad de tener que repetirlo entero deja de valer la pena.
 */
export const TOPE_ADJUNTO = 25 * 1024 * 1024

/** A partir de aquí se avisa antes de subir, pero se deja continuar. */
export const AVISO_ADJUNTO = 10 * 1024 * 1024

export class AdjuntoDemasiadoGrande extends Error {
  constructor() {
    super('Ese PDF pesa más de 25 MB.')
    this.name = 'AdjuntoDemasiadoGrande'
  }
}

export class NoEsPdf extends Error {
  constructor() {
    super('Aquí solo entran archivos PDF.')
    this.name = 'NoEsPdf'
  }
}

/**
 * ¿Es un PDF?
 *
 * Se mira el tipo que declara el navegador y, si viene vacío, la extensión. Al
 * arrastrar desde algunos gestores de archivos el 'type' llega en blanco, y
 * rechazar por eso un PDF perfectamente válido sería desconcertante.
 */
export function esPdf(archivo: File): boolean {
  if (archivo.type) return archivo.type === TIPO_ADJUNTO
  return archivo.name.toLowerCase().endsWith('.pdf')
}

/** Para mostrar el peso sin pensar en unidades. */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
