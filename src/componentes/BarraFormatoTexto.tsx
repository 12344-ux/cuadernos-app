import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { MARCADORES, type Marcador } from '../tipos'

const CLAVES_MARCADOR = Object.keys(MARCADORES) as Marcador[]

/**
 * Barra flotante del texto: aparece al seleccionar palabras dentro de un cuadro
 * que se está editando. Solo trae énfasis de caracteres.
 *
 * Lo que afecta al cuadro entero (color, fuente, tamaño, alineación) vive en la
 * otra barra, la de BarraElemento. La separación es lo que mantiene las dos
 * barras cortas y hace que se entienda cuál usar: aquí lo que has seleccionado,
 * allí el cuadro completo.
 */
export function BarraFormatoTexto({ editor }: { editor: Editor }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: instancia }) => ({
      negrilla: instancia.isActive('bold'),
      cursiva: instancia.isActive('italic'),
      subrayado: instancia.isActive('underline'),
      marcador:
        CLAVES_MARCADOR.find((clave) => instancia.isActive('highlight', { color: clave })) ?? null,
    }),
  })

  return (
    <BubbleMenu
      editor={editor}
      className="barra-nodo barra-texto"
      // Se cuelga del body y se posiciona con estrategia fija a propósito: el
      // lienzo de React Flow aplica un 'transform: scale' al hacer zoom, y una
      // barra dentro de ese contenedor se escalaría con él (ilegible al alejar,
      // enorme al acercar) además de descolocarse.
      appendTo={() => document.body}
      options={{ strategy: 'fixed', placement: 'top', offset: 10, flip: true, shift: true }}
      shouldShow={({ editor: instancia, from, to }) => instancia.isEditable && from !== to}
    >
      <button
        type="button"
        className={`boton-barra boton-formato${estado.negrilla ? ' activo' : ''}`}
        title="Negrilla"
        aria-label="Negrilla"
        aria-pressed={estado.negrilla}
        // Sin esto el clic quitaría el foco del editor: se cerraría la edición y
        // se perdería la selección antes de que el comando llegue a ejecutarse.
        onMouseDown={(evento) => evento.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>N</strong>
      </button>

      <button
        type="button"
        className={`boton-barra boton-formato${estado.cursiva ? ' activo' : ''}`}
        title="Cursiva"
        aria-label="Cursiva"
        aria-pressed={estado.cursiva}
        onMouseDown={(evento) => evento.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>K</em>
      </button>

      <button
        type="button"
        className={`boton-barra boton-formato${estado.subrayado ? ' activo' : ''}`}
        title="Subrayado"
        aria-label="Subrayado"
        aria-pressed={estado.subrayado}
        onMouseDown={(evento) => evento.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <u>S</u>
      </button>

      <span className="separador-barra" />

      {CLAVES_MARCADOR.map((clave) => (
        <button
          key={clave}
          type="button"
          className={`muestra-marcador marcador-${clave}${
            estado.marcador === clave ? ' activa' : ''
          }`}
          title={`Marcador: ${MARCADORES[clave].nombre}`}
          aria-label={`Marcador ${MARCADORES[clave].nombre}`}
          aria-pressed={estado.marcador === clave}
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={() => editor.chain().focus().toggleHighlight({ color: clave }).run()}
        />
      ))}

      <span className="separador-barra" />

      <button
        type="button"
        className="boton-barra"
        title="Quitar el formato de lo seleccionado"
        aria-label="Quitar el formato"
        onMouseDown={(evento) => evento.preventDefault()}
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
      >
        Limpiar
      </button>
    </BubbleMenu>
  )
}
