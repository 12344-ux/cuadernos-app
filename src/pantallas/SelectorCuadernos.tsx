import { useMemo, useState, type ReactNode } from 'react'
import { TarjetaCuaderno } from '../componentes/TarjetaCuaderno'
import type { Cuaderno } from '../tipos'

type Props = {
  cuadernos: Cuaderno[]
  barraNube?: ReactNode
  /** La agenda del día, que va encima de las materias. */
  agenda?: ReactNode
  onAbrir: (id: string) => void
  onCrear: (nombre: string) => void
  onRenombrar: (id: string, nombre: string) => void
  onEliminar: (id: string) => void
  onAlternarArchivado: (id: string) => void
}

export function SelectorCuadernos({
  cuadernos,
  barraNube,
  agenda,
  onAbrir,
  onCrear,
  onRenombrar,
  onEliminar,
  onAlternarArchivado,
}: Props) {
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const [verArchivadas, setVerArchivadas] = useState(false)

  const visibles = useMemo(
    () =>
      cuadernos
        .filter((c) => c.archivado === verArchivadas)
        .sort((a, b) => b.modificado - a.modificado),
    [cuadernos, verArchivadas],
  )

  const numArchivadas = useMemo(() => cuadernos.filter((c) => c.archivado).length, [cuadernos])

  const confirmarCreacion = () => {
    const limpio = nombreNuevo.trim()
    if (!limpio) {
      setCreando(false)
      return
    }
    onCrear(limpio)
    setNombreNuevo('')
    setCreando(false)
  }

  return (
    <main className="selector">
      {barraNube}
      <header className="selector-cabecera">
        <div>
          <h1>Cuadernos</h1>
          <p className="subtitulo">Un lienzo infinito por materia.</p>
        </div>

        {creando ? (
          <div className="creador">
            <input
              autoFocus
              className="entrada-nombre"
              placeholder="Nombre de la materia"
              aria-label="Nombre de la nueva materia"
              value={nombreNuevo}
              onChange={(evento) => setNombreNuevo(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') confirmarCreacion()
                if (evento.key === 'Escape') {
                  setNombreNuevo('')
                  setCreando(false)
                }
              }}
            />
            <button type="button" className="boton-primario" onClick={confirmarCreacion}>
              Crear
            </button>
          </div>
        ) : (
          <button type="button" className="boton-primario" onClick={() => setCreando(true)}>
            + Crear materia
          </button>
        )}
      </header>

      {/* Encima de las materias: al abrir la app, lo primero es qué toca hoy. */}
      {agenda}

      {numArchivadas > 0 && (
        <nav className="pestanas">
          <button
            type="button"
            className={!verArchivadas ? 'activa' : undefined}
            onClick={() => setVerArchivadas(false)}
          >
            Activas
          </button>
          <button
            type="button"
            className={verArchivadas ? 'activa' : undefined}
            onClick={() => setVerArchivadas(true)}
          >
            Archivadas ({numArchivadas})
          </button>
        </nav>
      )}

      {/* Con la agenda encima, las materias necesitan su propio título. */}
      {numArchivadas === 0 && <h2 className="titulo-seccion">Materias</h2>}

      {visibles.length === 0 ? (
        <p className="vacio">
          {verArchivadas
            ? 'No hay materias archivadas.'
            : 'Todavía no tienes materias. Crea la primera para empezar.'}
        </p>
      ) : (
        <section className="rejilla">
          {visibles.map((cuaderno) => (
            <TarjetaCuaderno
              key={cuaderno.id}
              cuaderno={cuaderno}
              onAbrir={onAbrir}
              onRenombrar={onRenombrar}
              onEliminar={onEliminar}
              onAlternarArchivado={onAlternarArchivado}
            />
          ))}
        </section>
      )}
    </main>
  )
}
