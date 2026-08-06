import { useState } from 'react'
import { clasesVisibles, type Clase, type IndiceClases } from '../clases/tipos'
import { diaLegible, hoy } from '../fechas'

type Props = {
  indice: IndiceClases
  /** La clase abierta ahora mismo. */
  idActiva: string | null
  onAbrir: (idClase: string) => void
  onCrear: (nombre: string, fecha: string) => void
  onRenombrar: (idClase: string, nombre: string) => void
  onCambiarFecha: (idClase: string, fecha: string) => void
  onEliminar: (idClase: string) => void
}

function FilaClase({
  clase,
  activa,
  onAbrir,
  onRenombrar,
  onCambiarFecha,
  onEliminar,
}: {
  clase: Clase
  activa: boolean
  onAbrir: () => void
  onRenombrar: (nombre: string) => void
  onCambiarFecha: (fecha: string) => void
  onEliminar: () => void
}) {
  const [renombrando, setRenombrando] = useState(false)
  const [nombre, setNombre] = useState(clase.nombre)

  const confirmar = () => {
    onRenombrar(nombre)
    setRenombrando(false)
  }

  return (
    <li className={`fila-clase${activa ? ' activa' : ''}`}>
      {renombrando ? (
        <input
          className="entrada-nombre entrada-nombre-clase"
          value={nombre}
          autoFocus
          aria-label="Nombre de la clase"
          onChange={(evento) => setNombre(evento.target.value)}
          onFocus={(evento) => evento.target.select()}
          onBlur={confirmar}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') confirmar()
            if (evento.key === 'Escape') {
              setNombre(clase.nombre)
              setRenombrando(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="clase-enlace"
          // Doble clic para renombrar, como en la lista de páginas de un cuaderno.
          onDoubleClick={() => setRenombrando(true)}
          onClick={onAbrir}
        >
          <span className="clase-nombre">{clase.nombre}</span>
          <span className="clase-meta">
            {diaLegible(clase.fecha)}
            {clase.palabras > 0 && ` · ${clase.palabras} palabras`}
          </span>
        </button>
      )}

      {/* Las acciones solo salen en la clase abierta: en una lista larga, un botón
          de eliminar por fila es un accidente esperando a pasar. */}
      {activa && !renombrando && (
        <div className="acciones-clase">
          <button
            type="button"
            className="boton-discreto"
            title="Cambiar el nombre"
            onClick={() => setRenombrando(true)}
          >
            Renombrar
          </button>
          <input
            type="date"
            className="entrada-fecha"
            value={clase.fecha}
            aria-label="Fecha de la clase"
            onChange={(evento) => onCambiarFecha(evento.target.value)}
          />
          <button
            type="button"
            className="boton-discreto peligro"
            onClick={() => {
              const aviso =
                clase.palabras > 0
                  ? `¿Eliminar «${clase.nombre}» y sus apuntes (${clase.palabras} palabras)?`
                  : `¿Eliminar «${clase.nombre}»?`
              if (window.confirm(aviso)) onEliminar()
            }}
          >
            Eliminar
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Las clases de la materia, en una columna al lado de la hoja.
 *
 * Antes era una pantalla aparte: se veía la lista, se abría una clase y la lista
 * desaparecía. Tenerlas a la vez es lo que hace que saltar de una clase a otra sea
 * inmediato, que es como funciona un cuaderno de verdad.
 */
export function PanelClases({
  indice,
  idActiva,
  onAbrir,
  onCrear,
  onRenombrar,
  onCambiarFecha,
  onEliminar,
}: Props) {
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState(hoy())

  const visibles = clasesVisibles(indice)

  const confirmar = () => {
    if (!nombre.trim()) {
      setCreando(false)
      return
    }
    onCrear(nombre, fecha)
    setNombre('')
    setFecha(hoy())
    setCreando(false)
  }

  return (
    <aside className="panel-clases" aria-label="Clases de la materia">
      <header className="cabecera-clases">
        <h2>Clases</h2>
        {!creando && (
          <button
            type="button"
            className="boton-nueva-clase"
            title="Crear una clase nueva"
            onClick={() => setCreando(true)}
          >
            + Nueva
          </button>
        )}
      </header>

      {creando && (
        <div className="crear-clase">
          <input
            className="entrada-nombre"
            placeholder="Nombre de la clase"
            aria-label="Nombre de la nueva clase"
            value={nombre}
            autoFocus
            onChange={(evento) => setNombre(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') confirmar()
              if (evento.key === 'Escape') {
                setNombre('')
                setCreando(false)
              }
            }}
          />
          <input
            type="date"
            className="entrada-fecha"
            aria-label="Fecha de la nueva clase"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
          />
          <div className="acciones-crear-clase">
            <button
              type="button"
              className="boton-discreto"
              onClick={() => {
                setNombre('')
                setCreando(false)
              }}
            >
              Cancelar
            </button>
            <button type="button" className="boton-primario" onClick={confirmar}>
              Crear
            </button>
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="vacio vacio-clases">
          Todavía no hay clases. Crea la primera y empieza a tomar apuntes.
        </p>
      ) : (
        <ul className="lista-clases">
          {visibles.map((clase) => (
            <FilaClase
              key={clase.id}
              clase={clase}
              activa={clase.id === idActiva}
              onAbrir={() => onAbrir(clase.id)}
              onRenombrar={(nuevo) => onRenombrar(clase.id, nuevo)}
              onCambiarFecha={(nueva) => onCambiarFecha(clase.id, nueva)}
              onEliminar={() => onEliminar(clase.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}
