import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { useRegistrarEditor } from '../formato/contexto'
import { extensionesDeTexto } from '../texto/extensiones'
import { useImagenes } from '../texto/useImagenes'

type Props = {
  /** El HTML con el que se abre la hoja. No se vuelve a inyectar después. */
  contenidoInicial: string
  /** Se llama en cada tecla. Quien la recibe se encarga de espaciar el guardado. */
  onCambiar: (html: string) => void
  /** Encabezado de la hoja: la fecha de la clase, como en un cuaderno de papel. */
  encabezado?: string
  placeholder?: string
}

/**
 * La hoja de apuntes de una clase.
 *
 * Es un único editor de texto que crece hacia abajo, no un lienzo de cuadros. Esa es
 * toda la diferencia con el mapa conceptual, y es deliberada: durante una clase se
 * escribe siguiendo lo que se explica, y tener que crear y colocar un cuadro por
 * idea añadía trabajo justo cuando no hay tiempo para nada. El lienzo infinito se
 * queda donde sí aporta, que es el mapa.
 *
 * Está siempre en modo escritura. No hay doble clic para entrar, ni cierre al perder
 * el foco, ni un editor que se monta y se desmonta: se abre la clase y se escribe.
 * Eso hace que aquí no exista nada del baile de foco que necesitan los cuadros del
 * lienzo, y que pulsar cualquier control de la barra de arriba sea inofensivo.
 */
export function HojaApuntes({
  contenidoInicial,
  onCambiar,
  encabezado,
  placeholder = 'Empieza a escribir los apuntes de esta clase…',
}: Props) {
  const onCambiarRef = useRef(onCambiar)
  useEffect(() => {
    onCambiarRef.current = onCambiar
  }, [onCambiar])

  const imagenes = useImagenes({ admitir: true })

  const editor = useEditor({
    extensions: extensionesDeTexto(placeholder),
    content: contenidoInicial,
    // La hoja se abre lista para escribir: es el único sitio de la aplicación donde
    // eso es siempre lo que se quiere hacer.
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'hoja-editor' },
      ...imagenes.manejadores,
    },
    onUpdate: ({ editor: instancia }) => {
      onCambiarRef.current(instancia.isEmpty ? '' : instancia.getHTML())
    },
  })

  imagenes.vincular(editor)
  useRegistrarEditor(editor, imagenes.pedirImagen)

  return (
    <div className="hoja-apuntes">
      <div className="hoja-papel">
        {encabezado && <p className="hoja-fecha">{encabezado}</p>}
        <EditorContent editor={editor} />
        {imagenes.elementos}
      </div>
    </div>
  )
}
