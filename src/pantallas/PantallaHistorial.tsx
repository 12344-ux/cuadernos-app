import { useMemo } from 'react'
import { historialPorDia, proximas } from '../agenda/consultas'
import type { Tarea } from '../agenda/tipos'
import { FilaTarea } from '../componentes/FilaTarea'
import { diaCompletoLegible } from '../fechas'
import { irAlSelector } from '../hooks/useRuta'

type Props = {
  tareas: Tarea[]
  onAlternar: (id: string) => void
  onEliminar: (id: string) => void
}

/**
 * Historial de la agenda, en su propia pantalla.
 *
 * Muestra lo ya completado agrupado por el día en que tocaba, y de paso lo que
 * queda programado para más adelante: al entrar a repasar lo hecho es también
 * donde uno quiere comprobar qué viene.
 *
 * Desde aquí se puede desmarcar una tarea, que vuelve a la agenda de hoy.
 */
export function PantallaHistorial({ tareas, onAlternar, onEliminar }: Props) {
  const grupos = useMemo(() => historialPorDia(tareas), [tareas])
  const pendientesFuturas = useMemo(() => proximas(tareas), [tareas])

  return (
    <main className="selector">
      <header className="barra-superior sin-borde">
        <button type="button" className="boton-volver" onClick={irAlSelector}>
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
          Inicio
        </button>
      </header>

      <div className="selector-cabecera">
        <div>
          <h1>Historial</h1>
          <p className="subtitulo">Las tareas que ya has completado, por el día en que tocaban.</p>
        </div>
      </div>

      {pendientesFuturas.length > 0 && (
        <section className="agenda" aria-label="Tareas programadas">
          <header className="agenda-cabecera">
            <h2>Más adelante</h2>
            <span className="pastilla">{pendientesFuturas.length}</span>
          </header>
          <div className="agenda-caja">
            <ul className="lista-tareas">
              {pendientesFuturas.map((tarea) => (
                <FilaTarea
                  key={tarea.id}
                  tarea={tarea}
                  modo="agenda"
                  onAlternar={() => onAlternar(tarea.id)}
                  onEliminar={() => onEliminar(tarea.id)}
                />
              ))}
            </ul>
          </div>
        </section>
      )}

      {grupos.length === 0 ? (
        <p className="vacio">Todavía no has completado ninguna tarea.</p>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.fecha} className="agenda" aria-label={`Tareas del ${grupo.fecha}`}>
            <header className="agenda-cabecera">
              <h2 className="agenda-dia">{diaCompletoLegible(grupo.fecha)}</h2>
            </header>
            <div className="agenda-caja">
              <ul className="lista-tareas">
                {grupo.tareas.map((tarea) => (
                  <FilaTarea
                    key={tarea.id}
                    tarea={tarea}
                    modo="historial"
                    onAlternar={() => onAlternar(tarea.id)}
                    onEliminar={() => onEliminar(tarea.id)}
                  />
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
    </main>
  )
}
