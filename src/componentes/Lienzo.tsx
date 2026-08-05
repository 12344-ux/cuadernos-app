import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
  type Viewport,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { guardarDocumento } from '../almacenamiento/documentos'
import { nuevoId } from '../almacenamiento/indice'
import {
  PALETA,
  VERSION_DOCUMENTO,
  datosNodoPorDefecto,
  type DocumentoCuaderno,
  type EstadoGuardado,
  type NodoCuaderno,
  type TipoElemento,
} from '../tipos'
import { precargarEditor } from './editorDiferido'
import { NodoPostit as ComponenteNodoPostit } from './NodoPostit'
import { NodoTexto as ComponenteNodoTexto } from './NodoTexto'

/** Fuera del componente: si se recreara en cada render, React Flow remontaría todos los nodos. */
const TIPOS_DE_NODO: NodeTypes = { texto: ComponenteNodoTexto, postit: ComponenteNodoPostit }

/** Medidas de partida de cada tipo de elemento. */
const MEDIDAS_NUEVAS: Record<TipoElemento, { ancho: number; alto: number }> = {
  texto: { ancho: 220, alto: 90 },
  postit: { ancho: 180, alto: 150 },
}

const OPCIONES_ARISTA = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { strokeWidth: 1.8 },
}

const RETARDO_AUTOGUARDADO = 700

type PropsLienzo = {
  idCuaderno: string
  documentoInicial: DocumentoCuaderno
  onGuardado: (numIdeas: number) => void
}

/** Decide si un lote de cambios merece guardar en disco. */
function cambiosRelevantes(cambios: NodeChange<NodoCuaderno>[] | EdgeChange<Edge>[]): boolean {
  return cambios.some((cambio) => {
    // Seleccionar un cuadro no cambia el contenido del cuaderno.
    if (cambio.type === 'select') return false
    // Las medidas iniciales que calcula React Flow al montar tampoco: sin este
    // filtro, abrir un cuaderno lo marcaría como modificado sin tocar nada.
    if (cambio.type === 'dimensions' && !cambio.resizing) return false
    return true
  })
}

export function Lienzo({ idCuaderno, documentoInicial, onGuardado }: PropsLienzo) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodoCuaderno>(documentoInicial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(documentoInicial.edges)
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo')
  const [version, setVersion] = useState(0)

  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<Viewport | null>(documentoInicial.viewport)
  const notasRef = useRef(documentoInicial.notas)
  const primerRender = useRef(true)

  // Espejos del estado para que el temporizador de guardado lea siempre lo
  // último sin tener que figurar como dependencia del efecto.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const onGuardadoRef = useRef(onGuardado)

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
    onGuardadoRef.current = onGuardado
  }, [nodes, edges, onGuardado])

  const { screenToFlowPosition, fitView, getNode } = useReactFlow<NodoCuaderno>()

  const marcarCambio = useCallback(() => setVersion((previa) => previa + 1), [])

  const alCambiarNodos = useCallback(
    (cambios: NodeChange<NodoCuaderno>[]) => {
      onNodesChange(cambios)
      if (cambiosRelevantes(cambios)) marcarCambio()
    },
    [onNodesChange, marcarCambio],
  )

  const alCambiarAristas = useCallback(
    (cambios: EdgeChange<Edge>[]) => {
      onEdgesChange(cambios)
      if (cambiosRelevantes(cambios)) marcarCambio()
    },
    [onEdgesChange, marcarCambio],
  )

  const alConectar = useCallback(
    (conexion: Connection) => {
      setEdges((previas) => addEdge({ ...conexion, ...OPCIONES_ARISTA }, previas))
      marcarCambio()
    },
    [setEdges, marcarCambio],
  )

  /** Permite arrastrar el extremo de una flecha existente a otro cuadro. */
  const alReconectar = useCallback(
    (aristaVieja: Edge, nuevaConexion: Connection) => {
      setEdges((previas) => reconnectEdge(aristaVieja, nuevaConexion, previas))
      marcarCambio()
    },
    [setEdges, marcarCambio],
  )

  const crearNodo = useCallback(
    (tipo: TipoElemento, posicionPantalla?: { x: number; y: number }) => {
      const caja = contenedorRef.current?.getBoundingClientRect()
      const punto =
        posicionPantalla ??
        (caja
          ? { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 })

      const posicion = screenToFlowPosition(punto)
      const { ancho, alto } = MEDIDAS_NUEVAS[tipo]
      const nodo: NodoCuaderno = {
        id: nuevoId(),
        type: tipo,
        // Se descuenta la mitad del tamaño para que quede centrado en el clic.
        position: { x: posicion.x - ancho / 2, y: posicion.y - alto / 2 },
        width: ancho,
        height: alto,
        data: {
          ...datosNodoPorDefecto(),
          // Un post-it nace amarillo, como una nota adhesiva de verdad. Los siete
          // colores siguen disponibles, pero el de partida ya lo distingue de un
          // cuadro sin tener que mirar la forma.
          ...(tipo === 'postit' ? { color: 'amarillo' as const } : {}),
          autoenfocar: true,
        },
        selected: true,
        // Refuerza la ausencia de handles: un post-it no admite flechas.
        ...(tipo === 'postit' ? { connectable: false } : {}),
      } as NodoCuaderno

      setNodes((previos) => [...previos.map((n) => ({ ...n, selected: false })), nodo])
      marcarCambio()
    },
    [screenToFlowPosition, setNodes, marcarCambio],
  )

  /**
   * Un post-it queda fuera de la estructura del mapa. No dibuja puntos de
   * conexión, así que en la práctica no hay por dónde engancharlo, pero se
   * comprueba igual: ConnectionMode.Loose es permisivo y no conviene que la
   * garantía dependa solo de que un componente no renderice algo.
   */
  const conexionValida = useCallback(
    (conexion: Edge | Connection) => {
      const origen = conexion.source ? getNode(conexion.source) : undefined
      const destino = conexion.target ? getNode(conexion.target) : undefined
      return origen?.type !== 'postit' && destino?.type !== 'postit'
    },
    [getNode],
  )

  /**
   * React Flow no expone un onPaneDoubleClick, así que se escucha el doble clic
   * en el contenedor y se comprueba que haya caído en el fondo del lienzo y no
   * sobre un cuadro o un control.
   */
  const alDobleClic = useCallback(
    (evento: React.MouseEvent<HTMLDivElement>) => {
      const objetivo = evento.target as HTMLElement
      if (!objetivo.classList.contains('react-flow__pane')) return
      crearNodo('texto', { x: evento.clientX, y: evento.clientY })
    },
    [crearNodo],
  )

  const guardar = useCallback(async () => {
    setEstado('guardando')
    try {
      const nodosActuales = nodesRef.current
      const documento: DocumentoCuaderno = {
        version: VERSION_DOCUMENTO,
        nodes: nodosActuales,
        edges: edgesRef.current,
        viewport: viewportRef.current,
        notas: notasRef.current,
      }
      await guardarDocumento(idCuaderno, documento)
      setEstado('guardado')
      // Los post-its no cuentan como ideas: son notas sueltas, no conceptos de
      // la estructura del mapa. Si contaran, el número de la tarjeta dejaría de
      // decir cuántas ideas hay realmente conectadas.
      onGuardadoRef.current(nodosActuales.filter((nodo) => nodo.type === 'texto').length)
    } catch (error) {
      console.error('No se pudo guardar el cuaderno', error)
      setEstado('error')
    }
  }, [idCuaderno])

  /*
   * Autoguardado con retardo. Depende solo de 'version', que se incrementa
   * únicamente ante cambios de contenido: si dependiera de 'nodes', cada clic
   * de selección provocaría una escritura, y como guardar actualiza el índice
   * del cuaderno se podría realimentar en bucle.
   */
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }

    const temporizador = window.setTimeout(() => {
      void guardar()
    }, RETARDO_AUTOGUARDADO)

    return () => window.clearTimeout(temporizador)
  }, [version, guardar])

  // Si se abre un cuaderno es muy probable que se acabe escribiendo en él, así
  // que el editor se trae en segundo plano antes de que haga falta.
  useEffect(() => {
    precargarEditor()
  }, [])

  // Guarda lo pendiente si se cierra la pestaña en medio del retardo.
  useEffect(() => {
    const alSalir = () => {
      if (!primerRender.current) void guardar()
    }
    window.addEventListener('pagehide', alSalir)
    return () => window.removeEventListener('pagehide', alSalir)
  }, [guardar])

  const etiquetaEstado = useMemo(() => {
    switch (estado) {
      case 'guardando':
        return 'Guardando…'
      case 'guardado':
        return 'Guardado'
      case 'error':
        return 'Error al guardar'
      default:
        return 'Sin cambios'
    }
  }, [estado])

  const colorDeMinimapa = useCallback((nodo: NodoCuaderno) => {
    return (PALETA[nodo.data.color] ?? PALETA.pizarra).mini
  }, [])

  return (
    <div className="lienzo" ref={contenedorRef} onDoubleClick={alDobleClic}>
      <ReactFlow<NodoCuaderno, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={alCambiarNodos}
        onEdgesChange={alCambiarAristas}
        onConnect={alConectar}
        onReconnect={alReconectar}
        isValidConnection={conexionValida}
        nodeTypes={TIPOS_DE_NODO}
        defaultEdgeOptions={OPCIONES_ARISTA}
        // Loose permite conectar desde cualquier lado sin distinguir entrada/salida.
        connectionMode={ConnectionMode.Loose}
        // Si hay vista guardada se respeta; si no, se encuadra el contenido.
        // Arrancar en {0,0} dejaba los primeros cuadros debajo de la barra de
        // herramientas, que es justo donde nacen los nodos de un mapa nuevo.
        defaultViewport={documentoInicial.viewport ?? undefined}
        fitView={!documentoInicial.viewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        onMoveEnd={(_evento, viewport) => {
          viewportRef.current = viewport
          marcarCambio()
        }}
        minZoom={0.05}
        maxZoom={2.5}
        // Clave para el objetivo de "cientos o miles de ideas": no monta en el
        // DOM los cuadros que quedan fuera de la pantalla.
        onlyRenderVisibleElements
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnDoubleClick={false}
        elevateNodesOnSelect
        proOptions={{ hideAttribution: true }}
        aria-label="Lienzo del cuaderno"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d5d9e2" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={colorDeMinimapa}
          nodeStrokeWidth={0}
          nodeBorderRadius={3}
          maskColor="rgba(15, 23, 42, 0.08)"
        />

        <Panel position="top-left" className="panel-herramientas">
          <button type="button" className="boton-primario" onClick={() => crearNodo('texto')}>
            + Añadir cuadro
          </button>
          <button
            type="button"
            className="boton-postit"
            title="Una nota suelta, sin flechas ni conexiones"
            onClick={() => crearNodo('postit')}
          >
            + Post-it
          </button>
          <button type="button" className="boton-secundario" onClick={() => void fitView({ padding: 0.25 })}>
            Ajustar vista
          </button>
        </Panel>

        <Panel position="bottom-center" className="panel-ayuda">
          <span>
            Doble clic en el fondo para crear · arrastra desde un borde para conectar · selecciona
            texto para darle formato
          </span>
        </Panel>
      </ReactFlow>

      <div className={`estado-guardado estado-${estado}`} role="status">
        {etiquetaEstado}
      </div>
    </div>
  )
}
