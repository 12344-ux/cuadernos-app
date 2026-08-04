import { useEffect, useRef, useState } from 'react'
import type { Cuaderno } from '../tipos'

const formateador = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

function textoIdeas(numero: number): string {
  if (numero === 0) return 'Vacío'
  return numero === 1 ? '1 idea' : `${numero} ideas`
}

type Props = {
  cuaderno: Cuaderno
  onAbrir: (id: string) => void
  onRenombrar: (id: string, nombre: string) => void
  onEliminar: (id: string) => void
  onAlternarArchivado: (id: string) => void
}

export function TarjetaCuaderno({
  cuaderno,
  onAbrir,
  onRenombrar,
  onEliminar,
  onAlternarArchivado,
}: Props) {
  const [renombrando, setRenombrando] = useState(false)
  const [borrador, setBorrador] = useState(cuaderno.nombre)
  const entradaRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (renombrando) entradaRef.current?.select()
  }, [renombrando])

  const confirmarNombre = () => {
    onRenombrar(cuaderno.id, borrador)
    setRenombrando(false)
  }

  const cancelarNombre = () => {
    setBorrador(cuaderno.nombre)
    setRenombrando(false)
  }

  return (
    <article className={`tarjeta${cuaderno.archivado ? ' archivada' : ''}`}>
      {renombrando ? (
        <input
          ref={entradaRef}
          className="entrada-nombre"
          value={borrador}
          aria-label="Nombre de la materia"
          onChange={(evento) => setBorrador(evento.target.value)}
          onBlur={confirmarNombre}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') confirmarNombre()
            if (evento.key === 'Escape') cancelarNombre()
          }}
        />
      ) : (
        <button
          type="button"
          className="tarjeta-abrir"
          onClick={() => onAbrir(cuaderno.id)}
          title={`Abrir ${cuaderno.nombre}`}
        >
          <span className="tarjeta-nombre">{cuaderno.nombre}</span>
          <span className="tarjeta-meta">
            {textoIdeas(cuaderno.numIdeas)} · {formateador.format(cuaderno.modificado)}
          </span>
        </button>
      )}

      <div className="tarjeta-acciones">
        <button type="button" onClick={() => setRenombrando(true)}>
          Renombrar
        </button>
        <button type="button" onClick={() => onAlternarArchivado(cuaderno.id)}>
          {cuaderno.archivado ? 'Desarchivar' : 'Archivar'}
        </button>
        <button
          type="button"
          className="peligro"
          onClick={() => {
            const mensaje = `¿Eliminar "${cuaderno.nombre}"? Se borrará su lienzo y no se puede deshacer.`
            if (window.confirm(mensaje)) onEliminar(cuaderno.id)
          }}
        >
          Eliminar
        </button>
      </div>
    </article>
  )
}
