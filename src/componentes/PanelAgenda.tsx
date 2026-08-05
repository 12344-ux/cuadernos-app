import { useMemo, useState } from 'react'
import { pendientesDeHoy, tareasDeHoy } from '../agenda/consultas'
import type { Tarea } from '../agenda/tipos'
import { diaCompletoLegible, hoy } from '../fechas'
import { irALaAgenda } from '../hooks/useRuta'
import { FilaTarea } from './FilaTarea'

type Props = {
  tareas: Tarea[]
  onCrear: (texto: string, fecha?: string) => void
  onEditar: (id: string, texto: string, fecha: string) => void
  onAlternar: (id: string) => void
  onEliminar: (id: string) => void
}

/**
 * La agenda del día, en la pantalla de inicio y encima de las materias: al abrir
 * la app, lo primero que hace falta saber es qué toca hoy.
 *
 * Cuando no hay nada se queda en una sola línea para no estorbar.
 */
export function PanelAgenda({ tareas, onCrear, onEditar, onAlternar, onEliminar }: Props) {
  const [anadiendo, setAnadiendo] = useState(false)
  const [texto, setTexto] = useState('')
  const dia = hoy()
  // La fecha del formulario arranca en hoy: si no se toca, la tarea es de hoy.
  const [fecha, setFecha] = useState(dia)

  const visibles = useMemo(() => tareasDeHoy(tareas, dia), [tareas, dia])
  const pendientes = useMemo(() => pendientesDeHoy(tareas, dia), [tareas, dia])

  const confirmar = () => {
    if (!texto.trim()) {
      setAnadiendo(false)
      return
    }
    onCrear(texto, fecha)
    setTexto('')
    setFecha(dia)
    // Se queda abierto: al apuntar una tarea es habitual apuntar la siguiente.
  }

  const cerrarFormulario = () => {
    setTexto('')
    setFecha(dia)
    setAnadiendo(false)
  }

  return (
    <section className="agenda" aria-label="Agenda de hoy">
      <header className="agenda-cabecera">
        <h2>
          Hoy <span className="agenda-fecha">· {diaCompletoLegible(dia)}</span>
        </h2>
        {pendientes > 0 && (
          <span className="pastilla pastilla-aviso">
            {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
          </span>
        )}
      </header>

      <div className="agenda-caja">
        {visibles.length > 0 && (
          <ul className="lista-tareas">
            {visibles.map((tarea) => (
              <FilaTarea
                key={tarea.id}
                tarea={tarea}
                modo="agenda"
                onAlternar={() => onAlternar(tarea.id)}
                onEditar={(nuevoTexto, nuevaFecha) => onEditar(tarea.id, nuevoTexto, nuevaFecha)}
                onEliminar={() => onEliminar(tarea.id)}
              />
            ))}
          </ul>
        )}

        {anadiendo ? (
          <div className="agenda-pie">
            <div className="editor-tarea">
              <input
                className="entrada-nombre"
                placeholder="¿Qué tienes que hacer?"
                aria-label="Texto de la nueva tarea"
                value={texto}
                autoFocus
                onChange={(evento) => setTexto(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') confirmar()
                  if (evento.key === 'Escape') cerrarFormulario()
                }}
              />
              <input
                type="date"
                className="entrada-fecha"
                aria-label="Fecha de la nueva tarea"
                value={fecha}
                onChange={(evento) => setFecha(evento.target.value)}
              />
              <button type="button" className="boton-primario pequeno" onClick={confirmar}>
                Añadir
              </button>
              <button type="button" className="boton-discreto" onClick={cerrarFormulario}>
                Listo
              </button>
            </div>
          </div>
        ) : (
          <div className="agenda-pie">
            {visibles.length === 0 && <p className="agenda-vacia">Nada para hoy.</p>}
            <button type="button" className="boton-discreto" onClick={() => setAnadiendo(true)}>
              + Añadir tarea
            </button>
            <div className="espaciador" />
            <button type="button" className="boton-discreto" onClick={irALaAgenda}>
              Ver historial
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
