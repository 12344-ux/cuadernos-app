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
import { VERSION_INDICE, type Cuaderno, type IndiceCuadernos } from '../tipos'
import { RUTA_INDICE, rutaMateria } from './configuracion'
import { ClienteGitHub, ErrorConflicto } from './github'

/** Una materia que cambió aquí y en la nube desde la última sincronización. */
export type Conflicto = {
  idCuaderno: string
  nombre: string
  modificadoLocal: number
  modificadoRemoto: number
}

export type ResultadoSincronizacion = {
  indice: IndiceCuadernos
  bajadas: string[]
  subidas: string[]
  conflictos: Conflicto[]
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
  const conflictos: Conflicto[] = []

  // ---- 1. Índice remoto ----
  const archivoIndice = await cliente.leerArchivo(RUTA_INDICE)
  const remoto: IndiceCuadernos = archivoIndice
    ? normalizarIndice(JSON.parse(archivoIndice.contenido))
    : { version: VERSION_INDICE, cuadernos: [], ultimoCuaderno: null, actualizado: 0 }

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

    // Conflicto real: cambió aquí y allí desde la última vez que lo vimos.
    if (tieneCambiosLocales && remotoEsMasNuevo) {
      const actual = await cliente.leerArchivo(ruta)
      if (actual && shas[ruta] && actual.sha !== shas[ruta]) {
        conflictos.push({
          idCuaderno: cuaderno.id,
          nombre: cuaderno.nombre,
          modificadoLocal: entradaLocal?.modificado ?? 0,
          modificadoRemoto: entradaRemota.modificado,
        })
        continue
      }
    }

    if (remotoEsMasNuevo && !tieneCambiosLocales) {
      const archivo = await cliente.leerArchivo(ruta)
      if (archivo) {
        await guardarDocumento(cuaderno.id, JSON.parse(archivo.contenido))
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
        if (error instanceof ErrorConflicto) {
          conflictos.push({
            idCuaderno: cuaderno.id,
            nombre: cuaderno.nombre,
            modificadoLocal: entradaLocal?.modificado ?? 0,
            modificadoRemoto: entradaRemota?.modificado ?? 0,
          })
        } else {
          throw error
        }
      }
    }
  }

  // ---- 3. Índice al final ----
  const indiceFinal: IndiceCuadernos = { ...fusionado, actualizado: Date.now() }
  const shaIndice = leerShas()[RUTA_INDICE]
  const nuevoShaIndice = await cliente.escribirArchivo(
    RUTA_INDICE,
    JSON.stringify(indiceFinal, null, 2),
    shaIndice,
    'Actualizar índice de materias',
  )
  recordarSha(RUTA_INDICE, nuevoShaIndice)

  escribirIndice(indiceFinal)
  registrarSincronizacion()

  return { indice: indiceFinal, bajadas, subidas, conflictos }
}

/** Resuelve un conflicto conservando la versión de este dispositivo. */
export async function resolverConLocal(
  cliente: ClienteGitHub,
  idCuaderno: string,
): Promise<void> {
  const ruta = rutaMateria(idCuaderno)
  const documento = await cargarDocumento(idCuaderno)
  // Se relee el sha actual para que la escritura sea aceptada.
  const actual = await cliente.leerArchivo(ruta)
  const nuevoSha = await cliente.escribirArchivo(
    ruta,
    JSON.stringify(documento, null, 2),
    actual?.sha,
    `Conservar la versión local de ${idCuaderno}`,
  )
  recordarSha(ruta, nuevoSha)
  limpiarPendiente(idCuaderno)
}

/** Resuelve un conflicto trayendo la versión de la nube y descartando la local. */
export async function resolverConRemoto(
  cliente: ClienteGitHub,
  idCuaderno: string,
): Promise<void> {
  const ruta = rutaMateria(idCuaderno)
  const archivo = await cliente.leerArchivo(ruta)
  if (!archivo) return
  await guardarDocumento(idCuaderno, JSON.parse(archivo.contenido))
  recordarSha(ruta, archivo.sha)
  limpiarPendiente(idCuaderno)
}

/** La llama el lienzo cuando guarda en local, para que la nube sepa qué falta. */
export function anotarCambioLocal(idCuaderno: string): void {
  marcarPendiente(idCuaderno)
}
