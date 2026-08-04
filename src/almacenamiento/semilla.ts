import { MarkerType } from '@xyflow/react'
import { VERSION_DOCUMENTO, type Cuaderno, type DocumentoCuaderno } from '../tipos'
import { guardarDocumento } from './documentos'
import { escribirIndice, leerIndice, nuevoId } from './indice'

/**
 * Materias de ejemplo para el primer arranque. Son borrables y renombrables:
 * existen solo para que el selector no aparezca vacío y para que Biología
 * muestre de un vistazo cómo se ven cuadros, colores y flechas.
 */
const CLAVE_SEMILLA = 'cuadernos:semilla-aplicada'

function documentoDemo(): DocumentoCuaderno {
  return {
    version: VERSION_DOCUMENTO,
    nodes: [
      {
        id: 'demo-1',
        type: 'texto',
        position: { x: 0, y: 0 },
        width: 220,
        height: 90,
        data: { texto: 'La célula', color: 'azul', resaltado: false },
      },
      {
        id: 'demo-2',
        type: 'texto',
        position: { x: -180, y: 190 },
        width: 220,
        height: 110,
        data: {
          texto: 'Procariota\nSin núcleo definido',
          color: 'verde',
          resaltado: false,
        },
      },
      {
        id: 'demo-3',
        type: 'texto',
        position: { x: 140, y: 190 },
        width: 220,
        height: 110,
        data: {
          texto: 'Eucariota\nCon núcleo y organelos',
          color: 'amarillo',
          resaltado: true,
        },
      },
    ],
    edges: [
      {
        id: 'demo-a1',
        source: 'demo-1',
        sourceHandle: 'abajo',
        target: 'demo-2',
        targetHandle: 'arriba',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'demo-a2',
        source: 'demo-1',
        sourceHandle: 'abajo',
        target: 'demo-3',
        targetHandle: 'arriba',
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ],
    viewport: null,
    notas: [],
  }
}

/** Se ejecuta una sola vez, y solo si no hay ninguna materia todavía. */
export async function aplicarSemillaSiHaceFalta(): Promise<Cuaderno[] | null> {
  if (localStorage.getItem(CLAVE_SEMILLA)) return null
  if (leerIndice().cuadernos.length > 0) {
    localStorage.setItem(CLAVE_SEMILLA, '1')
    return null
  }

  const ahora = Date.now()
  const demo = documentoDemo()

  const biologia: Cuaderno = {
    id: nuevoId(),
    nombre: 'Biología',
    creado: ahora,
    modificado: ahora,
    archivado: false,
    numIdeas: demo.nodes.length,
  }
  const quimica: Cuaderno = {
    id: nuevoId(),
    nombre: 'Química',
    creado: ahora,
    modificado: ahora,
    archivado: false,
    numIdeas: 0,
  }

  await guardarDocumento(biologia.id, demo)

  const cuadernos = [biologia, quimica]
  escribirIndice({ version: 1, cuadernos })
  localStorage.setItem(CLAVE_SEMILLA, '1')

  return cuadernos
}
