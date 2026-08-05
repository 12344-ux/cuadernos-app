import type { NodeProps } from '@xyflow/react'
import type { NodoPostit as TipoNodoPostit } from '../tipos'
import { ElementoLienzo } from './ElementoLienzo'

/**
 * Post-it: una nota pegada encima del lienzo para apuntar algo puntual.
 *
 * Se mueve, se redimensiona y se le cambia color, fuente, tamaño y alineación
 * igual que a un cuadro, pero **no renderiza ningún Handle**. Esa ausencia es lo
 * que lo mantiene fuera de la estructura del mapa: sin puntos de conexión no hay
 * nada a lo que engancharse, así que ni con ConnectionMode.Loose se puede
 * conectar. El lienzo lo refuerza con isValidConnection y el almacenamiento
 * descarta cualquier flecha que llegue apuntando a un post-it.
 */
export function NodoPostit({ id, data, selected }: NodeProps<TipoNodoPostit>) {
  return <ElementoLienzo id={id} data={data} selected={Boolean(selected)} variante="postit" />
}
