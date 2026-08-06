import {
  VERSION_CLASES,
  indiceClasesVacio,
  type Clase,
  type IndiceClases,
} from '../clases/tipos'
import { hoy } from '../fechas'
import * as idb from './idb'

/** La lista de clases de una materia, un registro por materia. */
function clave(idCuaderno: string): string {
  return `clases:${idCuaderno}`
}

function numero(valor: unknown, porDefecto: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto
}

function dia(valor: unknown): string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : hoy()
}

function normalizarClase(datos: unknown, indice: number, idCuaderno: string): Clase {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const ahora = Date.now()
  const creado = numero(crudo.creado, ahora)

  return {
    /*
     * El identificador de reserva lleva el de la materia dentro.
     *
     * Antes era 'clase-<indice>', el sitio que ocupaba en la lista, y los apuntes
     * se guardan con el identificador de la clase como clave global
     * ('apuntes/<idClase>.json'): dos entradas estropeadas en materias distintas
     * caían las dos en 'clase-0' y acabarían compartiendo un mismo archivo de
     * apuntes. Sigue siendo estable entre lecturas, que es lo que hace falta para
     * no dejar los apuntes huérfanos, pero ya no puede cruzarse con otra materia.
     */
    id: typeof crudo.id === 'string' && crudo.id ? crudo.id : `${idCuaderno}-clase-${indice}`,
    nombre: typeof crudo.nombre === 'string' && crudo.nombre.trim() ? crudo.nombre : 'Clase',
    fecha: dia(crudo.fecha),
    creado,
    modificado: numero(crudo.modificado, creado),
    notasModificado: numero(crudo.notasModificado, 0),
    // 'numNotas' de la versión de lienzo no se traduce: contaba cuadros, y los
    // apuntes de esa versión se descartan (ver normalizarApunte).
    palabras: Math.max(0, Math.round(numero(crudo.palabras, 0))),
    ...(crudo.eliminada ? { eliminada: true as const } : {}),
  }
}

/** Pide la materia para poder construir identificadores de reserva únicos. */
export function normalizarIndiceClases(datos: unknown, idCuaderno: string): IndiceClases {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const clases = Array.isArray(crudo.clases) ? crudo.clases : []
  return {
    version: VERSION_CLASES,
    clases: clases.map((clase, indice) => normalizarClase(clase, indice, idCuaderno)),
  }
}

export async function cargarClases(idCuaderno: string): Promise<IndiceClases> {
  const guardado = await idb.leer<IndiceClases>(clave(idCuaderno))
  return guardado ? normalizarIndiceClases(guardado, idCuaderno) : indiceClasesVacio()
}

export async function guardarClases(idCuaderno: string, indice: IndiceClases): Promise<void> {
  await idb.escribir<IndiceClases>(clave(idCuaderno), { ...indice, version: VERSION_CLASES })
}

export async function eliminarClases(idCuaderno: string): Promise<void> {
  await idb.eliminar(clave(idCuaderno))
}
