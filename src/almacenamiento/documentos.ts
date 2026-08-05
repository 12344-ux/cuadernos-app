import type { Edge } from '@xyflow/react'
import { sanearHtml, textoPlanoAHtml } from '../texto/saneador'
import {
  ALINEACIONES,
  FUENTES,
  PALETA,
  TAMANOS,
  VERSION_DOCUMENTO,
  datosNodoPorDefecto,
  documentoVacio,
  type DatosNodo,
  type DocumentoCuaderno,
  type NodoCuaderno,
  type TipoElemento,
} from '../tipos'
import * as idb from './idb'

/**
 * Quita los campos efímeros que React Flow añade en tiempo de ejecución
 * (selección, arrastre, medidas internas). Guardarlos ensucia el JSON y
 * reabriría el cuaderno con cuadros marcados como seleccionados.
 */
function limpiarNodos(nodes: NodoCuaderno[]): NodoCuaderno[] {
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
  }) as NodoCuaderno[]
}

function limpiarAristas(edges: Edge[]): Edge[] {
  return edges.map(({ selected: _selected, ...resto }) => resto)
}

/**
 * Devuelve el valor si es una clave conocida del registro, y si no el de
 * partida. Se usa hasOwnProperty en lugar de 'valor in registro' para que
 * '__proto__' o 'toString' no pasen por válidos.
 */
function claveConocida<T extends object, K extends Extract<keyof T, string>>(
  registro: T,
  valor: unknown,
  porDefecto: K,
): K {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(registro, valor)
    ? (valor as K)
    : porDefecto
}

/**
 * Normaliza los datos de un nodo, convirtiendo los de la versión 1 si hace falta.
 *
 * En la versión 1 un cuadro tenía 'texto' plano y un booleano 'resaltado'. El
 * texto pasa a ser HTML (escapando los símbolos para que un '<' escrito a mano
 * no se convierta en etiqueta) y el resaltado se traduce al marcador amarillo,
 * que es su equivalente más fiel.
 */
function normalizarDatos(datos: unknown): DatosNodo {
  const crudo = (datos ?? {}) as Record<string, unknown>
  const porDefecto = datosNodoPorDefecto()

  let contenido = ''
  if (typeof crudo.contenido === 'string') {
    contenido = crudo.contenido
  } else if (typeof crudo.texto === 'string') {
    contenido = textoPlanoAHtml(crudo.texto, crudo.resaltado ? 'amarillo' : undefined)
  }

  return {
    // Se sanea también al cargar, y no solo al mostrar, para no reescribir en el
    // repositorio el contenido manipulado que pudiera traer un documento ajeno.
    contenido: sanearHtml(contenido),
    color: claveConocida(PALETA, crudo.color, porDefecto.color),
    fuente: claveConocida(FUENTES, crudo.fuente, porDefecto.fuente),
    tamano: claveConocida(TAMANOS, crudo.tamano, porDefecto.tamano),
    alineacion: claveConocida(ALINEACIONES, crudo.alineacion, porDefecto.alineacion),
  }
}

/** Rellena valores ausentes para que un documento viejo no rompa la interfaz. */
function normalizar(documento: DocumentoCuaderno): DocumentoCuaderno {
  const nodes = (documento.nodes ?? []).map((nodo) => {
    // Un tipo desconocido se trata como cuadro: es lo que eran todos los nodos
    // antes de que existieran los post-its.
    const tipo: TipoElemento = nodo.type === 'postit' ? 'postit' : 'texto'
    return {
      ...nodo,
      type: tipo,
      data: normalizarDatos(nodo.data),
    } as NodoCuaderno
  })

  /*
   * Un post-it no participa de la estructura del mapa, así que ninguna flecha
   * debería tocarlo. La interfaz ya impide crearlas, pero se descartan también
   * aquí: si un documento llega de otro dispositivo con una flecha así, React
   * Flow no encontraría el punto de conexión y la dibujaría en un sitio raro.
   */
  const postits = new Set(nodes.filter((nodo) => nodo.type === 'postit').map((nodo) => nodo.id))
  const edges = (documento.edges ?? []).filter(
    (arista) => !postits.has(arista.source) && !postits.has(arista.target),
  )

  return {
    version: VERSION_DOCUMENTO,
    nodes,
    edges,
    viewport: documento.viewport ?? null,
    notas: documento.notas ?? [],
  }
}

export type AlmacenDocumentos = {
  cargar: (id: string) => Promise<DocumentoCuaderno>
  guardar: (id: string, documento: DocumentoCuaderno) => Promise<void>
  eliminar: (id: string) => Promise<void>
  /** Interpreta un documento venido de la nube, saneándolo y normalizándolo. */
  normalizar: (datos: unknown) => DocumentoCuaderno
}

/**
 * Construye un almacén de documentos de lienzo bajo un prefijo de clave.
 *
 * Hay dos clases de lienzo que guardan el mismo tipo de documento: el mapa
 * conceptual de una materia y los apuntes de una clase. Comparten normalización,
 * saneado y limpieza de campos efímeros, y solo se diferencian en la clave con la
 * que se guardan. La alternativa era duplicar todo este archivo con otro prefijo.
 *
 * IndexedDB es un almacén clave-valor sin índices, así que añadir un prefijo no
 * exige ninguna migración del esquema.
 */
export function crearAlmacenDocumentos(prefijo: string): AlmacenDocumentos {
  const clave = (id: string) => `${prefijo}:${id}`

  return {
    async cargar(id) {
      const guardado = await idb.leer<DocumentoCuaderno>(clave(id))
      return guardado ? normalizar(guardado) : documentoVacio()
    },

    async guardar(id, documento) {
      await idb.escribir<DocumentoCuaderno>(clave(id), {
        ...documento,
        version: VERSION_DOCUMENTO,
        nodes: limpiarNodos(documento.nodes),
        edges: limpiarAristas(documento.edges),
      })
    },

    async eliminar(id) {
      await idb.eliminar(clave(id))
    },

    normalizar: (datos) => normalizar(datos as DocumentoCuaderno),
  }
}

/**
 * El mapa conceptual de cada materia. Mantiene el prefijo 'doc' con el que se
 * guardaron los cuadernos desde la primera versión, para no invalidar lo que ya
 * hay en los dispositivos.
 */
export const documentosDeMateria = crearAlmacenDocumentos('doc')

export const cargarDocumento = documentosDeMateria.cargar
export const guardarDocumento = documentosDeMateria.guardar
export const eliminarDocumento = documentosDeMateria.eliminar
