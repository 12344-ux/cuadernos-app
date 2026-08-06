import { EditorContent, useEditor } from '@tiptap/react'
import { useCallback, useEffect, useRef } from 'react'
import { estaEnLaBarra, useRegistrarEditor } from '../formato/contexto'
import { extensionesDeTexto } from '../texto/extensiones'
import { useImagenes } from '../texto/useImagenes'

type PropsEditorNodo = {
  contenidoInicial: string
  onCambiar: (html: string) => void
  onTerminar: () => void
  /**
   * Los cuadros del lienzo entran en edición al hacer doble clic y quieren el
   * cursor puesto. Los campos de una flashcard están siempre en modo edición, y si
   * cada uno reclamara el foco al montarse se lo robarían entre ellos.
   */
  autoenfocar?: boolean
  /** En un formulario de tarjeta, salir del campo no debe cerrar nada. */
  cerrarAlPerderFoco?: boolean
  placeholder?: string
  /**
   * Permite pegar e insertar imágenes. Se activa en el lienzo, donde pegar una
   * captura es parte del trabajo, y se deja fuera de las flashcards, cuyas caras
   * están pensadas para texto corto.
   */
  admitirImagenes?: boolean
}

/**
 * Editor de texto enriquecido de un cuadro del lienzo.
 *
 * Este componente se monta solo mientras se está editando, y por eso vive aparte:
 * es lo que garantiza que haya como máximo un EditorView de ProseMirror por cuadro
 * en edición. Uno por cuadro echaría por tierra el objetivo de sostener miles de
 * ideas en un mismo lienzo; los cuadros en reposo se dibujan como HTML estático.
 *
 * Los controles de formato no están aquí: el editor se anuncia al registro de
 * formato (ver formato/contexto.tsx) y sobre él actúa la barra anclada arriba.
 */
export function EditorNodo({
  contenidoInicial,
  onCambiar,
  onTerminar,
  autoenfocar = true,
  cerrarAlPerderFoco = true,
  placeholder = 'Escribe tu idea…',
  admitirImagenes = false,
}: PropsEditorNodo) {
  // Espejos de las funciones: las opciones del editor se fijan al crearlo, así que
  // leerlas de una referencia evita quedarse con una versión antigua.
  const onCambiarRef = useRef(onCambiar)
  const onTerminarRef = useRef(onTerminar)

  useEffect(() => {
    onCambiarRef.current = onCambiar
    onTerminarRef.current = onTerminar
  }, [onCambiar, onTerminar])

  const imagenes = useImagenes({
    admitir: admitirImagenes,
    // Al volver del diálogo de archivos hay que decidir si el cuadro se cierra.
    alVolverDelDialogo: () => comprobarFocoRef.current(),
  })

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
      ...imagenes.manejadores,
    },
    onUpdate: ({ editor: instancia }) => {
      // Un editor vacío devuelve '<p></p>'. Se guarda cadena vacía para no ensuciar
      // el JSON que se sube con párrafos sin contenido.
      onCambiarRef.current(instancia.isEmpty ? '' : instancia.getHTML())
    },
    // El cierre por pérdida de foco no se decide aquí: ver comprobarFoco.
    ...(cerrarAlPerderFoco ? { onBlur: () => comprobarFocoRef.current() } : {}),
  })

  imagenes.vincular(editor)

  /**
   * Decide si la edición debe cerrarse, ya asentado el foco.
   *
   * No se puede comprobar en el momento del 'blur'. Al pulsar un control de la barra
   * de formato el foco sale del editor y vuelve, y 'editor.chain().focus()' no
   * enfoca en el acto: Tiptap lo programa en un requestAnimationFrame. Comprobándolo
   * antes de ese fotograma, elegir una tipografía cerraba el cuadro.
   *
   * Se esperan dos fotogramas y entonces se mira dónde está el foco de verdad. Si
   * volvió al editor, o se quedó en la barra de formato, no se cierra nada.
   */
  const comprobarFoco = useCallback(() => {
    if (!cerrarAlPerderFoco) return

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (imagenes.pausado.current) return
        if (!editor || editor.isDestroyed || editor.isFocused) return
        if (estaEnLaBarra(document.activeElement)) return
        onTerminarRef.current()
      }),
    )
  }, [editor, cerrarAlPerderFoco, imagenes.pausado])

  // El editor se crea antes de que exista comprobarFoco, así que su onBlur la llama
  // a través de una referencia.
  const comprobarFocoRef = useRef(comprobarFoco)
  useEffect(() => {
    comprobarFocoRef.current = comprobarFoco
  }, [comprobarFoco])

  /*
   * Cierre al pulsar fuera, que es lo que de verdad cierra la edición.
   *
   * El 'blur' no basta: React Flow cancela el pointerdown del fondo del lienzo para
   * gestionar el paneo, así que al pulsar en el fondo con un desplegable de la barra
   * abierto el cuadro se quedaba en edición para siempre. Se escucha en fase de
   * captura para enterarse antes de esa cancelación.
   */
  useEffect(() => {
    if (!cerrarAlPerderFoco || !editor) return

    const alPulsarFuera = (evento: PointerEvent) => {
      if (imagenes.pausado.current) return
      const destino = evento.target
      if (!(destino instanceof Node)) return
      // Dentro del propio texto o de la barra de formato no es "fuera".
      if (editor.view.dom.contains(destino)) return
      if (estaEnLaBarra(destino)) return
      onTerminarRef.current()
    }

    document.addEventListener('pointerdown', alPulsarFuera, true)
    return () => document.removeEventListener('pointerdown', alPulsarFuera, true)
  }, [editor, cerrarAlPerderFoco, imagenes.pausado])

  // Se anuncia a la barra de formato de arriba, que es quien tiene los controles.
  useRegistrarEditor(editor, admitirImagenes ? imagenes.pedirImagen : undefined)

  return (
    <>
      <EditorContent editor={editor} className="envoltorio-editor" />
      {imagenes.elementos}
    </>
  )
}
