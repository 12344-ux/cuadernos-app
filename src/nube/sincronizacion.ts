import {
  cargarDocumento,
  eliminarDocumento,
  guardarDocumento,
} from '../almacenamiento/documentos'
import {
  limpiarPendiente,
  leerPendientes,
  leerShas,
  marcarPendiente,
  olvidarSha,
  recordarSha,
  registrarSincronizacion,
} from '../almacenamiento/estadoNube'
import { escribirIndice, leerIndice, normalizarIndice } from '../almacenamiento/indice'
import {
  VERSION_DOCUMENTO,
  VERSION_INDICE,
  type Cuaderno,
  type DocumentoCuaderno,
  type IndiceCuadernos,
} from '../tipos'
import { RUTA_INDICE, rutaMateria } from './configuracion'
import { ClienteGitHub, ErrorConflicto } from './github'

export type ResultadoSincronizacion = {
  indice: IndiceCuadernos
  bajadas: string[]
  subidas: string[]
  /** Materias que cambiaron aquí y en la nube y se combinaron solas. */
  fusionadas: string[]
}

/**
 * Interpreta un archivo remoto sin dejar que un JSON roto tumbe la
 * sincronización entera. Si no se puede leer se devuelve null y el resto del
 * proceso lo trata como si el archivo no existiera, de modo que la versión de
 * este dispositivo lo reemplace en la siguiente subida.
 */
function interpretarDocumento(contenido: string): DocumentoCuaderno | null {
  try {
    return JSON.parse(contenido) as DocumentoCuaderno
  } catch (error) {
    console.error('El documento remoto no se pudo interpretar', error)
    return null
  }
}

function interpretarIndice(contenido: string): IndiceCuadernos | null {
  try {
    return normalizarIndice(JSON.parse(contenido))
  } catch (error) {
    console.error('El índice remoto no se pudo interpretar', error)
    return null
  }
}

function unirPorId<T extends { id: string }>(preferidos: T[], otros: T[]): T[] {
  const porId = new Map<string, T>()
  // Primero los del lado que pierde, para que el preferido los sustituya.
  for (const elemento of otros) porId.set(elemento.id, elemento)
  for (const elemento of preferidos) porId.set(elemento.id, elemento)
  return [...porId.values()]
}

/**
 * Combina dos versiones del mismo cuaderno en lugar de descartar una.
 *
 * Antes, cuando una materia cambiaba en dos sitios, la app preguntaba cuál
 * conservar y tiraba la otra. Preguntar confunde, y elegir por el usuario
 * significaría perder una tarde de trabajo sin avisar.
 *
 * Como cuadros, flechas y notas tienen identificador propio, se pueden juntar:
 * se queda la unión de los tres conjuntos, y para los elementos que existen en
 * las dos versiones manda el lado que se editó más tarde. Así lo que se hizo en
 * cada dispositivo sigue estando.
 *
 * Queda un caso sin resolver, y conviene saberlo: si en un dispositivo se borró
 * un cuadro y el otro estaba sin conexión, el cuadro reaparece. Es reversible
 * en un segundo (se vuelve a borrar) y preferible a la alternativa, que era
 * perder todo lo escrito en uno de los dos lados.
 */
export function fusionarDocumentos(
  local: DocumentoCuaderno,
  remoto: DocumentoCuaderno,
  ganaLocal: boolean,
): DocumentoCuaderno {
  const preferido = ganaLocal ? local : remoto
  const otro = ganaLocal ? remoto : local

  return {
    version: VERSION_DOCUMENTO,
    nodes: unirPorId(preferido.nodes ?? [], otro.nodes ?? []),
    edges: unirPorId(preferido.edges ?? [], otro.edges ?? []),
    // La vista es de quien la miró más tarde; no tiene sentido combinarla.
    viewport: preferido.viewport ?? otro.viewport,
    notas: unirPorId(preferido.notas ?? [], otro.notas ?? []),
  }
}

/**
 * Fusiona dos índices materia por materia quedándose con la versión más
 * reciente de cada una. Las lápidas de borrado ganan a igualdad de fecha: si un
 * dispositivo la borró y otro solo la tenía, lo correcto es que quede borrada.
 */
export function fusionarIndices(
  local: IndiceCuadernos,
  remoto: IndiceCuadernos,
): IndiceCuadernos {
  const porId = new Map<string, Cuaderno>()

  for (const cuaderno of [...remoto.cuadernos, ...local.cuadernos]) {
    const previo = porId.get(cuaderno.id)
    if (!previo) {
      porId.set(cuaderno.id, cuaderno)
      continue
    }
    if (cuaderno.modificado > previo.modificado) {
      porId.set(cuaderno.id, cuaderno)
    } else if (cuaderno.modificado === previo.modificado && cuaderno.eliminado) {
      porId.set(cuaderno.id, cuaderno)
    }
  }

  const masReciente = Math.max(local.actualizado ?? 0, remoto.actualizado ?? 0)

  return {
    version: VERSION_INDICE,
    cuadernos: [...porId.values()],
    // El "dónde me quedé" también se resuelve por recencia del índice.
    ultimoCuaderno:
      (local.actualizado ?? 0) >= (remoto.actualizado ?? 0)
        ? (local.ultimoCuaderno ?? remoto.ultimoCuaderno ?? null)
        : (remoto.ultimoCuaderno ?? local.ultimoCuaderno ?? null),
    actualizado: masReciente,
  }
}

function mapaPorId(indice: IndiceCuadernos): Map<string, Cuaderno> {
  return new Map(indice.cuadernos.map((c) => [c.id, c]))
}

/**
 * Sincronización completa en los dos sentidos.
 *
 * El orden importa: primero se lee el índice remoto y se fusiona, después se
 * bajan las materias que allí son más nuevas, luego se suben las locales
 * pendientes y al final el índice. Subir el índice al final evita anunciar
 * materias cuyo archivo todavía no existe.
 */
export async function sincronizar(cliente: ClienteGitHub): Promise<ResultadoSincronizacion> {
  const local = leerIndice()
  const shas = leerShas()
  const pendientes = new Set(leerPendientes())

  const bajadas: string[] = []
  const subidas: string[] = []
  const fusionadas: string[] = []

  // ---- 1. Índice remoto ----
  const indiceVacio: IndiceCuadernos = {
    version: VERSION_INDICE,
    cuadernos: [],
    ultimoCuaderno: null,
    actualizado: 0,
  }

  const archivoIndice = await cliente.leerArchivo(RUTA_INDICE)
  const remoto: IndiceCuadernos =
    (archivoIndice ? interpretarIndice(archivoIndice.contenido) : null) ?? indiceVacio

  if (archivoIndice) recordarSha(RUTA_INDICE, archivoIndice.sha)

  const fusionado = fusionarIndices(local, remoto)
  const enRemoto = mapaPorId(remoto)
  const enLocal = mapaPorId(local)

  // ---- 2. Bajar y subir cada materia ----
  for (const cuaderno of fusionado.cuadernos) {
    const ruta = rutaMateria(cuaderno.id)
    const entradaRemota = enRemoto.get(cuaderno.id)
    const entradaLocal = enLocal.get(cuaderno.id)

    // Lápida: borrar el archivo remoto y la copia local.
    if (cuaderno.eliminado) {
      if (entradaRemota && !entradaRemota.eliminado) {
        const actual = await cliente.leerArchivo(ruta)
        if (actual) {
          await cliente.eliminarArchivo(ruta, actual.sha, `Eliminar ${cuaderno.nombre}`)
        }
      }
      await eliminarDocumento(cuaderno.id)
      olvidarSha(ruta)
      limpiarPendiente(cuaderno.id)
      continue
    }

    const tieneCambiosLocales = pendientes.has(cuaderno.id)
    const remotoEsMasNuevo =
      entradaRemota && (!entradaLocal || entradaRemota.modificado > entradaLocal.modificado)
    const ganaLocal = (entradaLocal?.modificado ?? 0) >= (entradaRemota?.modificado ?? 0)

    // Cambió aquí y allí desde la última vez que lo vimos: se combinan las dos
    // versiones en lugar de preguntar cuál sacrificar.
    if (tieneCambiosLocales && remotoEsMasNuevo) {
      const actual = await cliente.leerArchivo(ruta)
      if (actual && shas[ruta] && actual.sha !== shas[ruta]) {
        if (await combinarYSubir(cliente, cuaderno, actual, ganaLocal)) {
          fusionadas.push(cuaderno.nombre)
        } else {
          subidas.push(cuaderno.nombre)
        }
        continue
      }
    }

    if (remotoEsMasNuevo && !tieneCambiosLocales) {
      const archivo = await cliente.leerArchivo(ruta)
      const remotoDoc = archivo ? interpretarDocumento(archivo.contenido) : null
      if (archivo && remotoDoc) {
        await guardarDocumento(cuaderno.id, remotoDoc)
        recordarSha(ruta, archivo.sha)
        bajadas.push(cuaderno.nombre)
      }
      continue
    }

    if (tieneCambiosLocales) {
      const documento = await cargarDocumento(cuaderno.id)
      try {
        const nuevoSha = await cliente.escribirArchivo(
          ruta,
          JSON.stringify(documento, null, 2),
          shas[ruta],
          `Actualizar ${cuaderno.nombre}`,
        )
        recordarSha(ruta, nuevoSha)
        limpiarPendiente(cuaderno.id)
        subidas.push(cuaderno.nombre)
      } catch (error) {
        if (!(error instanceof ErrorConflicto)) throw error
        /*
         * Otro dispositivo escribió entre nuestra lectura y nuestra escritura.
         * Se relee, se combina y se vuelve a subir: la materia no se queda
         * pendiente para siempre chocando en cada intento, que es lo que
         * ocurría antes de que la resolución fuese automática.
         */
        const actual = await cliente.leerArchivo(ruta)
        if (await combinarYSubir(cliente, cuaderno, actual, ganaLocal)) {
          fusionadas.push(cuaderno.nombre)
        } else {
          subidas.push(cuaderno.nombre)
        }
      }
    }
  }

  // ---- 3. Índice al final ----
  const indiceFinal = await subirIndice(cliente, fusionado)

  escribirIndice(indiceFinal)
  registrarSincronizacion()

  return { indice: indiceFinal, bajadas, subidas, fusionadas }
}

/**
 * Combina la versión local con la remota y sube el resultado.
 *
 * Devuelve true si hubo algo que combinar de verdad, y false si el archivo
 * remoto no existía o no se pudo leer, en cuyo caso simplemente se ha subido lo
 * de aquí.
 */
async function combinarYSubir(
  cliente: ClienteGitHub,
  cuaderno: Cuaderno,
  actual: { contenido: string; sha: string } | null,
  ganaLocal: boolean,
): Promise<boolean> {
  const ruta = rutaMateria(cuaderno.id)
  const local = await cargarDocumento(cuaderno.id)
  const remoto = actual ? interpretarDocumento(actual.contenido) : null
  const combinado = remoto ? fusionarDocumentos(local, remoto, ganaLocal) : local

  // Se guarda también aquí para que el dispositivo quede con lo mismo que la nube.
  await guardarDocumento(cuaderno.id, combinado)

  const nuevoSha = await cliente.escribirArchivo(
    ruta,
    JSON.stringify(combinado, null, 2),
    actual?.sha,
    remoto ? `Combinar cambios de ${cuaderno.nombre}` : `Actualizar ${cuaderno.nombre}`,
  )
  recordarSha(ruta, nuevoSha)
  limpiarPendiente(cuaderno.id)
  return remoto !== null
}

/**
 * Sube el índice, reintentando una vez si otro dispositivo lo escribió mientras
 * trabajábamos. Antes, ese choque lanzaba la excepción fuera de sincronizar() y
 * abortaba todo el proceso con un mensaje genérico.
 */
async function subirIndice(
  cliente: ClienteGitHub,
  fusionado: IndiceCuadernos,
): Promise<IndiceCuadernos> {
  const indiceFinal: IndiceCuadernos = { ...fusionado, actualizado: Date.now() }

  try {
    const nuevoSha = await cliente.escribirArchivo(
      RUTA_INDICE,
      JSON.stringify(indiceFinal, null, 2),
      leerShas()[RUTA_INDICE],
      'Actualizar índice de materias',
    )
    recordarSha(RUTA_INDICE, nuevoSha)
    return indiceFinal
  } catch (error) {
    if (!(error instanceof ErrorConflicto)) throw error

    const archivo = await cliente.leerArchivo(RUTA_INDICE)
    const remoto = archivo ? interpretarIndice(archivo.contenido) : null
    const reintento: IndiceCuadernos = {
      ...(remoto ? fusionarIndices(indiceFinal, remoto) : indiceFinal),
      actualizado: Date.now(),
    }

    const nuevoSha = await cliente.escribirArchivo(
      RUTA_INDICE,
      JSON.stringify(reintento, null, 2),
      archivo?.sha,
      'Actualizar índice de materias',
    )
    recordarSha(RUTA_INDICE, nuevoSha)
    return reintento
  }
}

/** La llama el lienzo cuando guarda en local, para que la nube sepa qué falta. */
export function anotarCambioLocal(idCuaderno: string): void {
  marcarPendiente(idCuaderno)
}
