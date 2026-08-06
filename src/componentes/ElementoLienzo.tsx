import { NodeResizer, NodeToolbar, Position, useReactFlow } from '@xyflow/react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
   *
   * No se sanea mientras se edita, y no es una microoptimización: escribir dispara
   * updateNodeData en cada tecla, así que el memo se invalidaba en cada tecla. Con
   * una imagen pegada eso significaba parsear, recorrer y volver a serializar
   * megabytes de base64 por pulsación, en el mismo hilo en el que se escribe, para
   * un resultado que durante la edición no se muestra. Se conserva el último valor
   * calculado para que el respaldo del Suspense siga teniendo algo que pintar.
   */
  const ultimoSeguro = useRef('')
  const contenidoSeguro = useMemo(() => {
    if (editando) return ultimoSeguro.current
    ultimoSeguro.current = sanearHtml(data.contenido)
    return ultimoSeguro.current
  }, [data.contenido, editando])

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
              // En el lienzo sí: pegar una captura en un apunte de clase es
              // parte del trabajo, y en el mapa sirve igual para un esquema o
              // una fórmula. Las caras de una flashcard siguen siendo de texto.
              admitirImagenes
              // Solo hay un cuadro en edición a la vez, así que la barra puede
              // quedarse a la vista sin solaparse con otra.
              barraSiempreVisible
            />
          </Suspense>
        ) : (
          vistaEnReposo
        )}
      </div>
    </>
  )
}
