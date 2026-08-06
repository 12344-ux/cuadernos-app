import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { cargarDocumento, guardarDocumento } from '../almacenamiento/documentos'
import { BarraFormato } from '../componentes/BarraFormato'
import { Lienzo } from '../componentes/Lienzo'
import { irAlEstudioActivo, irAlSelector, irAlasFlashcards } from '../hooks/useRuta'
import { colorDeMateria, type Cuaderno, type DocumentoCuaderno } from '../tipos'

type Props = {
  cuaderno: Cuaderno
  barraNube?: ReactNode
  onActividad: (id: string, numIdeas: number) => void
}

export function VistaCuaderno({ cuaderno, barraNube, onActividad }: Props) {
  const [documento, setDocumento] = useState<DocumentoCuaderno | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El lienzo se monta solo cuando el documento ya está en memoria, para poder
  // pasar los nodos y el viewport como estado inicial en lugar de inyectarlos
  // después (que provocaría un salto visible de la vista).
  useEffect(() => {
    let activo = true
    setDocumento(null)
    setError(null)

    cargarDocumento(cuaderno.id)
      .then((cargado) => {
        if (activo) setDocumento(cargado)
      })
      .catch((causa) => {
        console.error('No se pudo cargar el cuaderno', causa)
        if (activo) setError('No se pudo cargar este cuaderno.')
      })

    return () => {
      activo = false
    }
  }, [cuaderno.id])

  const guardar = useCallback(
    (nuevo: DocumentoCuaderno) => guardarDocumento(cuaderno.id, nuevo),
    [cuaderno.id],
  )

  const alGuardado = useCallback(
    (nuevo: DocumentoCuaderno) => {
      // Los post-its no cuentan como ideas: son notas sueltas, no conceptos de
      // la estructura del mapa. Si contaran, el número de la tarjeta dejaría de
      // decir cuántas ideas hay realmente conectadas.
      onActividad(cuaderno.id, nuevo.nodes.filter((nodo) => nodo.type === 'texto').length)
    },
    [cuaderno.id, onActividad],
  )

  return (
    <div className="vista-cuaderno">
      <header className="barra-superior">
        <button type="button" className="boton-volver" onClick={irAlSelector}>
          {/* SVG en lugar de una flecha tipográfica: el glifo '←' no existe en
              todas las fuentes y se veía como un cuadro vacío. */}
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
          Cuadernos
        </button>
        {/*
          El nombre lleva el color de la materia: es el único rastro del color
          dentro de la vista, y basta para saber dónde estás sin leer. Con el
          neutro (una materia sin color) queda en la tinta de siempre.
        */}
        <h1
          className="titulo-cuaderno"
          style={{ '--materia-texto': colorDeMateria(cuaderno).texto } as CSSProperties}
        >
          {cuaderno.nombre}
        </h1>
        <div className="espaciador" />
        {barraNube}
      </header>

      {/* Anclada aquí, y no flotando sobre el lienzo: actúa sobre el cuadro
          seleccionado o sobre el texto que se esté escribiendo. */}
      <BarraFormato />

      {error ? (
        <p className="vacio">{error}</p>
      ) : documento ? (
        // La 'key' fuerza a recrear el lienzo al cambiar de materia: sin ella,
        // React reutilizaría el estado del cuaderno anterior.
        <ReactFlowProvider key={cuaderno.id}>
          <Lienzo
            documentoInicial={documento}
            guardar={guardar}
            onGuardado={alGuardado}
            etiqueta={`Mapa conceptual de ${cuaderno.nombre}`}
            accionesExtra={
              <>
                <button
                  type="button"
                  className="boton-flashcards"
                  title="Repasar esta materia con flashcards"
                  onClick={() => irAlasFlashcards(cuaderno.id)}
                >
                  Flashcards
                </button>
                <button
                  type="button"
                  className="boton-estudio"
                  title="Apuntes por clase de esta materia"
                  onClick={() => irAlEstudioActivo(cuaderno.id)}
                >
                  Estudio Activo
                </button>
              </>
            }
          />
        </ReactFlowProvider>
      ) : (
        <p className="vacio">Abriendo el lienzo…</p>
      )}
    </div>
  )
}
