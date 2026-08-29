/*
 * El panel de documentos: la lista de PDF de una materia, colgada del botón.
 *
 * Dos decisiones de dibujo que son requisito y no estética:
 *
 * 1. Se pinta con createPortal en document.body y con position:fixed. Así no
 *    participa en el diseño de la barra de formato, que es flex-wrap: wrap. Si el
 *    panel fuera un hijo normal, contaría para el plegado y podría empujar la
 *    barra a otra línea, que a su vez empuja el lienzo hacia abajo: exactamente el
 *    problema que costó arreglar y que no se puede reintroducir.
 *
 * 2. La zona de arrastre es el panel, no la hoja de apuntes. Soltar un PDF sobre
 *    la hoja obligaría a tocar texto/useImagenes.tsx, que es el código compartido
 *    del pegado de imágenes. Se deja intacto a propósito.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { AVISO_ADJUNTO, pesoLegible, type Adjunto } from '../adjuntos/tipos'
import { useAdjuntos } from '../hooks/useAdjuntos'
import type { ClienteGitHub } from '../nube/github'

export type DatosAdjuntos = {
  idMateria: string
  /** La clase abierta en Estudio Activo, o null en el mapa. */
  idClase: string | null
  /** Nombre de esa clase, solo para poder titular el grupo de la lista. */
  nombreClase: string | null
  obtenerCliente: () => ClienteGitHub | null
}

type Props = DatosAdjuntos & {
  ancla: HTMLElement | null
  onCerrar: () => void
}

const ANCHO_PANEL = 340
const MARGEN = 8

export function PanelDocumentos({
  ancla,
  onCerrar,
  idMateria,
  idClase,
  nombreClase,
  obtenerCliente,
}: Props) {
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

  const deLaClase = adjuntos.filter((a) => idClase && a.idClase === idClase)
  const delResto = adjuntos.filter((a) => !idClase || a.idClase !== idClase)

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
          if (
            window.confirm(
              `¿Quitar "${adjunto.nombre}"?\n\nDejará de aparecer y no se podrá descargar. Ten en cuenta que el archivo seguirá guardado en el historial del repositorio: quitarlo no libera ese espacio.`,
            )
          ) {
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
        <strong>Documentos</strong>
        <button type="button" className="doc-cerrar" aria-label="Cerrar" onClick={onCerrar}>
          ×
        </button>
      </div>

      <input
        ref={entradaRef}
        type="file"
        // El 'accept' filtra el diálogo del sistema; 'esPdf' vuelve a comprobarlo
        // al recibir, porque al arrastrar no hay diálogo que filtre.
        accept="application/pdf,.pdf"
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
        Subir un PDF…
      </button>

      <p className="doc-pista">
        {idClase && nombreClase
          ? `Se guardará en «${nombreClase}». También puedes arrastrarlo aquí.`
          : 'Se guardará en la materia. También puedes arrastrarlo aquí.'}
      </p>

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

      {cargando && !cargado && <p className="doc-vacio">Buscando documentos…</p>}

      {cargado && adjuntos.length === 0 && !ocupado && (
        <p className="doc-vacio">Todavía no hay documentos en esta materia.</p>
      )}

      {deLaClase.length > 0 && (
        <>
          <h4 className="doc-grupo">De esta clase</h4>
          <ul className="doc-lista">{deLaClase.map(fila)}</ul>
        </>
      )}

      {delResto.length > 0 && (
        <>
          {deLaClase.length > 0 && <h4 className="doc-grupo">Del resto de la materia</h4>}
          <ul className="doc-lista">{delResto.map(fila)}</ul>
        </>
      )}

      <p className="doc-nota">
        Se descargan a tu carpeta de descargas. Máximo {pesoLegible(AVISO_ADJUNTO)} recomendado por
        archivo.
      </p>
    </div>,
    document.body,
  )
}
