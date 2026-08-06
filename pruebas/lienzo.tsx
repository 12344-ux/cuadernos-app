/*
 * Banco de pruebas del lienzo. No entra en la aplicación: sirve para comprobar en
 * un navegador de verdad el comportamiento de arrastre y selección de los cuadros,
 * que es lo que no se puede verificar leyendo el código.
 *
 * Usa los componentes reales (NodoTexto, NodoPostit) y el CSS real.
 */
import { ReactFlow, ReactFlowProvider, ConnectionMode, type NodeTypes } from '@xyflow/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NodoPostit } from '../src/componentes/NodoPostit'
import { NodoTexto } from '../src/componentes/NodoTexto'
import { ProveedorFormato } from '../src/formato/contexto'
import { BarraFormato } from '../src/componentes/BarraFormato'
import { datosNodoPorDefecto, type NodoCuaderno } from '../src/tipos'
import '@xyflow/react/dist/style.css'
import '../src/estilos/global.css'

const TIPOS_DE_NODO: NodeTypes = { texto: NodoTexto, postit: NodoPostit }

const nodos: NodoCuaderno[] = [
  {
    id: 'con-texto',
    type: 'texto',
    position: { x: 40, y: 40 },
    width: 220,
    height: 90,
    data: { ...datosNodoPorDefecto(), contenido: '<p>Fotosintesis y clorofila</p>' },
  },
  {
    id: 'vacio',
    type: 'texto',
    position: { x: 320, y: 40 },
    width: 200,
    height: 90,
    data: datosNodoPorDefecto(),
  },
  {
    id: 'postit',
    type: 'postit',
    position: { x: 40, y: 190 },
    width: 200,
    height: 110,
    data: { ...datosNodoPorDefecto(), color: 'amarillo', contenido: '<p>Repasar el jueves</p>' },
  },
]

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProveedorFormato>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <BarraFormato conElementos />
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <ReactFlowProvider>
            <ReactFlow<NodoCuaderno>
              defaultNodes={nodos}
              nodeTypes={TIPOS_DE_NODO}
              connectionMode={ConnectionMode.Loose}
              selectionOnDrag
              panOnDrag={[1, 2]}
              zoomOnDoubleClick={false}
              proOptions={{ hideAttribution: true }}
            />
          </ReactFlowProvider>
        </div>
      </div>
    </ProveedorFormato>
  </StrictMode>,
)
