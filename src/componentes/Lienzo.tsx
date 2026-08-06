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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useHayEditorActivo, useRegistrarHistorial, type Historial } from '../formato/contexto'
import { nuevoId } from '../almacenamiento/indice'
import { usarPaleta, useModoVisual } from '../modo/visual'
import {
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

type Medidas = { ancho: number; alto: number }

/** Medidas de partida de cada tipo de elemento. */
const MEDIDAS_NUEVAS: Record<TipoElemento, Medidas> = {
  texto: { ancho: 220, alto: 90 },
  postit: { ancho: 180, alto: 150 },
}

const OPCIONES_ARISTA = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { strokeWidth: 1.8 },
}

const RETARDO_AUTOGUARDADO = 700

/** Más holgado que el del contenido: mover la vista no tiene ninguna urgencia. */
const RETARDO_GUARDADO_VISTA = 1500

/** Una foto del contenido del lienzo, para poder volver a ella. */
type Instantanea = { nodes: NodoCuaderno[]; edges: Edge[] }

/**
 * Pasos de deshacer que se recuerdan.
 *
 * Cada paso retiene los nodos y las aristas de ese momento. Son referencias a los
 * mismos objetos, no copias, así que el coste real es el del array; con todo, se
 * pone un techo para que una sesión larga no acumule memoria sin límite.
 */
const MAXIMO_HISTORIAL = 60

/**
 * Ventana para agrupar cambios en un solo paso de deshacer.
 *
 * Sin ella, arrastrar un cuadro generaría un paso por cada píxel y escribir uno por
 * cada tecla: deshacer tendría que pulsarse cien veces para volver atrás una acción
 * que para quien la hizo fue una sola.
 */
const AGRUPAR_HISTORIAL = 500

/**
 * El lienzo no sabe a qué pertenece lo que dibuja.
 *
 * Recibe cómo guardar y a quién avisar, así que el mismo componente sirve para el
 * mapa conceptual de una materia y para los apuntes de una clase. Lo que cambia
 * entre los dos casos es el archivo de destino y los botones de la barra, no la
 * mecánica del lienzo.
 */
type PropsLienzo = {
  documentoInicial: DocumentoCuaderno
  /** Escribe el documento donde corresponda. */
  guardar: (documento: DocumentoCuaderno) => Promise<void>
  /** Se llama tras guardar contenido, para anotar la actividad donde toque. */
  onGuardado: (documento: DocumentoCuaderno) => void
  /** Botones propios de quien monta el lienzo: navegación, vista partida… */
  accionesExtra?: ReactNode
  etiqueta?: string
  ayuda?: string
  etiquetaCrear?: string
  /**
   * Con dos lienzos en pantalla partida hay que apagar las teclas del que no
   * está en uso: React Flow escucha Supr y Retroceso en el 'document', no en su
   * contenedor, así que sin esto una pulsación borraría en los dos a la vez.
   */
  teclasActivas?: boolean
  /**
   * Cada vez que este valor cambia, se reencuadra el contenido.
   *
   * Hace falta porque al partir la vista el lienzo pasa de toda la pantalla a un
   * tercio: la misma vista guardada deja el contenido fuera del recorte o debajo
   * de la barra de herramientas. La primera vez no se reencuadra, para no pisar
   * la vista con la que se abrió el documento.
   */
  senalDeReajuste?: number
  /**
   * Si se recuerda dónde quedó la vista de este lienzo.
   *
   * Se apaga para el mapa de la vista partida. Ese mapa es el mismo documento
   * que se abre a pantalla completa desde la materia, así que al mirarlo en un
   * panel de un tercio de ancho guardaba ese encuadre estrecho en el archivo, y
   * al volver al mapa completo aparecía con el zoom del panel. Apagado, la vista
   * del panel es de usar y tirar y el documento conserva la suya.
   */
  recordarVista?: boolean
  /**
   * Cambia el tamaño con el que nace un elemento nuevo.
   *
   * Un cuadro del mapa es una idea de una línea y nace pequeño. Una nota de clase
   * se escribe como una hoja: con encabezados, listas e imágenes dentro, y nacer
   * del tamaño de un cuadro obligaría a agrandarla a mano antes de cada apunte.
   */
  medidasNuevas?: Partial<Record<TipoElemento, Medidas>>
  /**
   * Encuadra el contenido al montar aunque el documento traiga vista guardada.
   *
   * Para el mapa de la vista partida: su vista guardada se calculó a pantalla
   * completa y en un panel estrecho deja el contenido fuera de cuadro.
   */
  encuadrarAlMontar?: boolean
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

export function Lienzo({
  documentoInicial,
  guardar: guardarDocumento,
  onGuardado,
  accionesExtra,
  etiqueta = 'Lienzo del cuaderno',
  ayuda = 'Doble clic en el fondo para crear · arrastra desde un borde para conectar · selecciona texto para darle formato',
  etiquetaCrear = '+ Añadir cuadro',
  teclasActivas = true,
  senalDeReajuste,
  recordarVista = true,
  encuadrarAlMontar = false,
  medidasNuevas,
}: PropsLienzo) {
  const [nodes, setNodes, onNodesChange] = useNodesState<NodoCuaderno>(documentoInicial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(documentoInicial.edges)
  const [estado, setEstado] = useState<EstadoGuardado>('inactivo')
  const [version, setVersion] = useState(0)
  /*
   * Versión aparte para los cambios que solo afectan a cómo se está mirando el
   * lienzo, no a su contenido: mover la vista y hacer zoom. Se guardan en este
   * dispositivo, pero no cuentan como actividad de la materia.
   */
  const [versionVista, setVersionVista] = useState(0)

  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<Viewport | null>(documentoInicial.viewport)
  const notasRef = useRef(documentoInicial.notas)
  const primerRender = useRef(true)

  // Espejos del estado para que el temporizador de guardado lea siempre lo
  // último sin tener que figurar como dependencia del efecto.
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const onGuardadoRef = useRef(onGuardado)
  /*
   * También la función de guardar va por referencia: quien monta el lienzo suele
   * pasarla en línea, y si figurara como dependencia el temporizador del
   * autoguardado se reiniciaría en cada render y no llegaría a dispararse.
   */
  const guardarRef = useRef(guardarDocumento)
  /** Hay contenido modificado que todavía no se ha anunciado a la nube. */
  const contenidoSucioRef = useRef(false)

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
    onGuardadoRef.current = onGuardado
    guardarRef.current = guardarDocumento
  }, [nodes, edges, onGuardado, guardarDocumento])

  const { screenToFlowPosition, fitView, getNode } = useReactFlow<NodoCuaderno>()

  /*
   * Historial de deshacer del lienzo.
   *
   * React Flow no trae ninguno, así que borrar un cuadro por error no tenía vuelta
   * atrás. Las pilas van en referencias y no en estado porque se leen y se escriben
   * dentro de manejadores de eventos; 'selloHistorial' es lo único que existe para
   * provocar el repintado que habilita o apaga los botones de la barra.
   */
  const pasadoRef = useRef<Instantanea[]>([])
  const futuroRef = useRef<Instantanea[]>([])
  const ultimoPasoRef = useRef(0)
  const [selloHistorial, setSelloHistorial] = useState(0)

  /** Anota el estado *anterior* al cambio que se está aplicando. */
  const registrarPaso = useCallback(() => {
    const ahora = Date.now()
    /*
     * Dentro de la ventana, el paso ya abierto absorbe el cambio.
     *
     * La marca NO se adelanta al absorber, y ahí estaba el error: adelantándola, la
     * ventana no se cerraba nunca mientras siguieran llegando cambios seguidos, así
     * que escribir un párrafo entero dentro de un cuadro quedaba en un único paso y
     * un solo deshacer se lo llevaba todo. Midiendo desde el primer cambio del grupo,
     * la ventana se cierra a los 500 ms y el paso siguiente abre otro.
     */
    if (ahora - ultimoPasoRef.current < AGRUPAR_HISTORIAL) return
    ultimoPasoRef.current = ahora

    /*
     * nodesRef todavía apunta al estado ya pintado, porque se sincroniza en un
     * efecto y esto corre dentro del manejador del evento. Es decir: exactamente la
     * foto de antes del cambio, que es la que hay que guardar para poder volver.
     */
    pasadoRef.current = [
      ...pasadoRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
    ].slice(-MAXIMO_HISTORIAL)
    // Cualquier cambio nuevo invalida lo que había por rehacer.
    futuroRef.current = []
    setSelloHistorial((sello) => sello + 1)
  }, [])

  /** Marca que ha cambiado el contenido: hay que guardar y avisar a la nube. */
  const marcarCambio = useCallback(() => {
    registrarPaso()
    contenidoSucioRef.current = true
    setVersion((previa) => previa + 1)
  }, [registrarPaso])

  /** Vuelca una foto en el lienzo. No anota nada: la llaman deshacer y rehacer. */
  const aplicarInstantanea = useCallback(
    (instantanea: Instantanea) => {
      nodesRef.current = instantanea.nodes
      edgesRef.current = instantanea.edges
      setNodes(instantanea.nodes)
      setEdges(instantanea.edges)
      // El siguiente cambio de verdad debe abrir un paso nuevo, no agruparse con
      // el que acabamos de deshacer.
      ultimoPasoRef.current = 0
      contenidoSucioRef.current = true
      setVersion((previa) => previa + 1)
    },
    [setNodes, setEdges],
  )

  const deshacer = useCallback(() => {
    const anterior = pasadoRef.current.at(-1)
    if (!anterior) return
    pasadoRef.current = pasadoRef.current.slice(0, -1)
    futuroRef.current = [
      ...futuroRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
    ]
    aplicarInstantanea(anterior)
    setSelloHistorial((sello) => sello + 1)
  }, [aplicarInstantanea])

  const rehacer = useCallback(() => {
    const siguiente = futuroRef.current.at(-1)
    if (!siguiente) return
    futuroRef.current = futuroRef.current.slice(0, -1)
    pasadoRef.current = [
      ...pasadoRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
    ].slice(-MAXIMO_HISTORIAL)
    aplicarInstantanea(siguiente)
    setSelloHistorial((sello) => sello + 1)
  }, [aplicarInstantanea])

  /*
   * Se lee de las referencias con 'selloHistorial' como dependencia: es él quien
   * cambia cada vez que las pilas cambian, y así los botones de la barra se
   * habilitan y se apagan solos.
   */
  const historial = useMemo<Historial>(
    () => ({
      puedeDeshacer: pasadoRef.current.length > 0,
      puedeRehacer: futuroRef.current.length > 0,
      deshacer,
      rehacer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selloHistorial, deshacer, rehacer],
  )

  // Solo el lienzo que tiene el mando anuncia su historial: en pantalla dividida
  // hay dos, y deshacer debe actuar sobre el panel en el que estás.
  useRegistrarHistorial(teclasActivas ? historial : null)

  /*
   * Ctrl+Z y Ctrl+Mayús+Z para el lienzo.
   *
   * Con un editor de texto al mando el atajo se aparta, por el mismo criterio que usa
   * el botón de la barra: allí manda el historial del editor, que deshace palabras y
   * no cuadros. Se consulta el registro de formato y no el foco del documento porque
   * mirar solo si el foco está en un 'contentEditable' dejaba un hueco: con un cuadro
   * en edición y el foco en un desplegable de la barra, el atajo deshacía el lienzo
   * por detrás, y la siguiente tecla del editor abierto reescribía lo restaurado
   * haciendo desaparecer el deshacer sin rastro.
   *
   * También se respeta el deshacer nativo de un campo de texto normal.
   */
  const hayEditorActivo = useHayEditorActivo()

  useEffect(() => {
    if (!teclasActivas || hayEditorActivo) return

    const alPulsar = (evento: KeyboardEvent) => {
      if (!(evento.ctrlKey || evento.metaKey)) return
      if (evento.key.toLowerCase() !== 'z') return

      const activo = document.activeElement
      if (activo instanceof HTMLElement && activo.isContentEditable) return
      if (activo instanceof HTMLInputElement || activo instanceof HTMLTextAreaElement) return

      evento.preventDefault()
      if (evento.shiftKey) rehacer()
      else deshacer()
    }

    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [teclasActivas, hayEditorActivo, deshacer, rehacer])

  /** Marca que solo ha cambiado la vista: se guarda aquí y no se anuncia. */
  const marcarVista = useCallback(() => setVersionVista((previa) => previa + 1), [])

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
      const { ancho, alto } = medidasNuevas?.[tipo] ?? MEDIDAS_NUEVAS[tipo]
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
    [screenToFlowPosition, setNodes, marcarCambio, medidasNuevas],
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

  const construirDocumento = useCallback(
    (): DocumentoCuaderno => ({
      version: VERSION_DOCUMENTO,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport: viewportRef.current,
      notas: notasRef.current,
    }),
    [],
  )

  const guardar = useCallback(async () => {
    setEstado('guardando')
    try {
      const documento = construirDocumento()
      await guardarRef.current(documento)
      contenidoSucioRef.current = false
      setEstado('guardado')
      // Se entrega el documento entero y no un número: qué se cuenta depende de
      // para qué sirva el lienzo. El mapa cuenta ideas descartando los post-its;
      // los apuntes de una clase cuentan todas las notas.
      onGuardadoRef.current(documento)
    } catch (error) {
      console.error('No se pudo guardar el lienzo', error)
      setEstado('error')
    }
  }, [construirDocumento])

  /**
   * Guarda el documento sin anunciar actividad.
   *
   * Se usa para la posición y el zoom del lienzo. Antes, mover la vista
   * recorría toda la cadena de un cambio real: actualizaba la fecha de
   * modificación de la materia, la marcaba pendiente de subida y acababa
   * generando un commit en GitHub. Además fabricaba conflictos falsos, porque
   * bastaba con mirar el mismo mapa en dos dispositivos para que los dos
   * apareciesen "modificados" sin haber tocado nada.
   *
   * Ahora la vista se recuerda en este dispositivo y viaja a la nube de paso,
   * cuando algo del contenido sí cambia.
   */
  const guardarVista = useCallback(async () => {
    try {
      await guardarRef.current(construirDocumento())
    } catch (error) {
      console.error('No se pudo guardar la vista del lienzo', error)
    }
  }, [construirDocumento])

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

  /*
   * Guardado de la vista, con más retardo que el del contenido: mover el lienzo
   * produce muchos eventos seguidos y no hay ninguna prisa en anotar dónde
   * quedó la vista.
   */
  useEffect(() => {
    if (versionVista === 0) return

    const temporizador = window.setTimeout(() => {
      void guardarVista()
    }, RETARDO_GUARDADO_VISTA)

    return () => window.clearTimeout(temporizador)
  }, [versionVista, guardarVista])

  // Si se abre un cuaderno es muy probable que se acabe escribiendo en él, así
  // que el editor se trae en segundo plano antes de que haga falta.
  useEffect(() => {
    precargarEditor()
  }, [])

  /*
   * Reencuadre a petición. Se salta la primera vez para no pisar la vista con la
   * que se abrió el documento; a partir de ahí, cada cambio de la señal reencuadra.
   */
  const primerReajuste = useRef(true)
  useEffect(() => {
    if (primerReajuste.current) {
      primerReajuste.current = false
      return
    }
    void fitView({ padding: 0.25 })
  }, [senalDeReajuste, fitView])

  /*
   * Guarda lo pendiente si se cierra la pestaña en medio del retardo. Se
   * distingue el caso para que cerrar la pestaña después de solo mover la vista
   * no marque la materia como modificada.
   */
  useEffect(() => {
    const alSalir = () => {
      if (contenidoSucioRef.current) {
        void guardar()
      } else if (versionVista > 0) {
        void guardarVista()
      }
    }
    window.addEventListener('pagehide', alSalir)
    return () => window.removeEventListener('pagehide', alSalir)
  }, [guardar, guardarVista, versionVista])

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

  const paleta = usarPaleta()
  const { esComodo } = useModoVisual()

  const colorDeMinimapa = useCallback(
    (nodo: NodoCuaderno) => (paleta[nodo.data.color] ?? paleta.pizarra).mini,
    [paleta],
  )

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
        fitView={encuadrarAlMontar || !documentoInicial.viewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        // Mover o hacer zoom no es editar: se recuerda la vista, pero no cuenta
        // como cambio de la materia (ver guardarVista). Si este lienzo no
        // recuerda su vista, no se toca la referencia: así un cambio de contenido
        // hecho desde aquí guarda el encuadre con el que se abrió el documento y
        // no el de este panel.
        onMoveEnd={(_evento, viewport) => {
          if (!recordarVista) return
          viewportRef.current = viewport
          marcarVista()
        }}
        minZoom={0.05}
        maxZoom={2.5}
        // Clave para el objetivo de "cientos o miles de ideas": no monta en el
        // DOM los cuadros que quedan fuera de la pantalla.
        onlyRenderVisibleElements
        deleteKeyCode={teclasActivas ? ['Backspace', 'Delete'] : null}
        multiSelectionKeyCode={teclasActivas ? ['Shift', 'Meta', 'Control'] : null}
        selectionOnDrag
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnDoubleClick={false}
        elevateNodesOnSelect
        proOptions={{ hideAttribution: true }}
        aria-label={etiqueta}
      >
        {/*
          La retícula, en el mismo gris cálido que los bordes de la app: en gris
          azulado se veía como una trama fría sobre el fondo crema.

          En modo cómodo los puntos son menos y más gordos. Una trama fina y muy
          densa es lo que peor sienta a un panel malo: los puntos caen entre
          píxeles, cada uno se pinta distinto y el fondo entero parece vibrar.
        */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={esComodo ? 28 : 22}
          size={esComodo ? 2.2 : 1.4}
          color={esComodo ? '#b9ac8b' : '#d6d1c4'}
        />
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
            {etiquetaCrear}
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
          {/* Los botones de navegación los pone quien monta el lienzo: así este
              componente no necesita saber en qué pantalla está. */}
          {accionesExtra}
        </Panel>

        <Panel position="bottom-center" className="panel-ayuda">
          <span>{ayuda}</span>
        </Panel>
      </ReactFlow>

      <div className={`estado-guardado estado-${estado}`} role="status">
        {etiquetaEstado}
      </div>
    </div>
  )
}
