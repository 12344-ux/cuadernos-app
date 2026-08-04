import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cargarDocumento } from '../almacenamiento/documentos'
import { Lienzo } from '../componentes/Lienzo'
import { irAlSelector } from '../hooks/useRuta'
import type { Cuaderno, DocumentoCuaderno } from '../tipos'

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

  const alGuardado = useCallback(
    (numIdeas: number) => onActividad(cuaderno.id, numIdeas),
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
        <h1 className="titulo-cuaderno">{cuaderno.nombre}</h1>
        <div className="espaciador" />
        {barraNube}
      </header>

      {error ? (
        <p className="vacio">{error}</p>
      ) : documento ? (
        // La 'key' fuerza a recrear el lienzo al cambiar de materia: sin ella,
        // React reutilizaría el estado del cuaderno anterior.
        <ReactFlowProvider key={cuaderno.id}>
          <Lienzo
            idCuaderno={cuaderno.id}
            documentoInicial={documento}
            onGuardado={alGuardado}
          />
        </ReactFlowProvider>
      ) : (
        <p className="vacio">Abriendo el lienzo…</p>
      )}
    </div>
  )
}
