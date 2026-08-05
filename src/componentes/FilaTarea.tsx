import { useState } from 'react'
import { estaAtrasada } from '../agenda/consultas'
import type { Tarea } from '../agenda/tipos'
import { diaDe, diaLegible } from '../fechas'

type Props = {
  tarea: Tarea
  /** En el historial interesa cuándo se completó, no si va con retraso. */
  modo: 'agenda' | 'historial'
  onAlternar: () => void
  onEditar?: (texto: string, fecha: string) => void
  onEliminar?: () => void
}

/**
 * Una tarea de la lista. Se edita en el sitio, haciendo clic en su texto, igual
 * que se renombra una materia en el selector.
 */
export function FilaTarea({ tarea, modo, onAlternar, onEditar, onEliminar }: Props) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(tarea.texto)
  const [fecha, setFecha] = useState(tarea.fecha)

  const guardar = () => {
    onEditar?.(texto, fecha)
    setEditando(false)
  }

  const cancelar = () => {
    setTexto(tarea.texto)
    setFecha(tarea.fecha)
    setEditando(false)
  }

  if (editando) {
    return (
      <li className="fila-tarea editando">
        <div className="editor-tarea">
          <input
            className="entrada-nombre"
            value={texto}
            autoFocus
            aria-label="Texto de la tarea"
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') guardar()
              if (evento.key === 'Escape') cancelar()
            }}
          />
          <input
            type="date"
            className="entrada-fecha"
            value={fecha}
            aria-label="Fecha de la tarea"
            onChange={(evento) => setFecha(evento.target.value)}
          />
          <button type="button" className="boton-primario pequeno" onClick={guardar}>
            Guardar
          </button>
          <button type="button" className="boton-discreto" onClick={cancelar}>
            Cancelar
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className={`fila-tarea${tarea.completada ? ' hecha' : ''}`}>
      <label className="marca-tarea">
        <input
          type="checkbox"
          checked={tarea.completada}
          onChange={onAlternar}
          aria-label={tarea.completada ? 'Marcar como pendiente' : 'Marcar como hecha'}
        />
        <span className="texto-tarea">{tarea.texto}</span>
      </label>

      {modo === 'agenda' && estaAtrasada(tarea) && (
        <span className="pastilla pastilla-aviso" title="Quedó pendiente de un día anterior">
          del {diaLegible(tarea.fecha)}
        </span>
      )}

      {modo === 'historial' && tarea.fechaCompletada && (
        <span className="nota-tarea">
          completada el {diaLegible(diaDe(tarea.fechaCompletada))}
        </span>
      )}

      <div className="acciones-tarea">
        {onEditar && (
          <button type="button" className="boton-discreto" onClick={() => setEditando(true)}>
            Editar
          </button>
        )}
        {onEliminar && (
          <button
            type="button"
            className="boton-discreto peligro"
            onClick={() => {
              if (window.confirm(`¿Eliminar «${tarea.texto}»?`)) onEliminar()
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </li>
  )
}
