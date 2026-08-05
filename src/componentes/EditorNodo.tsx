import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { extensionesDeTexto } from '../texto/extensiones'
import { BarraFormatoTexto } from './BarraFormatoTexto'

type PropsEditorNodo = {
  contenidoInicial: string
  onCambiar: (html: string) => void
  onTerminar: () => void
  /**
   * Los cuadros del lienzo entran en edición al hacer doble clic y quieren el
   * cursor puesto. Los campos de una flashcard están siempre en modo edición, y
   * si cada uno reclamara el foco al montarse se lo robarían entre ellos.
   */
  autoenfocar?: boolean
  /** En un formulario de tarjeta, salir del campo no debe cerrar nada. */
  cerrarAlPerderFoco?: boolean
  placeholder?: string
}

/**
 * Editor de texto enriquecido de un cuadro.
 *
 * Este componente se monta solo mientras se está editando, y por eso vive
 * aparte: es lo que garantiza que haya como máximo una instancia de Tiptap viva
 * en toda la aplicación. Un editor por cuadro sería un EditorView de ProseMirror
 * por cuadro, y echaría por tierra el objetivo de sostener miles de ideas en un
 * mismo lienzo. Los cuadros en reposo se dibujan como HTML estático.
 */
export function EditorNodo({
  contenidoInicial,
  onCambiar,
  onTerminar,
  autoenfocar = true,
  cerrarAlPerderFoco = true,
  placeholder = 'Escribe tu idea…',
}: PropsEditorNodo) {
  // Espejos de las funciones: las opciones del editor se fijan al crearlo, así
  // que leerlas de una referencia evita quedarse con una versión antigua.
  const onCambiarRef = useRef(onCambiar)
  const onTerminarRef = useRef(onTerminar)

  useEffect(() => {
    onCambiarRef.current = onCambiar
    onTerminarRef.current = onTerminar
  }, [onCambiar, onTerminar])

  const editor = useEditor({
    extensions: extensionesDeTexto(placeholder),
    content: contenidoInicial,
    autofocus: autoenfocar ? 'end' : false,
    editorProps: {
      attributes: {
        // 'nodrag' evita que arrastre el cuadro al seleccionar texto y 'nowheel'
        // deja desplazar el contenido sin que la rueda haga zoom al lienzo.
        class: 'nodo-editor nodrag nowheel',
      },
      handleKeyDown: (_vista, evento) => {
        // Escape cierra la edición; Enter sigue haciendo párrafo nuevo.
        if (evento.key === 'Escape') {
          onTerminarRef.current()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: instancia }) => {
      // Un editor vacío devuelve '<p></p>'. Se guarda cadena vacía para no
      // ensuciar el JSON que se sube con párrafos sin contenido.
      onCambiarRef.current(instancia.isEmpty ? '' : instancia.getHTML())
    },
    ...(cerrarAlPerderFoco ? { onBlur: () => onTerminarRef.current() } : {}),
  })

  return (
    <>
      <EditorContent editor={editor} className="envoltorio-editor" />
      <BarraFormatoTexto editor={editor} />
    </>
  )
}
