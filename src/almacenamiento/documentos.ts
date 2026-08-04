import type { Edge } from '@xyflow/react'
import {
  COLOR_POR_DEFECTO,
  VERSION_DOCUMENTO,
  documentoVacio,
  type DocumentoCuaderno,
  type NodoTexto,
} from '../tipos'
import * as idb from './idb'

function clave(idCuaderno: string): string {
  return `doc:${idCuaderno}`
}

/**
 * Quita los campos efímeros que React Flow añade en tiempo de ejecución
 * (selección, arrastre, medidas internas). Guardarlos ensucia el JSON y
 * reabriría el cuaderno con cuadros marcados como seleccionados.
 */
function limpiarNodos(nodes: NodoTexto[]): NodoTexto[] {
  return nodes.map((nodo) => {
    // 'autoenfocar' es una marca de interfaz, no contenido: fuera del JSON.
    const { autoenfocar: _autoenfocar, ...datos } = nodo.data
    return {
      id: nodo.id,
      type: nodo.type,
      position: nodo.position,
      data: datos,
      ...(nodo.width ? { width: nodo.width } : {}),
      ...(nodo.height ? { height: nodo.height } : {}),
    }
  }) as NodoTexto[]
}

function limpiarAristas(edges: Edge[]): Edge[] {
  return edges.map(({ selected: _selected, ...resto }) => resto)
}

/** Rellena valores ausentes para que un documento viejo no rompa la interfaz. */
function normalizar(documento: DocumentoCuaderno): DocumentoCuaderno {
  return {
    version: VERSION_DOCUMENTO,
    nodes: (documento.nodes ?? []).map((nodo) => ({
      ...nodo,
      type: 'texto' as const,
      data: {
        texto: nodo.data?.texto ?? '',
        color: nodo.data?.color ?? COLOR_POR_DEFECTO,
        resaltado: Boolean(nodo.data?.resaltado),
      },
    })),
    edges: documento.edges ?? [],
    viewport: documento.viewport ?? null,
    notas: documento.notas ?? [],
  }
}

export async function cargarDocumento(idCuaderno: string): Promise<DocumentoCuaderno> {
  const guardado = await idb.leer<DocumentoCuaderno>(clave(idCuaderno))
  return guardado ? normalizar(guardado) : documentoVacio()
}

export async function guardarDocumento(
  idCuaderno: string,
  documento: DocumentoCuaderno,
): Promise<void> {
  await idb.escribir<DocumentoCuaderno>(clave(idCuaderno), {
    ...documento,
    version: VERSION_DOCUMENTO,
    nodes: limpiarNodos(documento.nodes),
    edges: limpiarAristas(documento.edges),
  })
}

export async function eliminarDocumento(idCuaderno: string): Promise<void> {
  await idb.eliminar(clave(idCuaderno))
}
