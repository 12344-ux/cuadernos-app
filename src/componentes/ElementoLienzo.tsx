import { NodeResizer, NodeToolbar, Position, useReactFlow } from '@xyflow/react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { htmlEstaVacio, sanearHtml } from '../texto/saneador'
import { PALETA, type DatosNodo, type NodoCuaderno, type TipoElemento } from '../tipos'
import { BarraElemento } from './BarraElemento'
import { EditorNodoDiferido } from './editorDiferido'

/** Un post-it tiende a ser más cuadrado; un cuadro, más ancho que alto. */
const MEDIDAS_MINIMAS: Record<TipoElemento, { ancho: number; alto: number }> = {
  texto: { ancho: 140, alto: 70 },
  postit: { ancho: 120, alto: 100 },
}

type PropsElementoLienzo = {
  id: string
  data: DatosNodo
  selected: boolean
  variante: TipoElemento
}

/**
 * Cuerpo compartido por los cuadros y los post-its: barra del elemento, vista en
 * reposo y edición. Lo único que los diferencia es el aspecto y, en el caso del
 * cuadro, los puntos de conexión, que añade cada envoltorio.
 */
export function ElementoLienzo({ id, data, selected, variante }: PropsElementoLienzo) {
  const { updateNodeData, deleteElements } = useReactFlow<NodoCuaderno>()
  const [editando, setEditando] = useState(false)
  const colores = PALETA[data.color] ?? PALETA.pizarra
  const minimas = MEDIDAS_MINIMAS[variante]
  const esPostit = variante === 'postit'

  // Un elemento recién creado entra directo en modo edición: crear y luego tener
  // que hacer doble clic para escribir sería un paso de más en cada idea.
  useEffect(() => {
    if (data.autoenfocar) {
      setEditando(true)
      updateNodeData(id, { autoenfocar: false })
    }
  }, [data.autoenfocar, id, updateNodeData])

  /*
   * El contenido se sanea aquí, justo antes de inyectarlo, porque este es el
   * punto donde una etiqueta inesperada podría ejecutarse. Ya se saneó al cargar
   * el documento, pero la garantía tiene que estar donde está el riesgo.
   * Se memoriza para no repetirlo en cada render de cada cuadro visible.
   */
  const contenidoSeguro = useMemo(() => sanearHtml(data.contenido), [data.contenido])
  const sinTexto = htmlEstaVacio(contenidoSeguro)

  const clases = [
    'elemento-lienzo',
    esPostit ? 'es-postit' : 'es-cuadro',
    `fuente-${data.fuente}`,
    `tamano-${data.tamano}`,
    `alineacion-${data.alineacion}`,
    selected ? 'seleccionado' : '',
  ]
    .filter(Boolean)
    .join(' ')

  /*
   * Vista en reposo. Sirve además de contenido provisional mientras se descarga
   * el editor la primera vez: al mostrar exactamente lo mismo que ya había, el
   * cuadro no pega ningún salto.
   */
  const vistaEnReposo = (
    <div className="nodo-contenido">
      {sinTexto ? (
        <span className="nodo-vacio">Doble clic para escribir</span>
      ) : (
        <div className="texto-con-formato" dangerouslySetInnerHTML={{ __html: contenidoSeguro }} />
      )}
    </div>
  )

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={minimas.ancho}
        minHeight={minimas.alto}
        color="#6366f1"
      />

      <NodeToolbar isVisible={selected && !editando} position={Position.Top} offset={12}>
        <BarraElemento
          data={data}
          esPostit={esPostit}
          onCambiar={(cambio) => updateNodeData(id, cambio)}
          onEliminar={() => void deleteElements({ nodes: [{ id }] })}
        />
      </NodeToolbar>

      <div
        className={clases}
        style={{
          background: colores.fondo,
          borderColor: colores.borde,
          color: colores.texto,
          // La usa el CSS para dibujar la esquina doblada del post-it en el tono
          // del color elegido.
          '--tono-borde': colores.borde,
        } as React.CSSProperties}
        onDoubleClick={(evento) => {
          evento.stopPropagation()
          setEditando(true)
        }}
      >
        {editando ? (
          <Suspense fallback={vistaEnReposo}>
            <EditorNodoDiferido
              contenidoInicial={data.contenido}
              onCambiar={(html) => updateNodeData(id, { contenido: html })}
              onTerminar={() => setEditando(false)}
            />
          </Suspense>
        ) : (
          vistaEnReposo
        )}
      </div>
    </>
  )
}
