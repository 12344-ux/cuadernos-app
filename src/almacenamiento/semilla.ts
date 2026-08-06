import { MarkerType } from '@xyflow/react'
import {
  VERSION_DOCUMENTO,
  datosNodoPorDefecto,
  type Cuaderno,
  type DocumentoCuaderno,
} from '../tipos'
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
        data: {
          ...datosNodoPorDefecto(),
          contenido: '<p>La célula</p>',
          color: 'azul',
          // El nodo raíz enseña de paso la tipografía propia y el tamaño título.
          fuente: 'fraunces',
          tamano: 'titulo',
          alineacion: 'centro',
        },
      },
      {
        id: 'demo-2',
        type: 'texto',
        position: { x: -180, y: 190 },
        width: 220,
        height: 110,
        data: {
          ...datosNodoPorDefecto(),
          contenido:
            '<p><strong>Procariota</strong></p><p><mark data-color="verde">Sin núcleo definido</mark></p>',
          color: 'verde',
        },
      },
      {
        id: 'demo-3',
        type: 'texto',
        position: { x: 140, y: 190 },
        width: 220,
        height: 110,
        data: {
          ...datosNodoPorDefecto(),
          contenido:
            '<p><strong>Eucariota</strong></p><p><mark data-color="amarillo">Con núcleo y organelos</mark></p>',
          color: 'amarillo',
        },
      },
      {
        // Muestra para qué sirve un post-it: una duda al margen del mapa, sin
        // flechas que la aten a ningún concepto.
        id: 'demo-postit',
        type: 'postit',
        position: { x: 420, y: 20 },
        width: 180,
        height: 150,
        data: {
          ...datosNodoPorDefecto(),
          contenido: '<p><mark data-color="rosa">¿Entra la mitosis en el examen?</mark></p>',
          color: 'rosa',
        },
        connectable: false,
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

  // Las dos de ejemplo van con color: es la forma de que se vea para qué sirve
  // el campo sin tener que crear una materia y elegírselo.
  const biologia: Cuaderno = {
    id: nuevoId(),
    nombre: 'Biología',
    creado: ahora,
    modificado: ahora,
    archivado: false,
    color: 'verde',
    // Coherente con el contador del lienzo: los post-its no son ideas.
    numIdeas: demo.nodes.filter((nodo) => nodo.type === 'texto').length,
  }
  const quimica: Cuaderno = {
    id: nuevoId(),
    nombre: 'Química',
    creado: ahora,
    modificado: ahora,
    archivado: false,
    color: 'azul',
    numIdeas: 0,
  }

  await guardarDocumento(biologia.id, demo)

  const cuadernos = [biologia, quimica]
  escribirIndice({
    version: 1,
    cuadernos,
    ultimoCuaderno: null,
    actualizado: ahora,
  })
  localStorage.setItem(CLAVE_SEMILLA, '1')

  return cuadernos
}
