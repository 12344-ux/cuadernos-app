import { useState } from 'react'
import { clasesVisibles, type Clase, type IndiceClases } from '../clases/tipos'
import { hoy } from '../fechas'

type Props = {
  indice: IndiceClases
  onAbrir: (idClase: string) => void
  onCrear: (nombre: string, fecha: string) => void
  onRenombrar: (idClase: string, nombre: string) => void
  onCambiarFecha: (idClase: string, fecha: string) => void
  onEliminar: (idClase: string) => void
}

function FilaClase({
  clase,
  onAbrir,
  onRenombrar,
  onCambiarFecha,
  onEliminar,
}: {
  clase: Clase
  onAbrir: () => void
  onRenombrar: (nombre: string) => void
  onCambiarFecha: (fecha: string) => void
  onEliminar: () => void
}) {
  const [renombrando, setRenombrando] = useState(false)
  const [nombre, setNombre] = useState(clase.nombre)

  return (
    <li className="fila-clase">
      <div className="fila-clase-datos">
        {renombrando ? (
          <input
            className="entrada-nombre"
            value={nombre}
            autoFocus
            aria-label="Nombre de la clase"
            onChange={(evento) => setNombre(evento.target.value)}
            onFocus={(evento) => evento.target.select()}
            onBlur={() => {
              onRenombrar(nombre)
              setRenombrando(false)
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                onRenombrar(nombre)
                setRenombrando(false)
              }
              if (evento.key === 'Escape') {
                setNombre(clase.nombre)
                setRenombrando(false)
              }
            }}
          />
        ) : (
          <button type="button" className="nombre-clase" onClick={() => setRenombrando(true)}>
            {clase.nombre}
          </button>
        )}

        <p className="clase-detalle">
          <input
            type="date"
            className="entrada-fecha"
            value={clase.fecha}
            aria-label="Fecha de la clase"
            onChange={(evento) => onCambiarFecha(evento.target.value)}
          />
          <span>
            {clase.numNotas} {clase.numNotas === 1 ? 'nota' : 'notas'}
          </span>
        </p>
      </div>

      <div className="acciones-clase">
        <button type="button" className="boton-primario" onClick={onAbrir}>
          Abrir apuntes
        </button>
        <button
          type="button"
          className="boton-discreto peligro"
          onClick={() => {
            const aviso =
              clase.numNotas > 0
                ? `¿Eliminar «${clase.nombre}» con sus ${clase.numNotas} notas? No se puede deshacer.`
                : `¿Eliminar «${clase.nombre}»?`
            if (window.confirm(aviso)) onEliminar()
          }}
        >
          Eliminar
        </button>
      </div>
    </li>
  )
}

/** Las clases de una materia, de la más reciente a la más antigua. */
export function ListaClases({
  indice,
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
    <div className="panel-estudio">
      <header className="cabecera-mazos">
        <div>
          <h2>Clases</h2>
          <p className="cabecera-mazo-detalle">
            Un lienzo de apuntes por clase, para anotar en cualquier parte.
          </p>
        </div>
        <div className="espaciador" />
        {!creando && (
          <button type="button" className="boton-primario" onClick={() => setCreando(true)}>
            + Nueva clase
          </button>
        )}
      </header>

      {creando && (
        <div className="crear-clase">
          <input
            className="entrada-nombre"
            placeholder="Nombre, por ejemplo «Introducción a la genética»"
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
          <button type="button" className="boton-primario" onClick={confirmar}>
            Crear
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="vacio">
          Todavía no hay clases en esta materia. Crea la primera y empieza a tomar apuntes.
        </p>
      ) : (
        <ul className="lista-clases">
          {visibles.map((clase) => (
            <FilaClase
              key={clase.id}
              clase={clase}
              onAbrir={() => onAbrir(clase.id)}
              onRenombrar={(nuevo) => onRenombrar(clase.id, nuevo)}
              onCambiarFecha={(nueva) => onCambiarFecha(clase.id, nueva)}
              onEliminar={() => onEliminar(clase.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
