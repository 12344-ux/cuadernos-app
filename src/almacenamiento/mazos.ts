import { sanearHtml } from '../texto/saneador'
import {
  FACILIDAD_INICIAL,
  FACILIDAD_MINIMA,
  programacionInicial,
} from '../tarjetas/sm2'
import {
  VERSION_MAZOS,
  documentoMazosVacio,
  type DocumentoMazos,
  type Mazo,
  type Programacion,
  type Tarjeta,
} from '../tarjetas/tipos'
import * as idb from './idb'

/**
 * Los mazos viven en IndexedDB, en un registro por materia y separado del
 * documento del lienzo. Comparten la misma base de datos, así que cerrar sesión
 * borrándolo todo (limpieza.ts) sigue llevándose también las tarjetas.
 */
function clave(idCuaderno: string): string {
  return `mazos:${idCuaderno}`
}

function numero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto
}

/** Un día válido es 'AAAA-MM-DD'; cualquier otra cosa se trata como nueva. */
function dia(valor: unknown): string | null {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null
}

function normalizarProgramacion(datos: unknown): Programacion {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const porDefecto = programacionInicial()

  return {
    intervalo: Math.max(0, Math.round(numero(crudo.intervalo, porDefecto.intervalo))),
    // Se acota por arriba también: una facilidad absurda traída de un archivo
    // manipulado dispararía los intervalos a años.
    facilidad: Math.min(5, Math.max(FACILIDAD_MINIMA, numero(crudo.facilidad, FACILIDAD_INICIAL))),
    repeticiones: Math.max(0, Math.round(numero(crudo.repeticiones, porDefecto.repeticiones))),
    proximoRepaso: dia(crudo.proximoRepaso),
    ultimoRepaso: typeof crudo.ultimoRepaso === 'number' ? crudo.ultimoRepaso : null,
    lapsos: Math.max(0, Math.round(numero(crudo.lapsos, 0))),
  }
}

function normalizarTarjeta(datos: unknown, indice: number): Tarjeta {
  const crudo = (datos ?? {}) as Record<string, unknown>
  return {
    id: typeof crudo.id === 'string' && crudo.id ? crudo.id : `tarjeta-${indice}`,
    // El mismo saneado que los cuadros del lienzo: el HTML se inyecta para
    // mostrarlo y los archivos llegan de un repositorio remoto.
    anverso: sanearHtml(typeof crudo.anverso === 'string' ? crudo.anverso : ''),
    reverso: sanearHtml(typeof crudo.reverso === 'string' ? crudo.reverso : ''),
    creado: numero(crudo.creado, Date.now()),
    programacion: normalizarProgramacion(crudo.programacion),
  }
}

function normalizarMazo(datos: unknown, indice: number): Mazo {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const tarjetas = Array.isArray(crudo.tarjetas) ? crudo.tarjetas : []
  const ahora = Date.now()

  return {
    id: typeof crudo.id === 'string' && crudo.id ? crudo.id : `mazo-${indice}`,
    nombre: typeof crudo.nombre === 'string' && crudo.nombre.trim() ? crudo.nombre : 'Mazo',
    creado: numero(crudo.creado, ahora),
    modificado: numero(crudo.modificado, ahora),
    tarjetas: tarjetas.map(normalizarTarjeta),
  }
}

export function normalizarDocumentoMazos(datos: unknown): DocumentoMazos {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const mazos = Array.isArray(crudo.mazos) ? crudo.mazos : []
  return { version: VERSION_MAZOS, mazos: mazos.map(normalizarMazo) }
}

export async function cargarMazos(idCuaderno: string): Promise<DocumentoMazos> {
  const guardado = await idb.leer<DocumentoMazos>(clave(idCuaderno))
  return guardado ? normalizarDocumentoMazos(guardado) : documentoMazosVacio()
}

export async function guardarMazos(
  idCuaderno: string,
  documento: DocumentoMazos,
): Promise<void> {
  await idb.escribir<DocumentoMazos>(clave(idCuaderno), {
    ...documento,
    version: VERSION_MAZOS,
  })
}

export async function eliminarMazos(idCuaderno: string): Promise<void> {
  await idb.eliminar(clave(idCuaderno))
}
