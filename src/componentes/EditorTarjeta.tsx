import { Suspense, useState } from 'react'
import { EditorNodoDiferido } from './editorDiferido'

type Props = {
  anversoInicial?: string
  reversoInicial?: string
  /** Etiqueta del botón de confirmar: cambia entre crear y editar. */
  etiquetaGuardar: string
  onGuardar: (anverso: string, reverso: string) => void
  onCancelar: () => void
}

function Campo({
  titulo,
  ayuda,
  contenidoInicial,
  autoenfocar,
  onCambiar,
}: {
  titulo: string
  ayuda: string
  contenidoInicial: string
  autoenfocar: boolean
  onCambiar: (html: string) => void
}) {
  return (
    <label className="campo-tarjeta">
      <span className="campo-tarjeta-titulo">{titulo}</span>
      <div className="campo-tarjeta-caja">
        <Suspense fallback={<p className="campo-cargando">Cargando el editor…</p>}>
          <EditorNodoDiferido
            contenidoInicial={contenidoInicial}
            onCambiar={onCambiar}
            // En un formulario, salir del campo no debe cerrar nada.
            onTerminar={() => {}}
            cerrarAlPerderFoco={false}
            autoenfocar={autoenfocar}
            placeholder={ayuda}
          />
        </Suspense>
      </div>
    </label>
  )
}

/**
 * Formulario de una tarjeta. Usa el mismo editor enriquecido que los cuadros del
 * lienzo, así que dentro de una flashcard se puede poner negrilla, cursiva,
 * subrayado y marcador seleccionando el texto.
 */
export function EditorTarjeta({
  anversoInicial = '',
  reversoInicial = '',
  etiquetaGuardar,
  onGuardar,
  onCancelar,
}: Props) {
  const [anverso, setAnverso] = useState(anversoInicial)
  const [reverso, setReverso] = useState(reversoInicial)

  return (
    <section className="editor-tarjeta">
      <Campo
        titulo="Anverso"
        ayuda="La pregunta"
        contenidoInicial={anversoInicial}
        autoenfocar
        onCambiar={setAnverso}
      />
      <Campo
        titulo="Reverso"
        ayuda="La respuesta"
        contenidoInicial={reversoInicial}
        autoenfocar={false}
        onCambiar={setReverso}
      />

      <div className="acciones-editor-tarjeta">
        <button type="button" className="boton-discreto" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-primario"
          onClick={() => onGuardar(anverso, reverso)}
        >
          {etiquetaGuardar}
        </button>
      </div>
    </section>
  )
}
