import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodoTexto as TipoNodoTexto } from '../tipos'
import { ElementoLienzo } from './ElementoLienzo'

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

/** Cuadro del mapa conceptual: es el único elemento que admite flechas. */
export function NodoTexto({ id, data, selected }: NodeProps<TipoNodoTexto>) {
  return (
    <>
      <ElementoLienzo id={id} data={data} selected={Boolean(selected)} variante="texto" />

      {LADOS.map(({ id: idLado, posicion }) => (
        <div key={idLado}>
          <Handle type="target" id={idLado} position={posicion} className="punto-conexion" />
          <Handle type="source" id={idLado} position={posicion} className="punto-conexion" />
        </div>
      ))}
    </>
  )
}
