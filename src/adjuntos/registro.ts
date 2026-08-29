/*
 * El registro de adjuntos de una materia, contra GitHub.
 *
 * Vive FUERA del ciclo de sincronización de nube/sincronizacion.ts, y es
 * deliberado. Ese ciclo existe para datos que se editan en dos sitios y hay que
 * fusionar; un adjunto no se edita nunca: se sube una vez y se borra o no. Meterlo
 * en el ciclo le añadiría peticiones a cada vuelta y riesgo a un motor que
 * funciona, sin ganar nada.
 *
 * A cambio, el registro se lee cuando se abre el panel y no queda copia local.
 * Eso significa que la lista necesita conexión, que es exactamente el trato que
 * se pidió: el PDF descargado ya vive en la carpeta de descargas del dispositivo,
 * y el explorador de archivos hace de caché.
 */
import { nuevoId } from '../almacenamiento/indice'
import { rutaAdjunto, rutaRegistroAdjuntos } from '../nube/configuracion'
import { ErrorConflicto, type ClienteGitHub } from '../nube/github'
import {
  AdjuntoDemasiadoGrande,
  TOPE_ADJUNTO,
  VERSION_ADJUNTOS,
  extensionDe,
  registroVacio,
  type Adjunto,
  type RegistroAdjuntos,
} from './tipos'

function numero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto
}

/**
 * Reconstruye una entrada campo a campo.
 *
 * Un registro con una entrada estropeada no debe tumbar la lista entera, así que
 * lo que no se puede reconstruir se descarta devolviendo null.
 */
function normalizarAdjunto(datos: unknown): Adjunto | null {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const id = typeof crudo.id === 'string' && crudo.id ? crudo.id : null
  // Sin identificador no hay forma de encontrar el archivo: la entrada no sirve.
  if (!id) return null

  return {
    id,
    nombre:
      typeof crudo.nombre === 'string' && crudo.nombre.trim()
        ? crudo.nombre.trim()
        : 'documento.pdf',
    bytes: Math.max(0, Math.round(numero(crudo.bytes, 0))),
    subido: numero(crudo.subido, 0),
    idClase: typeof crudo.idClase === 'string' && crudo.idClase ? crudo.idClase : null,
    ...(crudo.eliminado ? { eliminado: true as const } : {}),
  }
}

export function normalizarRegistro(datos: unknown): RegistroAdjuntos {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const lista = Array.isArray(crudo.adjuntos) ? crudo.adjuntos : []
  const adjuntos: Adjunto[] = []
  for (const entrada of lista) {
    const adjunto = normalizarAdjunto(entrada)
    if (adjunto) adjuntos.push(adjunto)
  }
  return { version: VERSION_ADJUNTOS, adjuntos }
}

/**
 * Une dos registros por identificador.
 *
 * No hay que decidir contenidos, porque un adjunto es inmutable: existe o está
 * borrado. Por eso la regla es simple y la lápida siempre gana, igual que en el
 * índice de materias: si un dispositivo lo borró, no debe reaparecer porque otro
 * todavía lo tuviera.
 */
export function unirRegistros(a: RegistroAdjuntos, b: RegistroAdjuntos): RegistroAdjuntos {
  const porId = new Map<string, Adjunto>()
  for (const adjunto of [...a.adjuntos, ...b.adjuntos]) {
    const previo = porId.get(adjunto.id)
    if (!previo) {
      porId.set(adjunto.id, adjunto)
      continue
    }
    porId.set(adjunto.id, adjunto.eliminado || previo.eliminado ? { ...previo, ...adjunto, eliminado: true } : previo)
  }
  return { version: VERSION_ADJUNTOS, adjuntos: [...porId.values()] }
}

type RegistroConSha = { registro: RegistroAdjuntos; sha: string | undefined }

export async function leerRegistro(
  cliente: ClienteGitHub,
  idMateria: string,
): Promise<RegistroConSha> {
  const remoto = await cliente.leerArchivo(rutaRegistroAdjuntos(idMateria))
  if (!remoto) return { registro: registroVacio(), sha: undefined }

  try {
    return { registro: normalizarRegistro(JSON.parse(remoto.contenido)), sha: remoto.sha }
  } catch (error) {
    console.error('El registro de adjuntos no se pudo interpretar', error)
    /*
     * Se devuelve el sha aunque el contenido no sirva.
     *
     * Sin él, el siguiente PUT iría sin sha y GitHub lo tomaría como creación,
     * pisando el archivo. Con él, la escritura respeta el control de concurrencia
     * y la fusión de más abajo parte de una lista vacía en lugar de inventarse
     * que el archivo no existe.
     */
    return { registro: registroVacio(), sha: remoto.sha }
  }
}

/**
 * Aplica un cambio sobre el registro y lo sube.
 *
 * Si otro dispositivo escribió en medio, GitHub rechaza el PUT por sha y aquí se
 * relee, se vuelve a aplicar el cambio sobre lo nuevo y se reintenta una vez. Es
 * el mismo patrón que usa 'sincronizarArchivo', y funciona porque el cambio es
 * siempre añadir o marcar una entrada, no reescribir la lista.
 */
async function cambiarRegistro(
  cliente: ClienteGitHub,
  idMateria: string,
  mensaje: string,
  aplicar: (registro: RegistroAdjuntos) => RegistroAdjuntos,
): Promise<RegistroAdjuntos> {
  const ruta = rutaRegistroAdjuntos(idMateria)
  const { registro, sha } = await leerRegistro(cliente, idMateria)
  const siguiente = aplicar(registro)

  try {
    await cliente.escribirArchivo(ruta, JSON.stringify(siguiente, null, 2), sha, mensaje)
    return siguiente
  } catch (error) {
    if (!(error instanceof ErrorConflicto)) throw error

    const fresco = await leerRegistro(cliente, idMateria)
    const combinado = aplicar(unirRegistros(fresco.registro, registro))
    await cliente.escribirArchivo(
      ruta,
      JSON.stringify(combinado, null, 2),
      fresco.sha,
      mensaje,
    )
    return combinado
  }
}

/**
 * Sube un PDF y lo anota.
 *
 * El orden importa y no es intercambiable: primero el archivo, y solo si eso sale
 * bien se escribe el registro. Al revés quedaría un nombre en la lista apuntando
 * a un archivo que no existe, y el fallo aparecería mucho después, al intentar
 * descargarlo. Es el mismo principio por el que la sincronización sube el índice
 * al final y no al principio.
 */
export async function subirAdjunto(
  cliente: ClienteGitHub,
  idMateria: string,
  idClase: string | null,
  archivo: File,
): Promise<RegistroAdjuntos> {
  if (archivo.size > TOPE_ADJUNTO) throw new AdjuntoDemasiadoGrande()

  const id = nuevoId()
  const bytes = new Uint8Array(await archivo.arrayBuffer())

  // Sin sha: es un archivo nuevo con identificador recién generado, así que no
  // puede existir ya en el repositorio.
  await cliente.escribirBinario(
    rutaAdjunto(id, extensionDe(archivo.name)),
    bytes,
    undefined,
    `Subir documento ${archivo.name}`,
  )

  const entrada: Adjunto = {
    id,
    nombre: archivo.name,
    bytes: archivo.size,
    subido: Date.now(),
    idClase,
  }

  return cambiarRegistro(cliente, idMateria, `Anotar documento ${archivo.name}`, (registro) => ({
    version: VERSION_ADJUNTOS,
    adjuntos: [...registro.adjuntos.filter((a) => a.id !== id), entrada],
  }))
}

/** Trae los bytes de un adjunto para poder entregarlo al navegador. */
export async function descargarAdjunto(
  cliente: ClienteGitHub,
  adjunto: Adjunto,
): Promise<Uint8Array<ArrayBuffer>> {
  const remoto = await cliente.leerBinario(rutaAdjunto(adjunto.id, extensionDe(adjunto.nombre)))
  if (!remoto) {
    throw new Error(
      `"${adjunto.nombre}" ya no está en la nube. Puede haberse borrado desde otro dispositivo.`,
    )
  }
  return remoto.bytes
}

/**
 * Borra un adjunto: primero la lápida en el registro y después el archivo.
 *
 * Este orden es el contrario al de la subida, y por la misma razón de fondo: que
 * un fallo a medias no deje nada roto a la vista. Si se cayera la red tras la
 * lápida, el archivo queda huérfano en el repositorio pero la app ya no lo
 * ofrece; al revés, la lista mostraría un documento que ya no se puede descargar.
 *
 * Los bytes, eso sí, siguen en el historial de git para siempre. Es el único
 * gasto de esta función que no se puede deshacer.
 */
export async function eliminarAdjunto(
  cliente: ClienteGitHub,
  idMateria: string,
  adjunto: Adjunto,
): Promise<RegistroAdjuntos> {
  const registro = await cambiarRegistro(
    cliente,
    idMateria,
    `Quitar documento ${adjunto.nombre}`,
    (actual) => ({
      version: VERSION_ADJUNTOS,
      adjuntos: actual.adjuntos.map((a) =>
        a.id === adjunto.id ? { ...a, eliminado: true as const } : a,
      ),
    }),
  )

  const ruta = rutaAdjunto(adjunto.id, extensionDe(adjunto.nombre))
  const remoto = await cliente.leerBinario(ruta)
  if (remoto) {
    await cliente.eliminarArchivo(ruta, remoto.sha, `Borrar documento ${adjunto.nombre}`)
  }

  return registro
}

/** Las entradas vivas, las más recientes primero. */
export function adjuntosVisibles(registro: RegistroAdjuntos): Adjunto[] {
  return registro.adjuntos.filter((a) => !a.eliminado).sort((a, b) => b.subido - a.subido)
}
