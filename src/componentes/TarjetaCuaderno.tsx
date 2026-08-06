import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usarPaleta } from '../modo/visual'
import { CLAVES_COLOR, colorDeMateria, type ColorId, type Cuaderno } from '../tipos'

const formateador = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

function textoIdeas(numero: number): string {
  if (numero === 0) return 'Vacío'
  return numero === 1 ? '1 idea' : `${numero} ideas`
}

type Props = {
  cuaderno: Cuaderno
  onAbrir: (id: string) => void
  onRenombrar: (id: string, nombre: string) => void
  onCambiarColor: (id: string, color: ColorId) => void
  onEliminar: (id: string) => void
  onAlternarArchivado: (id: string) => void
}

export function TarjetaCuaderno({
  cuaderno,
  onAbrir,
  onRenombrar,
  onCambiarColor,
  onEliminar,
  onAlternarArchivado,
}: Props) {
  const [renombrando, setRenombrando] = useState(false)
  const [eligiendoColor, setEligiendoColor] = useState(false)
  const [borrador, setBorrador] = useState(cuaderno.nombre)
  const entradaRef = useRef<HTMLInputElement | null>(null)

  const paleta = usarPaleta()
  const tono = colorDeMateria(cuaderno, paleta)

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
    /*
     * El color de la materia viaja como variables CSS y no como propiedades
     * sueltas: así el CSS decide qué hace con cada tono (cuerpo, borde fino,
     * franja de arriba, divisores) y aquí solo se dice de qué color va la
     * tarjeta. Cada variable tiene su valor neutro de reserva en la hoja de
     * estilos, para las materias que todavía no tienen color.
     */
    <article
      className={`tarjeta${cuaderno.archivado ? ' archivada' : ''}`}
      style={
        {
          '--materia-fondo': tono.fondo,
          '--materia-borde': tono.borde,
          '--materia-acento': tono.acento,
        } as CSSProperties
      }
    >
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

      {/*
        La fila de colores ocupa el sitio de las acciones mientras se elige, igual
        que el campo de renombrar ocupa el del nombre: la tarjeta no cambia de
        tamaño y la rejilla no se recoloca.
      */}
      {eligiendoColor ? (
        <div className="muestras-color" role="group" aria-label="Color de la materia">
          {CLAVES_COLOR.map((clave) => (
            <button
              key={clave}
              type="button"
              className={`muestra-color${tono === paleta[clave] ? ' activa' : ''}`}
              style={{ background: paleta[clave].fondo, borderColor: paleta[clave].acento }}
              title={paleta[clave].nombre}
              aria-label={`Color ${paleta[clave].nombre}`}
              onClick={() => {
                onCambiarColor(cuaderno.id, clave)
                setEligiendoColor(false)
              }}
            />
          ))}
          {/* Salida sin elegir: entrar a mirar los colores no debe obligar a cambiarlo. */}
          <button
            type="button"
            className="boton-discreto"
            onClick={() => setEligiendoColor(false)}
          >
            Listo
          </button>
        </div>
      ) : (
        <div className="tarjeta-acciones">
          <button type="button" onClick={() => setRenombrando(true)}>
            Renombrar
          </button>
          <button type="button" onClick={() => setEligiendoColor(true)}>
            Color
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
      )}
    </article>
  )
}
