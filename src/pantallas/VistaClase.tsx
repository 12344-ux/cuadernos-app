import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { apuntesDeClase } from '../almacenamiento/apuntes'
import { cargarDocumento, guardarDocumento } from '../almacenamiento/documentos'
import type { Clase } from '../clases/tipos'
import { DivisorArrastrable } from '../componentes/DivisorArrastrable'
import { Lienzo } from '../componentes/Lienzo'
import type { Cuaderno, DocumentoCuaderno } from '../tipos'

/** La proporción del divisor es preferencia de esta pantalla, no contenido. */
const CLAVE_DIVISION = 'cuadernos:division-estudio'
const DIVISION_POR_DEFECTO = 0.34

/** Por debajo de este ancho, dos lienzos lado a lado no sirven para nada. */
const ANCHO_MINIMO_PARTIDA = 800

/**
 * Tamaño de una nota nueva: proporción de hoja, no de cuadro de mapa.
 *
 * El ancho da para una línea de texto cómoda de leer y el alto para varios
 * párrafos, de modo que se pueda escribir seguido durante la clase sin pararse a
 * agrandar la nota. El post-it se deja como está, que es su tamaño de siempre.
 */
const MEDIDA_NOTA = { texto: { ancho: 620, alto: 340 } } as const

function leerDivision(): number {
  const guardada = Number(localStorage.getItem(CLAVE_DIVISION))
  return Number.isFinite(guardada) && guardada > 0 ? guardada : DIVISION_POR_DEFECTO
}

/**
 * Dos paneles lado a lado, el de la izquierda más estrecho, que es exactamente la
 * proporción que produce el botón. Dibujarlo ahorra tener que leer la etiqueta
 * para entender qué hace.
 */
function IconoDividir() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true" focusable="false">
      <rect x="0.7" y="0.7" width="12.6" height="10.6" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <line x1="5.2" y1="0.7" x2="5.2" y2="11.3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

type Props = {
  cuaderno: Cuaderno
  clase: Clase
  onVolver: () => void
  /** Tras guardar los apuntes: actualiza la lista y marca el archivo pendiente. */
  onGuardarApuntes: (idClase: string, numNotas: number) => void
  /** Tras guardar el mapa desde la vista partida. */
  onActividadMapa: (idCuaderno: string, numIdeas: number) => void
  /** Estado de la sincronización, en la barra superior. */
  barraNube?: ReactNode
}

export function VistaClase({
  cuaderno,
  clase,
  onVolver,
  onGuardarApuntes,
  onActividadMapa,
  barraNube,
}: Props) {
  const [apuntes, setApuntes] = useState<DocumentoCuaderno | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [partida, setPartida] = useState(false)
  const [fraccion, setFraccion] = useState(leerDivision)
  /*
   * Contador de reencuadres. Sube al partir la vista, al volver a pantalla
   * completa y al terminar de mover el divisor: los tres cambian el ancho de los
   * paneles, y cambiar el ancho no mueve la vista de React Flow, así que sin
   * reencuadrar el contenido queda fuera de cuadro.
   */
  const [reajuste, setReajuste] = useState(0)
  /*
   * Cuál de los dos lienzos manda el teclado. React Flow escucha Supr en el
   * 'document', no en su contenedor, así que sin esto una pulsación borraría a la
   * vez en los apuntes y en el mapa.
   */
  const [panelActivo, setPanelActivo] = useState<'notas' | 'mapa'>('notas')

  /** El mapa solo se carga si de verdad se abre la vista partida. */
  const [mapa, setMapa] = useState<DocumentoCuaderno | null>(null)
  const cuerpoRef = useRef<HTMLDivElement | null>(null)

  const [cabePartida, setCabePartida] = useState(
    () => window.innerWidth >= ANCHO_MINIMO_PARTIDA,
  )

  useEffect(() => {
    const alRedimensionar = () => {
      const cabe = window.innerWidth >= ANCHO_MINIMO_PARTIDA
      setCabePartida(cabe)
      if (!cabe) setPartida(false)
    }
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [])

  useEffect(() => {
    let activo = true
    setApuntes(null)
    setError(null)

    apuntesDeClase
      .cargar(clase.id)
      .then((cargado) => {
        if (activo) setApuntes(cargado)
      })
      .catch((causa) => {
        console.error('No se pudieron cargar los apuntes', causa)
        if (activo) setError('No se pudieron cargar los apuntes de esta clase.')
      })

    return () => {
      activo = false
    }
  }, [clase.id])

  // El mapa se trae la primera vez que se parte la vista, y se conserva después.
  useEffect(() => {
    if (!partida || mapa) return
    let activo = true
    cargarDocumento(cuaderno.id)
      .then((cargado) => {
        if (activo) setMapa(cargado)
      })
      .catch((causa) => console.error('No se pudo cargar el mapa', causa))
    return () => {
      activo = false
    }
  }, [partida, mapa, cuaderno.id])

  const cambiarFraccion = useCallback((nueva: number) => {
    setFraccion(nueva)
    try {
      localStorage.setItem(CLAVE_DIVISION, String(nueva))
    } catch {
      // Si el almacenamiento está lleno, la vista sigue funcionando igual.
    }
  }, [])

  const reencuadrar = useCallback(() => setReajuste((previo) => previo + 1), [])

  const alternarPartida = useCallback(() => {
    setPartida((previa) => !previa)
    reencuadrar()
  }, [reencuadrar])

  const guardarApuntes = useCallback(
    (documento: DocumentoCuaderno) => apuntesDeClase.guardar(clase.id, documento),
    [clase.id],
  )

  const alGuardarApuntes = useCallback(
    (documento: DocumentoCuaderno) => onGuardarApuntes(clase.id, documento.nodes.length),
    [clase.id, onGuardarApuntes],
  )

  const guardarMapa = useCallback(
    (documento: DocumentoCuaderno) => guardarDocumento(cuaderno.id, documento),
    [cuaderno.id],
  )

  const alGuardarMapa = useCallback(
    (documento: DocumentoCuaderno) =>
      onActividadMapa(cuaderno.id, documento.nodes.filter((n) => n.type === 'texto').length),
    [cuaderno.id, onActividadMapa],
  )

  return (
    <div className="vista-clase">
      <header className="barra-superior">
        <button type="button" className="boton-volver" onClick={onVolver}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Clases
        </button>
        <h1 className="titulo-cuaderno">{clase.nombre}</h1>
        <span className="pastilla">{cuaderno.nombre}</span>
        <div className="espaciador" />
        {barraNube}
      </header>

      {error ? (
        <p className="vacio">{error}</p>
      ) : !apuntes ? (
        <p className="vacio">Abriendo los apuntes…</p>
      ) : (
        <div
          className={`cuerpo-clase${partida ? ' partida' : ''}`}
          ref={cuerpoRef}
          style={partida ? { gridTemplateColumns: `${fraccion * 100}% auto 1fr` } : undefined}
        >
          <section
            className="panel-lienzo"
            // En captura para que quede registrado antes de que React Flow
            // procese el clic dentro del lienzo.
            onPointerDownCapture={() => setPanelActivo('notas')}
          >
            {partida && <p className="titulo-panel">Apuntes de la clase</p>}
            <ReactFlowProvider key={`apuntes-${clase.id}`}>
              <Lienzo
                documentoInicial={apuntes}
                guardar={guardarApuntes}
                onGuardado={alGuardarApuntes}
                etiqueta={`Apuntes de ${clase.nombre}`}
                etiquetaCrear="+ Añadir nota"
                ayuda="Doble clic en cualquier parte para escribir · pega o arrastra imágenes dentro de una nota · Ctrl y rueda para acercar o alejar"
                // Una nota de clase nace con tamaño de hoja, no de cuadro de
                // mapa: aquí se escriben párrafos, listas y capturas pegadas.
                medidasNuevas={MEDIDA_NOTA}
                teclasActivas={!partida || panelActivo === 'notas'}
                // Al partir, al volver y al mover el divisor, el panel cambia de
                // ancho y la vista guardada deja las notas fuera de sitio.
                senalDeReajuste={reajuste}
                // Con la pantalla partida, este panel es tan estrecho como el del
                // mapa y su encuadre no representa cómo se abrirá la clase la
                // próxima vez. Mismo criterio que allí: se recuerda la vista solo
                // cuando los apuntes ocupan la pantalla entera.
                recordarVista={!partida}
                accionesExtra={
                  cabePartida ? (
                    <button
                      type="button"
                      className={`boton-estudio boton-dividir${partida ? ' activo' : ''}`}
                      title={
                        partida
                          ? 'Ocupar toda la pantalla con los apuntes'
                          : 'Dividir la pantalla: los apuntes a un lado y el mapa de la materia al otro'
                      }
                      aria-pressed={partida}
                      onClick={alternarPartida}
                    >
                      <IconoDividir />
                      {partida ? 'Solo apuntes' : 'Dividir pantalla'}
                    </button>
                  ) : undefined
                }
              />
            </ReactFlowProvider>
          </section>

          {partida && (
            <DivisorArrastrable
              fraccion={fraccion}
              onCambiar={cambiarFraccion}
              contenedor={cuerpoRef}
              onAjustado={reencuadrar}
            />
          )}

          {partida && (
            <section className="panel-lienzo" onPointerDownCapture={() => setPanelActivo('mapa')}>
              <p className="titulo-panel">Mapa de {cuaderno.nombre}</p>
              {mapa ? (
                <ReactFlowProvider key={`mapa-${cuaderno.id}`}>
                  <Lienzo
                    documentoInicial={mapa}
                    guardar={guardarMapa}
                    onGuardado={alGuardarMapa}
                    etiqueta={`Mapa conceptual de ${cuaderno.nombre}`}
                    ayuda="Arrastra desde un borde para conectar"
                    teclasActivas={panelActivo === 'mapa'}
                    senalDeReajuste={reajuste}
                    // Este panel es una ventana de paso al mismo documento que se
                    // abre a pantalla completa desde la materia: encuadra para
                    // verlo aquí, pero no guarda este encuadre en el archivo.
                    recordarVista={false}
                    encuadrarAlMontar
                  />
                </ReactFlowProvider>
              ) : (
                <p className="vacio">Abriendo el mapa…</p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
