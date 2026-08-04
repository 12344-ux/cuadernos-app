/**
 * Envoltorio mínimo de clave-valor sobre IndexedDB.
 *
 * Se usa IndexedDB en lugar de localStorage para los documentos porque
 * localStorage tiene una cuota de ~5 MB por origen y es sincrónico: con
 * cientos o miles de ideas por materia se llena y además bloquea el hilo
 * principal justo mientras se está editando el lienzo.
 */

const NOMBRE_DB = 'cuadernos'
const ALMACEN = 'documentos'
const VERSION_DB = 1

let promesaDb: Promise<IDBDatabase> | null = null

function abrirDb(): Promise<IDBDatabase> {
  if (promesaDb) return promesaDb

  promesaDb = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(NOMBRE_DB, VERSION_DB)

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result
      if (!db.objectStoreNames.contains(ALMACEN)) {
        db.createObjectStore(ALMACEN)
      }
    }

    solicitud.onsuccess = () => resolver(solicitud.result)
    solicitud.onerror = () => rechazar(solicitud.error)
    solicitud.onblocked = () => rechazar(new Error('IndexedDB bloqueada por otra pestaña'))
  })

  // Si falla la apertura, no cachear el fallo para siempre.
  promesaDb.catch(() => {
    promesaDb = null
  })

  return promesaDb
}

function ejecutar<T>(
  modo: IDBTransactionMode,
  operacion: (almacen: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrirDb().then(
    (db) =>
      new Promise<T>((resolver, rechazar) => {
        const transaccion = db.transaction(ALMACEN, modo)
        const solicitud = operacion(transaccion.objectStore(ALMACEN))

        solicitud.onsuccess = () => resolver(solicitud.result)
        solicitud.onerror = () => rechazar(solicitud.error)
        transaccion.onabort = () => rechazar(transaccion.error)
      }),
  )
}

export function leer<T>(clave: string): Promise<T | undefined> {
  return ejecutar<T | undefined>('readonly', (almacen) => almacen.get(clave))
}

export function escribir<T>(clave: string, valor: T): Promise<void> {
  return ejecutar('readwrite', (almacen) => almacen.put(valor, clave)).then(() => undefined)
}

export function eliminar(clave: string): Promise<void> {
  return ejecutar('readwrite', (almacen) => almacen.delete(clave)).then(() => undefined)
}

export function claves(): Promise<string[]> {
  return ejecutar<IDBValidKey[]>('readonly', (almacen) => almacen.getAllKeys()).then((lista) =>
    lista.map(String),
  )
}
