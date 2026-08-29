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

/**
 * Se admite cualquier tipo de archivo.
 *
 * No hay lista blanca de extensiones ni comprobación de tipo, y no es descuido:
 * un adjunto se guarda y se descarga, nunca se interpreta ni se muestra, así que
 * el tipo no cambia en nada lo que la aplicación hace con él. Filtrar solo
 * serviría para rechazar por error algo perfectamente válido, y de hecho pasaría:
 * al arrastrar desde algunos gestores de archivos el 'type' del navegador llega
 * en blanco, y muchos formatos de oficina se declaran con tipos distintos según
 * el sistema.
 *
 * El único límite es el tamaño.
 */

/**
 * Tope duro por archivo.
 *
 * No lo impone GitHub —su API admite bastante más— sino la forma de la subida:
 * es un único PUT sin reanudación, así que si falla a mitad se reintenta desde
 * cero. Veinticinco megas ya es un envío largo con datos móviles; más allá, la
 * probabilidad de tener que repetirlo entero deja de valer la pena.
 */
export const TOPE_ADJUNTO = 25 * 1024 * 1024

export class AdjuntoDemasiadoGrande extends Error {
  constructor() {
    super('Ese archivo pesa más de 25 MB.')
    this.name = 'AdjuntoDemasiadoGrande'
  }
}

/**
 * La extensión del nombre, para poder reconstruir la ruta remota.
 *
 * Se deduce del nombre guardado en lugar de guardarse en un campo aparte, y esa
 * decisión es la que mantiene compatibles los adjuntos que ya estaban subidos:
 * los de antes se guardaron en 'adjuntos/<id>.pdf' y su nombre acaba en '.pdf',
 * así que esta función devuelve exactamente la misma ruta que antes. Un campo
 * nuevo, en cambio, lo habría borrado cualquier versión anterior del
 * normalizador y esos archivos se habrían vuelto inalcanzables.
 *
 * Se limita a letras y números por seguridad: la extensión entra en una ruta, y
 * un nombre como 'informe.tar.gz/../algo' no debe poder torcerla.
 */
export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  if (punto <= 0 || punto === nombre.length - 1) return ''
  const cruda = nombre.slice(punto + 1).toLowerCase()
  return /^[a-z0-9]{1,12}$/.test(cruda) ? cruda : ''
}

/** Para mostrar el peso sin pensar en unidades. */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
