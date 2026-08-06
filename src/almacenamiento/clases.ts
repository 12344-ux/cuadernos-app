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

function normalizarClase(datos: unknown, indice: number): Clase {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const ahora = Date.now()
  const creado = numero(crudo.creado, ahora)

  return {
    id: typeof crudo.id === 'string' && crudo.id ? crudo.id : `clase-${indice}`,
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

export function normalizarIndiceClases(datos: unknown): IndiceClases {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const clases = Array.isArray(crudo.clases) ? crudo.clases : []
  return { version: VERSION_CLASES, clases: clases.map(normalizarClase) }
}

export async function cargarClases(idCuaderno: string): Promise<IndiceClases> {
  const guardado = await idb.leer<IndiceClases>(clave(idCuaderno))
  return guardado ? normalizarIndiceClases(guardado) : indiceClasesVacio()
}

export async function guardarClases(idCuaderno: string, indice: IndiceClases): Promise<void> {
  await idb.escribir<IndiceClases>(clave(idCuaderno), { ...indice, version: VERSION_CLASES })
}

export async function eliminarClases(idCuaderno: string): Promise<void> {
  await idb.eliminar(clave(idCuaderno))
}
