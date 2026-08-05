import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

function leerDivision(): number {
  const guardada = Number(localStorage.getItem(CLAVE_DIVISION))
  return Number.isFinite(guardada) && guardada > 0 ? guardada : DIVISION_POR_DEFECTO
}

type Props = {
  cuaderno: Cuaderno
  clase: Clase
  onVolver: () => void
  /** Tras guardar los apuntes: actualiza la lista y marca el archivo pendiente. */
  onGuardarApuntes: (idClase: string, numNotas: number) => void
  /** Tras guardar el mapa desde la vista partida. */
  onActividadMapa: (idCuaderno: string, numIdeas: number) => void
}

export function VistaClase({
  cuaderno,
  clase,
  onVolver,
  onGuardarApuntes,
  onActividadMapa,
}: Props) {
  const [apuntes, setApuntes] = useState<DocumentoCuaderno | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [partida, setPartida] = useState(false)
  const [fraccion, setFraccion] = useState(leerDivision)
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
                ayuda="Doble clic en cualquier parte para escribir · selecciona texto para darle formato"
                teclasActivas={!partida || panelActivo === 'notas'}
                // Al partir y al volver, el panel cambia de ancho de golpe y la
                // vista guardada deja las notas fuera de sitio.
                senalDeReajuste={partida ? 1 : 0}
                accionesExtra={
                  cabePartida ? (
                    <button
                      type="button"
                      className="boton-estudio"
                      title={
                        partida
                          ? 'Ocupar toda la pantalla con los apuntes'
                          : 'Ver los apuntes junto al mapa de la materia'
                      }
                      onClick={() => setPartida((previa) => !previa)}
                    >
                      {partida ? 'Solo notas' : 'Ver en mapa'}
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
