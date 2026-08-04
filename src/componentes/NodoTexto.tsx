import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { PALETA, type ColorId, type NodoTexto as TipoNodoTexto } from '../tipos'

/**
 * Los cuatro puntos de conexión. Se dibuja un handle de origen y otro de
 * destino en cada lado, superpuestos: así una flecha puede salir o entrar por
 * cualquier borde sin que el usuario tenga que pensar en direcciones.
 */
const LADOS = [
  { id: 'arriba', posicion: Position.Top },
  { id: 'derecha', posicion: Position.Right },
  { id: 'abajo', posicion: Position.Bottom },
  { id: 'izquierda', posicion: Position.Left },
] as const

export function NodoTexto({ id, data, selected }: NodeProps<TipoNodoTexto>) {
  const { updateNodeData, deleteElements } = useReactFlow<TipoNodoTexto>()
  const [editando, setEditando] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const colores = PALETA[data.color] ?? PALETA.pizarra

  // Un cuadro recién creado entra directo en modo edición: crear y luego tener
  // que hacer doble clic para escribir sería un paso de más en cada idea.
  useEffect(() => {
    if (data.autoenfocar) {
      setEditando(true)
      updateNodeData(id, { autoenfocar: false })
    }
  }, [data.autoenfocar, id, updateNodeData])

  useEffect(() => {
    if (!editando) return
    const area = areaRef.current
    if (!area) return
    area.focus()
    area.setSelectionRange(area.value.length, area.value.length)
  }, [editando])

  const terminarEdicion = () => setEditando(false)

  return (
    <>
      <NodeResizer isVisible={Boolean(selected)} minWidth={140} minHeight={70} color="#6366f1" />

      <NodeToolbar isVisible={Boolean(selected) && !editando} position={Position.Top} offset={12}>
        <div className="barra-nodo">
          {(Object.keys(PALETA) as ColorId[]).map((clave) => (
            <button
              key={clave}
              type="button"
              className={`muestra-color${data.color === clave ? ' activa' : ''}`}
              style={{ background: PALETA[clave].fondo, borderColor: PALETA[clave].borde }}
              title={PALETA[clave].nombre}
              aria-label={`Color ${PALETA[clave].nombre}`}
              onClick={() => updateNodeData(id, { color: clave })}
            />
          ))}

          <span className="separador-barra" />

          <button
            type="button"
            className={`boton-barra${data.resaltado ? ' activo' : ''}`}
            title="Resaltar el texto"
            aria-pressed={data.resaltado}
            onClick={() => updateNodeData(id, { resaltado: !data.resaltado })}
          >
            Resaltar
          </button>

          <button
            type="button"
            className="boton-barra peligro"
            title="Eliminar este cuadro"
            onClick={() => void deleteElements({ nodes: [{ id }] })}
          >
            Eliminar
          </button>
        </div>
      </NodeToolbar>

      <div
        className={`nodo-texto${selected ? ' seleccionado' : ''}`}
        style={{
          background: colores.fondo,
          borderColor: colores.borde,
          color: colores.texto,
        }}
        onDoubleClick={(evento) => {
          evento.stopPropagation()
          setEditando(true)
        }}
      >
        {editando ? (
          <textarea
            ref={areaRef}
            // 'nodrag' evita que arrastre el nodo al seleccionar texto y
            // 'nowheel' deja que el textarea haga scroll sin hacer zoom al lienzo.
            className="nodo-area nodrag nowheel"
            value={data.texto}
            placeholder="Escribe tu idea…"
            onChange={(evento) => updateNodeData(id, { texto: evento.target.value })}
            onBlur={terminarEdicion}
            onKeyDown={(evento) => {
              // Escape cierra la edición; Enter salta de línea con normalidad.
              if (evento.key === 'Escape') {
                evento.preventDefault()
                terminarEdicion()
              }
            }}
          />
        ) : (
          <div className="nodo-contenido">
            {data.texto ? (
              <span className={data.resaltado ? 'resaltado' : undefined}>{data.texto}</span>
            ) : (
              <span className="nodo-vacio">Doble clic para escribir</span>
            )}
          </div>
        )}
      </div>

      {LADOS.map(({ id: idLado, posicion }) => (
        <div key={idLado}>
          <Handle type="target" id={idLado} position={posicion} className="punto-conexion" />
          <Handle type="source" id={idLado} position={posicion} className="punto-conexion" />
        </div>
      ))}
    </>
  )
}
