import { useCallback } from 'react'
import { clasesVisibles } from '../clases/tipos'
import { ListaClases } from '../componentes/ListaClases'
import { useClases } from '../hooks/useClases'
import { irALaClase, irAlCuaderno, irAlEstudioActivo } from '../hooks/useRuta'
import type { Cuaderno } from '../tipos'
import { VistaClase } from './VistaClase'

type Props = {
  cuaderno: Cuaderno
  /** Clase abierta, o null para mostrar la lista. */
  idClaseAbierta: string | null
  /** Cambió la lista de clases: alta, baja, nombre o fecha. */
  onActividadClases: (idCuaderno: string) => void
  /** Cambiaron los apuntes de una clase, que van en su propio archivo. */
  onActividadApuntes: (idClase: string) => void
  /** Cambió el mapa desde la vista partida. */
  onActividadMapa: (idCuaderno: string, numIdeas: number) => void
}

/**
 * Estudio Activo de una materia.
 *
 * Sostiene la lista de clases y decide qué mostrar, igual que la sección de
 * flashcards: así la lista se carga una sola vez y no hay dos copias del mismo
 * estado entre la lista y la clase abierta.
 */
export function SeccionEstudioActivo({
  cuaderno,
  idClaseAbierta,
  onActividadClases,
  onActividadApuntes,
  onActividadMapa,
}: Props) {
  const alCambiarLista = useCallback(
    () => onActividadClases(cuaderno.id),
    [cuaderno.id, onActividadClases],
  )

  const { indice, error, crearClase, renombrarClase, cambiarFecha, eliminarClase, marcarApuntes } =
    useClases({ idCuaderno: cuaderno.id, onActividad: alCambiarLista })

  /*
   * Guardar apuntes toca dos archivos: el de los apuntes y la lista, que es donde
   * vive su fecha de modificación. De ahí que se avise dos veces.
   */
  const alGuardarApuntes = useCallback(
    (idClase: string, numNotas: number) => {
      marcarApuntes(idClase, numNotas)
      onActividadApuntes(idClase)
    },
    [marcarApuntes, onActividadApuntes],
  )

  const claseAbierta = idClaseAbierta
    ? (indice?.clases.find((clase) => clase.id === idClaseAbierta && !clase.eliminada) ?? null)
    : null

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

  if (idClaseAbierta && !claseAbierta) {
    // El enlace apunta a una clase ya eliminada o de otro dispositivo.
    return (
      <main className="selector">
        <p className="vacio">Esa clase ya no existe.</p>
        <button
          type="button"
          className="boton-primario"
          onClick={() => irAlEstudioActivo(cuaderno.id)}
        >
          Volver a las clases
        </button>
      </main>
    )
  }

  if (claseAbierta) {
    return (
      <VistaClase
        // Recrear al cambiar de clase: sin esto el lienzo reutilizaría el estado
        // de los apuntes anteriores.
        key={claseAbierta.id}
        cuaderno={cuaderno}
        clase={claseAbierta}
        onVolver={() => irAlEstudioActivo(cuaderno.id)}
        onGuardarApuntes={alGuardarApuntes}
        onActividadMapa={onActividadMapa}
      />
    )
  }

  return (
    <main className="selector">
      <header className="barra-superior sin-borde">
        <button
          type="button"
          className="boton-volver"
          onClick={() => irAlCuaderno(cuaderno.id)}
        >
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
      </header>

      <div className="selector-cabecera">
        <div>
          <span className="titulo-estudio-marca">Estudio Activo</span>
          <h1>{cuaderno.nombre}</h1>
          <p className="subtitulo">
            {clasesVisibles(indice).length === 0
              ? 'Apuntes por clase, en un lienzo libre.'
              : `${clasesVisibles(indice).length} ${
                  clasesVisibles(indice).length === 1 ? 'clase' : 'clases'
                }.`}
          </p>
        </div>
      </div>

      <ListaClases
        indice={indice}
        onAbrir={(idClase) => irALaClase(cuaderno.id, idClase)}
        onCrear={(nombre, fecha) => {
          const clase = crearClase(nombre, fecha)
          irALaClase(cuaderno.id, clase.id)
        }}
        onRenombrar={renombrarClase}
        onCambiarFecha={cambiarFecha}
        onEliminar={eliminarClase}
      />
    </main>
  )
}
