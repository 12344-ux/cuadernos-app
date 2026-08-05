import {
  cargarDocumento,
  eliminarDocumento,
  guardarDocumento,
} from '../almacenamiento/documentos'
import {
  hayAgendaPendiente,
  limpiarAgendaPendiente,
  limpiarApuntesPendiente,
  limpiarClasesPendiente,
  limpiarMazosPendiente,
  limpiarPendiente,
  leerApuntesPendientes,
  leerClasesPendientes,
  leerMazosPendientes,
  leerPendientes,
  leerShas,
  marcarAgendaPendiente,
  marcarApuntesPendiente,
  marcarClasesPendiente,
  marcarMazosPendiente,
  marcarPendiente,
  olvidarSha,
  recordarSha,
  registrarSincronizacion,
} from '../almacenamiento/estadoNube'
import { apuntesDeClase } from '../almacenamiento/apuntes'
import {
  cargarClases,
  eliminarClases,
  guardarClases,
  normalizarIndiceClases,
} from '../almacenamiento/clases'
import { VERSION_CLASES, type Clase, type IndiceClases } from '../clases/tipos'
import { VERSION_AGENDA, type DocumentoAgenda, type Tarea } from '../agenda/tipos'
import { cargarAgenda, guardarAgenda, normalizarAgenda } from '../almacenamiento/agenda'
import { cargarMazos, eliminarMazos, guardarMazos, normalizarDocumentoMazos } from '../almacenamiento/mazos'
import {
  VERSION_MAZOS,
  type DocumentoMazos,
  type Mazo,
  type Tarjeta,
} from '../tarjetas/tipos'
import { escribirIndice, leerIndice, normalizarIndice } from '../almacenamiento/indice'
import {
  VERSION_DOCUMENTO,
  VERSION_INDICE,
  type Cuaderno,
  type DocumentoCuaderno,
  type IndiceCuadernos,
} from '../tipos'
import {
  RUTA_AGENDA,
  RUTA_INDICE,
  rutaApuntes,
  rutaClases,
  rutaMateria,
  rutaMazos,
} from './configuracion'
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
function interpretarAgenda(contenido: string): DocumentoAgenda | null {
  try {
    return normalizarAgenda(JSON.parse(contenido))
  } catch (error) {
    console.error('La agenda remota no se pudo interpretar', error)
    return null
  }
}

/**
 * Une las tareas de los dos lados. Para una que exista en ambos gana la versión
 * tocada más tarde, que es justo para lo que la tarea guarda 'modificado': sin
 * ese dato habría que elegir a ciegas entre un texto editado aquí y un visto
 * bueno marcado allá.
 *
 * El argumento 'ganaLocal' solo decide los empates exactos, que en la práctica
 * son tareas idénticas.
 */
export function fusionarAgendas(
  local: DocumentoAgenda,
  remoto: DocumentoAgenda,
  ganaLocal: boolean,
): DocumentoAgenda {
  const preferido = ganaLocal ? local : remoto
  const otro = ganaLocal ? remoto : local

  const porId = new Map<string, Tarea>()
  for (const tarea of otro.tareas ?? []) porId.set(tarea.id, tarea)

  for (const tarea of preferido.tareas ?? []) {
    const previa = porId.get(tarea.id)
    if (!previa || tarea.modificado >= previa.modificado) porId.set(tarea.id, tarea)
  }

  return { version: VERSION_AGENDA, tareas: [...porId.values()] }
}

function interpretarClases(contenido: string): IndiceClases | null {
  try {
    return normalizarIndiceClases(JSON.parse(contenido))
  } catch (error) {
    console.error('La lista de clases remota no se pudo interpretar', error)
    return null
  }
}

/**
 * Combina la misma clase vista por dos dispositivos.
 *
 * Las dos fechas se resuelven por separado, igual que con las materias: el nombre
 * y el día vienen del lado que los editó más tarde, y la recencia de los apuntes
 * del lado que escribió apuntes más tarde. Si se compararan juntas, renombrar una
 * clase en un dispositivo tumbaría la marca de apuntes escritos en el otro, y esos
 * apuntes no se bajarían nunca.
 */
function fusionarClase(a: Clase, b: Clase): Clase {
  let base: Clase
  if (b.modificado > a.modificado) base = b
  else if (a.modificado > b.modificado) base = a
  // A igualdad de fecha manda la lápida, como en las materias.
  else base = b.eliminada ? b : a

  const conApuntes = b.notasModificado > a.notasModificado ? b : a

  return {
    ...base,
    notasModificado: conApuntes.notasModificado,
    numNotas: conApuntes.numNotas,
  }
}

export function fusionarIndiceClases(
  local: IndiceClases,
  remoto: IndiceClases,
  ganaLocal: boolean,
): IndiceClases {
  const preferido = ganaLocal ? local : remoto
  const otro = ganaLocal ? remoto : local

  const porId = new Map<string, Clase>()
  for (const clase of otro.clases ?? []) porId.set(clase.id, clase)

  for (const clase of preferido.clases ?? []) {
    const previa = porId.get(clase.id)
    porId.set(clase.id, previa ? fusionarClase(previa, clase) : clase)
  }

  return { version: VERSION_CLASES, clases: [...porId.values()] }
}

function interpretarMazos(contenido: string): DocumentoMazos | null {
  try {
    return normalizarDocumentoMazos(JSON.parse(contenido))
  } catch (error) {
    console.error('Los mazos remotos no se pudieron interpretar', error)
    return null
  }
}

/**
 * Para una tarjeta que existe en los dos lados se separan dos cosas que no
 * tienen por qué venir del mismo dispositivo:
 *
 * - El **texto** lo aporta el lado que se editó más tarde.
 * - La **programación** la aporta el lado que la estudió más tarde, porque ese es
 *   el estado más avanzado del algoritmo. Si se tomara siempre la del lado
 *   preferido, repasar en el móvil y luego tocar el mazo en el portátil borraría
 *   el progreso del repaso.
 */
function fusionarTarjeta(preferida: Tarjeta, otra: Tarjeta): Tarjeta {
  const masEstudiada =
    (otra.programacion.ultimoRepaso ?? 0) > (preferida.programacion.ultimoRepaso ?? 0)
      ? otra
      : preferida

  return { ...preferida, programacion: masEstudiada.programacion }
}

function fusionarMazo(preferido: Mazo, otro: Mazo): Mazo {
  const porId = new Map<string, Tarjeta>()
  for (const tarjeta of otro.tarjetas) porId.set(tarjeta.id, tarjeta)

  for (const tarjeta of preferido.tarjetas) {
    const previa = porId.get(tarjeta.id)
    porId.set(tarjeta.id, previa ? fusionarTarjeta(tarjeta, previa) : tarjeta)
  }

  return {
    ...preferido,
    modificado: Math.max(preferido.modificado, otro.modificado),
    tarjetas: [...porId.values()],
  }
}

/** Une los mazos de los dos lados, y dentro de cada mazo sus tarjetas. */
export function fusionarMazos(
  local: DocumentoMazos,
  remoto: DocumentoMazos,
  ganaLocal: boolean,
): DocumentoMazos {
  const preferido = ganaLocal ? local : remoto
  const otro = ganaLocal ? remoto : local

  const porId = new Map<string, Mazo>()
  for (const mazo of otro.mazos ?? []) porId.set(mazo.id, mazo)

  for (const mazo of preferido.mazos ?? []) {
    const previo = porId.get(mazo.id)
    porId.set(mazo.id, previo ? fusionarMazo(mazo, previo) : mazo)
  }

  return { version: VERSION_MAZOS, mazos: [...porId.values()] }
}

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
/**
 * Combina la misma materia vista por dos dispositivos.
 *
 * Las dos fechas de modificación se resuelven por separado: el mapa y los mazos
 * son archivos distintos y se editan de forma independiente. Con una sola
 * comparación, estudiar flashcards en el móvil y retocar el mapa en el portátil
 * haría que una de las dos cosas pareciera no haber pasado.
 */
function fusionarEntrada(a: Cuaderno, b: Cuaderno): Cuaderno {
  let base: Cuaderno
  if (b.modificado > a.modificado) base = b
  else if (a.modificado > b.modificado) base = a
  // A igualdad de fecha la lápida manda: si uno la borró y el otro solo la
  // tenía, lo correcto es que quede borrada.
  else base = b.eliminado ? b : a

  const conMazos = (b.mazosModificado ?? 0) > (a.mazosModificado ?? 0) ? b : a

  return {
    ...base,
    mazosModificado: conMazos.mazosModificado ?? 0,
    numTarjetas: conMazos.numTarjetas ?? 0,
    // La lista de clases es un tercer archivo con su propia recencia.
    clasesModificado: Math.max(a.clasesModificado ?? 0, b.clasesModificado ?? 0),
  }
}

/** La fecha de la agenda se resuelve por separado, como las de cada materia. */
function fechaDeAgendaMasReciente(a: IndiceCuadernos, b: IndiceCuadernos): number {
  return Math.max(a.agendaModificado ?? 0, b.agendaModificado ?? 0)
}

export function fusionarIndices(
  local: IndiceCuadernos,
  remoto: IndiceCuadernos,
): IndiceCuadernos {
  const porId = new Map<string, Cuaderno>()

  for (const cuaderno of [...remoto.cuadernos, ...local.cuadernos]) {
    const previo = porId.get(cuaderno.id)
    porId.set(cuaderno.id, previo ? fusionarEntrada(previo, cuaderno) : cuaderno)
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
    agendaModificado: fechaDeAgendaMasReciente(local, remoto),
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
  const pendientes = new Set(leerPendientes())
  const pendientesMazos = new Set(leerMazosPendientes())

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

  const anotar = (desenlace: Desenlace, nombre: string) => {
    if (desenlace === 'bajado') bajadas.push(nombre)
    else if (desenlace === 'subido') subidas.push(nombre)
    else if (desenlace === 'fusionado') fusionadas.push(nombre)
  }

  // ---- 2. Bajar y subir cada materia: el mapa y sus mazos, por separado ----
  for (const cuaderno of fusionado.cuadernos) {
    const entradaRemota = enRemoto.get(cuaderno.id)
    const entradaLocal = enLocal.get(cuaderno.id)

    // Lápida: borrar los archivos remotos y las copias locales.
    if (cuaderno.eliminado) {
      if (entradaRemota && !entradaRemota.eliminado) {
        for (const ruta of [rutaMateria(cuaderno.id), rutaMazos(cuaderno.id)]) {
          const actual = await cliente.leerArchivo(ruta)
          if (actual) {
            await cliente.eliminarArchivo(ruta, actual.sha, `Eliminar ${cuaderno.nombre}`)
          }
        }
      }
      await borrarClasesDeMateria(cliente, cuaderno, Boolean(entradaRemota && !entradaRemota.eliminado))
      await eliminarDocumento(cuaderno.id)
      await eliminarMazos(cuaderno.id)
      olvidarSha(rutaMateria(cuaderno.id))
      olvidarSha(rutaMazos(cuaderno.id))
      limpiarPendiente(cuaderno.id)
      limpiarMazosPendiente(cuaderno.id)
      continue
    }

    // El mapa conceptual.
    anotar(
      await sincronizarArchivo(
        cliente,
        {
          ruta: rutaMateria(cuaderno.id),
          etiqueta: cuaderno.nombre,
          cargar: () => cargarDocumento(cuaderno.id),
          guardar: (documento) => guardarDocumento(cuaderno.id, documento),
          interpretar: interpretarDocumento,
          fusionar: fusionarDocumentos,
          quitarPendiente: () => limpiarPendiente(cuaderno.id),
        },
        {
          tienePendiente: pendientes.has(cuaderno.id),
          remotoEsMasNuevo: Boolean(
            entradaRemota && (!entradaLocal || entradaRemota.modificado > entradaLocal.modificado),
          ),
          ganaLocal: (entradaLocal?.modificado ?? 0) >= (entradaRemota?.modificado ?? 0),
        },
      ),
      cuaderno.nombre,
    )

    /*
     * Las flashcards, con su propia fecha de modificación. Si no hay mazos ni
     * nada pendiente, esto no hace ninguna petición ni crea archivos vacíos para
     * las materias que solo tienen mapa.
     */
    anotar(
      await sincronizarArchivo(
        cliente,
        {
          ruta: rutaMazos(cuaderno.id),
          etiqueta: `flashcards de ${cuaderno.nombre}`,
          cargar: () => cargarMazos(cuaderno.id),
          guardar: (documento) => guardarMazos(cuaderno.id, documento),
          interpretar: interpretarMazos,
          fusionar: fusionarMazos,
          quitarPendiente: () => limpiarMazosPendiente(cuaderno.id),
        },
        {
          tienePendiente: pendientesMazos.has(cuaderno.id),
          remotoEsMasNuevo: Boolean(
            entradaRemota &&
              (entradaRemota.mazosModificado ?? 0) > (entradaLocal?.mazosModificado ?? 0),
          ),
          ganaLocal:
            (entradaLocal?.mazosModificado ?? 0) >= (entradaRemota?.mazosModificado ?? 0),
        },
      ),
      `flashcards de ${cuaderno.nombre}`,
    )

    await sincronizarClases(cliente, cuaderno, entradaLocal, entradaRemota, anotar)
  }

  /*
   * ---- 3. La agenda ----
   * No cuelga de ninguna materia, así que va fuera del bucle y su fecha de
   * modificación se compara contra la del índice, no contra la de un cuaderno.
   */
  anotar(
    await sincronizarArchivo(
      cliente,
      {
        ruta: RUTA_AGENDA,
        etiqueta: 'la agenda',
        cargar: cargarAgenda,
        guardar: guardarAgenda,
        interpretar: interpretarAgenda,
        fusionar: fusionarAgendas,
        quitarPendiente: limpiarAgendaPendiente,
      },
      {
        tienePendiente: hayAgendaPendiente(),
        remotoEsMasNuevo: (remoto.agendaModificado ?? 0) > (local.agendaModificado ?? 0),
        ganaLocal: (local.agendaModificado ?? 0) >= (remoto.agendaModificado ?? 0),
      },
    ),
    'la agenda',
  )

  // ---- 4. Índice al final ----
  const indiceFinal = await subirIndice(cliente, fusionado)

  escribirIndice(indiceFinal)
  registrarSincronizacion()

  return { indice: indiceFinal, bajadas, subidas, fusionadas }
}

/**
 * Sincroniza las clases de una materia: primero la lista y después los apuntes de
 * cada clase, que son un archivo aparte.
 *
 * La gracia está en cómo se decide la dirección de cada archivo de apuntes sin
 * gastar una petición por clase. Se guarda la lista local *antes* de sincronizarla
 * y se compara con la lista ya fusionada: como la fusión se queda con la
 * 'notasModificado' más alta de los dos lados, si la fusionada supera a la que
 * teníamos es que el otro dispositivo escribió apuntes más tarde. Y si coincide,
 * no hay nada que bajar.
 *
 * Con eso, una materia con cuarenta clases en la que hoy solo se tocó una cuesta
 * dos peticiones, no cuarenta: las clases sin cambios no llegan a pedirse.
 */
async function sincronizarClases(
  cliente: ClienteGitHub,
  cuaderno: Cuaderno,
  entradaLocal: Cuaderno | undefined,
  entradaRemota: Cuaderno | undefined,
  anotar: (desenlace: Desenlace, nombre: string) => void,
): Promise<void> {
  const clasesPendientes = new Set(leerClasesPendientes())
  const apuntesPendientes = new Set(leerApuntesPendientes())

  const antes = await cargarClases(cuaderno.id)
  const notasAntes = new Map(antes.clases.map((clase) => [clase.id, clase.notasModificado]))

  anotar(
    await sincronizarArchivo(
      cliente,
      {
        ruta: rutaClases(cuaderno.id),
        etiqueta: `clases de ${cuaderno.nombre}`,
        cargar: () => cargarClases(cuaderno.id),
        guardar: (indice) => guardarClases(cuaderno.id, indice),
        interpretar: interpretarClases,
        fusionar: fusionarIndiceClases,
        quitarPendiente: () => limpiarClasesPendiente(cuaderno.id),
      },
      {
        tienePendiente: clasesPendientes.has(cuaderno.id),
        remotoEsMasNuevo: Boolean(
          entradaRemota &&
            (entradaRemota.clasesModificado ?? 0) > (entradaLocal?.clasesModificado ?? 0),
        ),
        ganaLocal:
          (entradaLocal?.clasesModificado ?? 0) >= (entradaRemota?.clasesModificado ?? 0),
      },
    ),
    `clases de ${cuaderno.nombre}`,
  )

  // La lista local ya es la fusionada; de ahí sale qué apuntes hay que mirar.
  const despues = await cargarClases(cuaderno.id)

  for (const clase of despues.clases) {
    if (clase.eliminada) {
      await apuntesDeClase.eliminar(clase.id)
      olvidarSha(rutaApuntes(clase.id))
      limpiarApuntesPendiente(clase.id)
      continue
    }

    const remotoEsMasNuevo = clase.notasModificado > (notasAntes.get(clase.id) ?? 0)

    anotar(
      await sincronizarArchivo(
        cliente,
        {
          ruta: rutaApuntes(clase.id),
          etiqueta: `apuntes de ${clase.nombre}`,
          cargar: () => apuntesDeClase.cargar(clase.id),
          guardar: (documento) => apuntesDeClase.guardar(clase.id, documento),
          interpretar: interpretarDocumento,
          // Los apuntes son un documento de lienzo, así que se combinan con la
          // misma función que los mapas: unión de notas por identificador.
          fusionar: fusionarDocumentos,
          quitarPendiente: () => limpiarApuntesPendiente(clase.id),
        },
        {
          tienePendiente: apuntesPendientes.has(clase.id),
          remotoEsMasNuevo,
          ganaLocal: !remotoEsMasNuevo,
        },
      ),
      `apuntes de ${clase.nombre}`,
    )
  }
}

/** Al eliminar una materia se van también su lista de clases y todos sus apuntes. */
async function borrarClasesDeMateria(
  cliente: ClienteGitHub,
  cuaderno: Cuaderno,
  borrarEnRemoto: boolean,
): Promise<void> {
  const indice = await cargarClases(cuaderno.id)
  const rutas = [rutaClases(cuaderno.id), ...indice.clases.map((clase) => rutaApuntes(clase.id))]

  if (borrarEnRemoto) {
    for (const ruta of rutas) {
      const actual = await cliente.leerArchivo(ruta)
      if (actual) {
        await cliente.eliminarArchivo(ruta, actual.sha, `Eliminar ${cuaderno.nombre}`)
      }
    }
  }

  for (const clase of indice.clases) {
    await apuntesDeClase.eliminar(clase.id)
    limpiarApuntesPendiente(clase.id)
  }
  for (const ruta of rutas) olvidarSha(ruta)

  await eliminarClases(cuaderno.id)
  limpiarClasesPendiente(cuaderno.id)
}

/**
 * Todo lo que cambia entre sincronizar el mapa de una materia y sincronizar sus
 * mazos. La lógica de bajar, subir y combinar es idéntica, y duplicarla habría
 * sido pedir un error: es la parte delicada.
 */
type Estrategia<T> = {
  ruta: string
  /** Se usa en el mensaje del commit. */
  etiqueta: string
  cargar: () => Promise<T>
  guardar: (valor: T) => Promise<void>
  interpretar: (contenido: string) => T | null
  fusionar: (local: T, remoto: T, ganaLocal: boolean) => T
  quitarPendiente: () => void
}

type Situacion = {
  tienePendiente: boolean
  remotoEsMasNuevo: boolean
  ganaLocal: boolean
}

type Desenlace = 'nada' | 'bajado' | 'subido' | 'fusionado'

async function sincronizarArchivo<T>(
  cliente: ClienteGitHub,
  estrategia: Estrategia<T>,
  situacion: Situacion,
): Promise<Desenlace> {
  const { ruta } = estrategia
  const shas = leerShas()

  // Cambió aquí y allí desde la última vez que lo vimos: se combinan las dos
  // versiones en lugar de preguntar cuál sacrificar.
  if (situacion.tienePendiente && situacion.remotoEsMasNuevo) {
    const actual = await cliente.leerArchivo(ruta)
    if (actual && shas[ruta] && actual.sha !== shas[ruta]) {
      return (await combinarYSubir(cliente, estrategia, actual, situacion.ganaLocal))
        ? 'fusionado'
        : 'subido'
    }
  }

  if (situacion.remotoEsMasNuevo && !situacion.tienePendiente) {
    const archivo = await cliente.leerArchivo(ruta)
    const remoto = archivo ? estrategia.interpretar(archivo.contenido) : null
    if (archivo && remoto) {
      await estrategia.guardar(remoto)
      recordarSha(ruta, archivo.sha)
      return 'bajado'
    }
    return 'nada'
  }

  if (situacion.tienePendiente) {
    const valor = await estrategia.cargar()
    try {
      const nuevoSha = await cliente.escribirArchivo(
        ruta,
        JSON.stringify(valor, null, 2),
        shas[ruta],
        `Actualizar ${estrategia.etiqueta}`,
      )
      recordarSha(ruta, nuevoSha)
      estrategia.quitarPendiente()
      return 'subido'
    } catch (error) {
      if (!(error instanceof ErrorConflicto)) throw error
      /*
       * Otro dispositivo escribió entre nuestra lectura y nuestra escritura.
       * Se relee, se combina y se vuelve a subir: así no se queda pendiente para
       * siempre chocando en cada intento.
       */
      const actual = await cliente.leerArchivo(ruta)
      return (await combinarYSubir(cliente, estrategia, actual, situacion.ganaLocal))
        ? 'fusionado'
        : 'subido'
    }
  }

  return 'nada'
}

/**
 * Combina la versión local con la remota y sube el resultado.
 *
 * Devuelve true si hubo algo que combinar de verdad, y false si el archivo
 * remoto no existía o no se pudo leer, en cuyo caso simplemente se ha subido lo
 * de aquí.
 */
async function combinarYSubir<T>(
  cliente: ClienteGitHub,
  estrategia: Estrategia<T>,
  actual: { contenido: string; sha: string } | null,
  ganaLocal: boolean,
): Promise<boolean> {
  const local = await estrategia.cargar()
  const remoto = actual ? estrategia.interpretar(actual.contenido) : null
  const combinado = remoto ? estrategia.fusionar(local, remoto, ganaLocal) : local

  // Se guarda también aquí para que el dispositivo quede con lo mismo que la nube.
  await estrategia.guardar(combinado)

  const nuevoSha = await cliente.escribirArchivo(
    estrategia.ruta,
    JSON.stringify(combinado, null, 2),
    actual?.sha,
    remoto ? `Combinar ${estrategia.etiqueta}` : `Actualizar ${estrategia.etiqueta}`,
  )
  recordarSha(estrategia.ruta, nuevoSha)
  estrategia.quitarPendiente()
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

/** Lo mismo para los mazos, que van en su propio archivo. */
export function anotarCambioMazos(idCuaderno: string): void {
  marcarMazosPendiente(idCuaderno)
}

/** Y para la agenda, de la que solo hay una. */
export function anotarCambioAgenda(): void {
  marcarAgendaPendiente()
}

/** La lista de clases de una materia. */
export function anotarCambioClases(idCuaderno: string): void {
  marcarClasesPendiente(idCuaderno)
}

/** Los apuntes de una clase concreta. */
export function anotarCambioApuntes(idClase: string): void {
  marcarApuntesPendiente(idClase)
}
