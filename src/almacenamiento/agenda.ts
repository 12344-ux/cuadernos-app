import {
  VERSION_AGENDA,
  documentoAgendaVacio,
  type DocumentoAgenda,
  type Tarea,
} from '../agenda/tipos'
import { hoy } from '../fechas'
import * as idb from './idb'

/**
 * La agenda es un único registro en IndexedDB, no uno por materia. Comparte base
 * de datos con los cuadernos, así que cerrar sesión borrándolo todo (limpieza.ts)
 * también se lleva las tareas.
 */
const CLAVE = 'agenda'

function numero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto
}

/** Un día válido es 'AAAA-MM-DD'; cualquier otra cosa se trata como hoy. */
function dia(valor: unknown): string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : hoy()
}

function normalizarTarea(datos: unknown, indice: number): Tarea {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const ahora = Date.now()
  const completada = Boolean(crudo.completada)

  return {
    id: typeof crudo.id === 'string' && crudo.id ? crudo.id : `tarea-${indice}`,
    // Texto llano y no HTML: una tarea es un renglón, no un apunte.
    texto: typeof crudo.texto === 'string' ? crudo.texto : '',
    fecha: dia(crudo.fecha),
    completada,
    fechaCreacion: numero(crudo.fechaCreacion, ahora),
    // Una tarea completada sin fecha de completado no podría entrar en el
    // historial ni salir de la agenda de hoy, así que se le pone una.
    fechaCompletada: completada
      ? numero(crudo.fechaCompletada, numero(crudo.fechaCreacion, ahora))
      : null,
    modificado: numero(crudo.modificado, numero(crudo.fechaCreacion, ahora)),
    ...(crudo.eliminada ? { eliminada: true as const } : {}),
  }
}

export function normalizarAgenda(datos: unknown): DocumentoAgenda {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const tareas = Array.isArray(crudo.tareas) ? crudo.tareas : []
  return { version: VERSION_AGENDA, tareas: tareas.map(normalizarTarea) }
}

export async function cargarAgenda(): Promise<DocumentoAgenda> {
  const guardado = await idb.leer<DocumentoAgenda>(CLAVE)
  return guardado ? normalizarAgenda(guardado) : documentoAgendaVacio()
}

export async function guardarAgenda(documento: DocumentoAgenda): Promise<void> {
  await idb.escribir<DocumentoAgenda>(CLAVE, { ...documento, version: VERSION_AGENDA })
}
