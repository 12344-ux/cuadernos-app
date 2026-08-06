import { ReactFlowProvider } from '@xyflow/react'
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cargarApunte, guardarApunte } from '../almacenamiento/apuntes'
import { cargarDocumento, guardarDocumento } from '../almacenamiento/documentos'
import { VERSION_APUNTE, contarPalabras, type Apunte } from '../apuntes/tipos'
import { clasesVisibles } from '../clases/tipos'
import { BarraFormato } from '../componentes/BarraFormato'
import { DivisorArrastrable } from '../componentes/DivisorArrastrable'
import { HojaApuntesDiferida } from '../componentes/hojaDiferida'
import { Lienzo } from '../componentes/Lienzo'
import { PanelClases } from '../componentes/PanelClases'
import { diaCompletoLegible } from '../fechas'
import { useClases } from '../hooks/useClases'
import { irALaClase, irAlCuaderno, irAlEstudioActivo } from '../hooks/useRuta'
import type { Cuaderno, DocumentoCuaderno } from '../tipos'

/*
 * La proporción del divisor es preferencia de esta pantalla, no contenido.
 *
 * La clave lleva sufijo porque el significado se invirtió: antes era la fracción de
 * los apuntes, que estaban a la izquierda; ahora es la del mapa. Reutilizarla habría
 * abierto la pantalla partida con el mapa en un tercio a quien viniera de la versión
 * anterior.
 */
const CLAVE_DIVISION = 'cuadernos:division-estudio-mapa'

/** Los mismos límites que aplica el divisor, para no leer un valor fuera de rango. */
const MINIMO_DIVISION = 0.3
const MAXIMO_DIVISION = 0.78

/**
 * Cuánto ocupa el mapa al partir la pantalla.
 *
 * El mapa se queda con la parte ancha porque es donde se trabaja moviendo cosas; los
 * apuntes solo hay que poder leerlos y seguir escribiendo en ellos.
 */
const DIVISION_POR_DEFECTO = 0.62

/** Por debajo de este ancho, dos paneles lado a lado no sirven para nada. */
const ANCHO_MINIMO_PARTIDA = 900

/** Espera antes de guardar lo escrito, para no escribir en disco en cada tecla. */
const RETARDO_GUARDADO = 700

function leerDivision(): number {
  const guardada = Number(localStorage.getItem(CLAVE_DIVISION))
  if (!Number.isFinite(guardada) || guardada <= 0) return DIVISION_POR_DEFECTO
  return Math.min(MAXIMO_DIVISION, Math.max(MINIMO_DIVISION, guardada))
}

/** Dos paneles, el de la izquierda más ancho: la proporción que da el botón. */
function IconoDividir() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true" focusable="false">
      <rect
        x="0.7"
        y="0.7"
        width="12.6"
        height="10.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <line x1="8.8" y1="0.7" x2="8.8" y2="11.3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

type Props = {
  cuaderno: Cuaderno
  /** Clase abierta, o null para abrir la más reciente. */
  idClaseAbierta: string | null
  /** Cambió la lista de clases: alta, baja, nombre o fecha. */
  onActividadClases: (idCuaderno: string) => void
  /** Cambiaron los apuntes de una clase, que van en su propio archivo. */
  onActividadApuntes: (idClase: string) => void
  /** Cambió el mapa desde la vista partida. */
  onActividadMapa: (idCuaderno: string, numIdeas: number) => void
  barraNube?: ReactNode
}

/**
 * Estudio Activo: los apuntes por clase de una materia.
 *
 * El reparto es el de un cuaderno: las clases en una columna y la hoja de la clase
 * abierta al lado, las dos a la vez. Y la hoja es una hoja de verdad, un texto que
 * crece hacia abajo, no un lienzo de cuadros; el lienzo infinito se queda para el
 * mapa conceptual, que es donde tiene sentido colocar las cosas en el espacio.
 */
export function SeccionEstudioActivo({
  cuaderno,
  idClaseAbierta,
  onActividadClases,
  onActividadApuntes,
  onActividadMapa,
  barraNube,
}: Props) {
  const alCambiarLista = useCallback(
    () => onActividadClases(cuaderno.id),
    [cuaderno.id, onActividadClases],
  )

  const { indice, error, crearClase, renombrarClase, cambiarFecha, eliminarClase, marcarApuntes } =
    useClases({ idCuaderno: cuaderno.id, onActividad: alCambiarLista })

  const visibles = indice ? clasesVisibles(indice) : []
  const claseAbierta =
    (idClaseAbierta ? visibles.find((clase) => clase.id === idClaseAbierta) : undefined) ??
    // Sin clase en la dirección, se abre la más reciente: entrar en la sección y
    // encontrarse una hoja vacía sin saber qué elegir no ayuda a nadie.
    visibles[0] ??
    null

  const [apunte, setApunte] = useState<Apunte | null>(null)
  const [errorApunte, setErrorApunte] = useState<string | null>(null)
  /*
   * El fallo al guardar va aparte del fallo al cargar. Con uno solo, un error de cuota
   * sustituía el editor por un mensaje y se llevaba por delante el texto que todavía
   * no estaba en disco: justo el peor momento para retirar la hoja de la pantalla.
   */
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const [partida, setPartida] = useState(false)
  const [fraccion, setFraccion] = useState(leerDivision)
  const [reajuste, setReajuste] = useState(0)
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

  const idClase = claseAbierta?.id ?? null

  // Los apuntes de la clase abierta.
  useEffect(() => {
    if (!idClase) {
      setApunte(null)
      return
    }

    let activo = true
    setApunte(null)
    setErrorApunte(null)

    cargarApunte(idClase)
      .then((cargado) => {
        if (activo) setApunte(cargado)
      })
      .catch((causa) => {
        console.error('No se pudieron cargar los apuntes', causa)
        if (activo) setErrorApunte('No se pudieron cargar los apuntes de esta clase.')
      })

    return () => {
      activo = false
    }
  }, [idClase])

  /*
   * El mapa se lee cada vez que se parte la pantalla, y se suelta al volver.
   *
   * No se puede conservar en memoria entre sesiones partidas: el Lienzo se desmonta al
   * dejar de partir (en ese hueco del árbol entra la columna de clases), así que al
   * partir otra vez arrancaría del documento leído la primera vez. El primer cambio
   * haría que su autoguardado escribiese ese estado viejo encima de lo guardado
   * después, borrando el trabajo de la sesión partida anterior.
   */
  useEffect(() => {
    if (!partida) {
      setMapa(null)
      return
    }

    let activo = true
    cargarDocumento(cuaderno.id)
      .then((cargado) => {
        if (activo) setMapa(cargado)
      })
      .catch((causa) => console.error('No se pudo cargar el mapa', causa))

    return () => {
      activo = false
    }
  }, [partida, cuaderno.id])

  /*
   * Guardado de la hoja con retardo.
   *
   * El texto en curso vive en una referencia y no en el estado: si cada tecla
   * provocara un render de esta pantalla, volvería a pintarse el lienzo del mapa que
   * hay al lado en la vista partida.
   */
  const borradorRef = useRef<string | null>(null)
  const temporizadorRef = useRef<number | null>(null)

  const guardarAhora = useCallback(
    (idDeLaClase: string, contenido: string) => {
      const apunteNuevo: Apunte = {
        version: VERSION_APUNTE,
        contenido,
        // Es la fecha que decide quién gana al sincronizar entre dispositivos.
        escrito: Date.now(),
      }

      /*
       * Se anuncia antes de esperar la escritura, no en el '.then()'.
       *
       * Este mismo camino se recorre al cerrar la pestaña, y allí la continuación de la
       * promesa no llega a ejecutarse: la escritura en IndexedDB suele salir, pero la
       * clase no quedaba marcada como pendiente de subir, así que lo escrito se quedaba
       * en el dispositivo y la nube no se enteraba hasta la siguiente edición.
       *
       * La lista y la hoja son archivos distintos, de ahí los dos avisos.
       */
      marcarApuntes(idDeLaClase, contarPalabras(contenido))
      onActividadApuntes(idDeLaClase)

      void guardarApunte(idDeLaClase, apunteNuevo)
        .then(() => setErrorGuardado(null))
        .catch((causa) => {
          console.error('No se pudieron guardar los apuntes', causa)
          setErrorGuardado('No se pudo guardar. Revisa el espacio del navegador.')
        })
    },
    [marcarApuntes, onActividadApuntes],
  )

  const alEscribir = useCallback(
    (html: string) => {
      if (!idClase) return
      borradorRef.current = html

      if (temporizadorRef.current) window.clearTimeout(temporizadorRef.current)
      temporizadorRef.current = window.setTimeout(() => {
        temporizadorRef.current = null
        const pendiente = borradorRef.current
        borradorRef.current = null
        if (pendiente !== null) guardarAhora(idClase, pendiente)
      }, RETARDO_GUARDADO)
    },
    [idClase, guardarAhora],
  )

  /*
   * Vuelca lo pendiente antes de cambiar de clase o de cerrar la pestaña. Sin esto,
   * escribir y saltar de clase en menos de lo que tarda el retardo perdería lo
   * último escrito.
   */
  const volcarPendiente = useCallback(() => {
    if (temporizadorRef.current) {
      window.clearTimeout(temporizadorRef.current)
      temporizadorRef.current = null
    }
    const pendiente = borradorRef.current
    borradorRef.current = null
    if (pendiente !== null && idClase) guardarAhora(idClase, pendiente)
  }, [idClase, guardarAhora])

  useEffect(() => {
    window.addEventListener('pagehide', volcarPendiente)
    return () => {
      window.removeEventListener('pagehide', volcarPendiente)
      // Al desmontar o al cambiar de clase, lo pendiente se escribe ya.
      volcarPendiente()
    }
  }, [volcarPendiente])

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

  const guardarMapa = useCallback(
    (documento: DocumentoCuaderno) => guardarDocumento(cuaderno.id, documento),
    [cuaderno.id],
  )

  const alGuardarMapa = useCallback(
    (documento: DocumentoCuaderno) =>
      onActividadMapa(cuaderno.id, documento.nodes.filter((n) => n.type === 'texto').length),
    [cuaderno.id, onActividadMapa],
  )

  if (error) {
    return (
      <main className="selector">
        <p className="vacio">{error}</p>
      </main>
    )
  }

  if (!indice) {
    return (
      <main className="selector">
        <p className="vacio">Abriendo Estudio Activo…</p>
      </main>
    )
  }

  return (
    <div className="vista-estudio">
      <header className="barra-superior">
        <button type="button" className="boton-volver" onClick={() => irAlCuaderno(cuaderno.id)}>
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
          Mapa
        </button>

        <span className="titulo-estudio-marca">Estudio Activo</span>
        <h1 className="titulo-cuaderno">{cuaderno.nombre}</h1>

        {cabePartida && claseAbierta && (
          <button
            type="button"
            className={`boton-estudio boton-dividir${partida ? ' activo' : ''}`}
            title={
              partida
                ? 'Ocupar toda la pantalla con los apuntes'
                : 'Dividir la pantalla: el mapa de la materia a la izquierda y estos apuntes a la derecha'
            }
            aria-pressed={partida}
            onClick={alternarPartida}
          >
            <IconoDividir />
            {partida ? 'Solo apuntes' : 'Dividir pantalla'}
          </button>
        )}

        <div className="espaciador" />
        {barraNube}
      </header>

      {/*
       * Una sola barra para toda la pantalla, también cuando está partida: el mapa y
       * la hoja se anuncian al recibir el foco y ella actúa sobre el que estés usando.
       * Con una barra por panel habría dos juegos de controles compitiendo.
       */}
      <BarraFormato />

      <div
        className={`cuerpo-apuntes${partida ? ' partida' : ''}`}
        ref={cuerpoRef}
        // El mapa va a la izquierda y se queda la parte ancha; los apuntes, a la
        // derecha.
        style={partida ? { gridTemplateColumns: `${fraccion * 100}% auto 1fr` } : undefined}
      >
        {partida ? (
          <>
            <section className="panel-mapa">
              <p className="titulo-panel">Mapa de {cuaderno.nombre}</p>
              {mapa ? (
                <ReactFlowProvider key={`mapa-${cuaderno.id}`}>
                  <Lienzo
                    documentoInicial={mapa}
                    guardar={guardarMapa}
                    onGuardado={alGuardarMapa}
                    etiqueta={`Mapa conceptual de ${cuaderno.nombre}`}
                    ayuda="Arrastra desde un borde para conectar"
                    senalDeReajuste={reajuste}
                    // Este panel es una ventana de paso al mismo documento que se
                    // abre a pantalla completa desde la materia: encuadra para verlo
                    // aquí, pero no guarda este encuadre en el archivo.
                    recordarVista={false}
                    encuadrarAlMontar
                  />
                </ReactFlowProvider>
              ) : (
                <p className="vacio">Abriendo el mapa…</p>
              )}
            </section>

            <DivisorArrastrable
              fraccion={fraccion}
              onCambiar={cambiarFraccion}
              contenedor={cuerpoRef}
              onAjustado={reencuadrar}
            />
          </>
        ) : (
          <PanelClases
            indice={indice}
            idActiva={claseAbierta?.id ?? null}
            onAbrir={(id) => irALaClase(cuaderno.id, id)}
            onCrear={(nombre, fecha) => {
              const clase = crearClase(nombre, fecha)
              irALaClase(cuaderno.id, clase.id)
            }}
            onRenombrar={renombrarClase}
            onCambiarFecha={cambiarFecha}
            onEliminar={(id) => {
              eliminarClase(id)
              // Si se borra la que estaba abierta, la dirección deja de ser válida.
              if (id === claseAbierta?.id) irAlEstudioActivo(cuaderno.id)
            }}
          />
        )}

        <section className="panel-hoja">
          {partida && claseAbierta && <p className="titulo-panel">{claseAbierta.nombre}</p>}

          {/* El fallo al guardar avisa sin quitar la hoja de en medio. */}
          {errorGuardado && (
            <p className="aviso-guardado" role="alert">
              {errorGuardado}
            </p>
          )}

          {!claseAbierta ? (
            <p className="vacio">
              Crea una clase en la columna de la izquierda para empezar a tomar apuntes.
            </p>
          ) : errorApunte ? (
            <p className="vacio">{errorApunte}</p>
          ) : !apunte ? (
            <p className="vacio">Abriendo los apuntes…</p>
          ) : (
            <Suspense fallback={<p className="vacio">Cargando el editor…</p>}>
              <HojaApuntesDiferida
                // Recrear al cambiar de clase: sin esto el editor seguiría mostrando
                // el texto de la clase anterior.
                key={claseAbierta.id}
                contenidoInicial={apunte.contenido}
                onCambiar={alEscribir}
                encabezado={diaCompletoLegible(claseAbierta.fecha)}
              />
            </Suspense>
          )}
        </section>
      </div>
    </div>
  )
}
