/*
 * El panel de archivos de una materia, colgado del botón.
 *
 * Dos decisiones de dibujo que son requisito y no estética:
 *
 * 1. Se pinta con createPortal en document.body y con position:fixed. Así no
 *    participa en el diseño de la barra de formato, que es flex-wrap: wrap. Si el
 *    panel fuera un hijo normal, contaría para el plegado y podría empujar la
 *    barra a otra línea, que a su vez empuja el lienzo hacia abajo: exactamente el
 *    problema que costó arreglar y que no se puede reintroducir.
 *
 * 2. La zona de arrastre es el panel, no la hoja de apuntes. Soltar un archivo
 *    sobre la hoja obligaría a tocar texto/useImagenes.tsx, que es el código
 *    compartido del pegado de imágenes. Se deja intacto a propósito.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { pesoLegible, type Adjunto } from '../adjuntos/tipos'
import { useAdjuntos } from '../hooks/useAdjuntos'
import type { ClienteGitHub } from '../nube/github'

export type DatosAdjuntos = {
  idMateria: string
  /** La clase abierta en Estudio Activo, o null en el mapa. */
  idClase: string | null
  obtenerCliente: () => ClienteGitHub | null
}

type Props = DatosAdjuntos & {
  ancla: HTMLElement | null
  onCerrar: () => void
}

const ANCHO_PANEL = 340
const MARGEN = 8

export function PanelDocumentos({ ancla, onCerrar, idMateria, idClase, obtenerCliente }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const entradaRef = useRef<HTMLInputElement>(null)
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  const { adjuntos, cargando, cargado, ocupado, error, cargar, subir, descargar, eliminar } =
    useAdjuntos({ idMateria, idClase, obtenerCliente })

  // Se lee el registro al abrir, no al montar la barra: así el panel no cuesta
  // ninguna petición hasta que hace falta.
  useEffect(() => {
    void cargar()
  }, [cargar])

  /*
   * La posición se calcula antes de pintar para que no se vea un salto.
   *
   * Se ancla por la derecha del botón cuando pegarlo a la izquierda desbordaría:
   * el grupo de Imagen/PDF/Limpiar está al final de la barra, así que en pantallas
   * estrechas el panel se saldría por el lado derecho.
   */
  useLayoutEffect(() => {
    if (!ancla) return
    const calcular = () => {
      const r = ancla.getBoundingClientRect()
      const left = Math.min(
        Math.max(MARGEN, r.left),
        Math.max(MARGEN, window.innerWidth - ANCHO_PANEL - MARGEN),
      )
      setPosicion({ top: r.bottom + 6, left })
    }
    calcular()
    window.addEventListener('resize', calcular)
    window.addEventListener('scroll', calcular, true)
    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('scroll', calcular, true)
    }
  }, [ancla])

  // Escape cierra, como en el editor de un cuadro.
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation()
        onCerrar()
      }
    }
    document.addEventListener('keydown', alPulsar, true)
    return () => document.removeEventListener('keydown', alPulsar, true)
  }, [onCerrar])

  /*
   * Cerrar al pulsar fuera, en fase de captura.
   *
   * En captura y no en burbuja porque el lienzo y React Flow consumen el
   * pointerdown del fondo antes de que llegue a burbujear hasta document.
   */
  useEffect(() => {
    const alPulsarFuera = (evento: PointerEvent) => {
      const destino = evento.target as Node | null
      if (!destino) return
      if (panelRef.current?.contains(destino)) return
      // El propio botón alterna el panel; si aquí también cerráramos, un clic en
      // él cerraría y volvería a abrir.
      if (ancla?.contains(destino)) return
      onCerrar()
    }
    document.addEventListener('pointerdown', alPulsarFuera, true)
    return () => document.removeEventListener('pointerdown', alPulsarFuera, true)
  }, [ancla, onCerrar])

  const alSoltar = useCallback(
    (evento: DragEvent<HTMLDivElement>) => {
      evento.preventDefault()
      setArrastrando(false)
      const archivos = [...(evento.dataTransfer?.files ?? [])]
      if (archivos.length) void subir(archivos)
    },
    [subir],
  )

  /*
   * Los de la clase abierta primero, y dentro de cada bloque los más recientes
   * arriba (el orden que ya trae 'adjuntos'). Sin encabezados: la lista es corta y
   * el orden basta para encontrar lo de hoy.
   */
  const ordenados = idClase
    ? [
        ...adjuntos.filter((a) => a.idClase === idClase),
        ...adjuntos.filter((a) => a.idClase !== idClase),
      ]
    : adjuntos

  const fila = (adjunto: Adjunto) => (
    <li key={adjunto.id} className="doc-fila">
      <button
        type="button"
        className="doc-nombre"
        title={`Descargar ${adjunto.nombre}`}
        disabled={Boolean(ocupado)}
        onClick={() => void descargar(adjunto)}
      >
        <span className="doc-titulo">{adjunto.nombre}</span>
        <span className="doc-peso">{pesoLegible(adjunto.bytes)}</span>
      </button>
      <button
        type="button"
        className="doc-quitar"
        title={`Quitar ${adjunto.nombre} de la lista`}
        aria-label={`Quitar ${adjunto.nombre}`}
        disabled={Boolean(ocupado)}
        onClick={() => {
          if (window.confirm(`¿Quitar "${adjunto.nombre}"?`)) {
            void eliminar(adjunto)
          }
        }}
      >
        ×
      </button>
    </li>
  )

  if (!posicion) return null

  return createPortal(
    <div
      ref={panelRef}
      className={`panel-documentos${arrastrando ? ' panel-documentos-soltar' : ''}`}
      style={{ top: posicion.top, left: posicion.left, width: ANCHO_PANEL }}
      role="dialog"
      aria-label="Documentos de la materia"
      onDragOver={(evento) => {
        evento.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
    >
      <div className="doc-cabecera">
        <button type="button" className="doc-cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ×
        </button>
      </div>

      {/* Sin 'accept': se admite cualquier tipo de archivo. */}
      <input
        ref={entradaRef}
        type="file"
        multiple
        hidden
        onChange={(evento) => {
          const archivos = [...(evento.target.files ?? [])]
          // Se limpia el valor para que volver a elegir el mismo archivo dispare
          // el evento otra vez.
          evento.target.value = ''
          if (archivos.length) void subir(archivos)
        }}
      />

      <button
        type="button"
        className="boton-secundario doc-subir"
        disabled={Boolean(ocupado)}
        onClick={() => entradaRef.current?.click()}
      >
        Subir archivo…
      </button>

      {ocupado && (
        <p className="doc-estado" role="status">
          {ocupado}
        </p>
      )}
      {error && (
        <p className="doc-error" role="alert">
          {error}
        </p>
      )}

      {cargando && !cargado && <p className="doc-vacio">Buscando…</p>}

      {ordenados.length > 0 && <ul className="doc-lista">{ordenados.map(fila)}</ul>}
    </div>,
    document.body,
  )
}
