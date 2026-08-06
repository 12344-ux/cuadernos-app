import { TextSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { extensionesDeTexto } from '../texto/extensiones'
import {
  CuadroDemasiadoPesado,
  ImagenDemasiadoGrande,
  cabeOtraImagen,
  esArchivoDeImagen,
  prepararImagen,
} from '../texto/imagenes'
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
  /**
   * Permite pegar e insertar imágenes. Se activa en los apuntes de una clase,
   * donde pegar una captura es parte del trabajo, y se deja fuera de las
   * flashcards, cuyas caras están pensadas para texto corto.
   */
  admitirImagenes?: boolean
  /**
   * Deja la barra de formato a la vista todo el tiempo que dura la edición.
   *
   * Lo piden los cuadros del lienzo, donde hay uno en edición como máximo. En una
   * flashcard las dos caras están en edición a la vez y se verían dos barras
   * encima de la otra, así que allí sigue apareciendo solo al seleccionar texto.
   */
  barraSiempreVisible?: boolean
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
  admitirImagenes = false,
  barraSiempreVisible = false,
}: PropsEditorNodo) {
  // Espejos de las funciones: las opciones del editor se fijan al crearlo, así
  // que leerlas de una referencia evita quedarse con una versión antigua.
  const onCambiarRef = useRef(onCambiar)
  const onTerminarRef = useRef(onTerminar)

  const entradaArchivo = useRef<HTMLInputElement | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Los manejadores del editor se fijan al crearlo, así que avisan por referencia.
  const setAvisoRef = useRef(setAviso)

  /*
   * Mientras vale true, perder el foco no cierra la edición.
   *
   * Lo necesitan los dos controles de la barra que se llevan el foco sin remedio:
   * el selector de archivos, que abre un diálogo del sistema, y los desplegables,
   * a los que no se les puede cancelar el 'mousedown' porque entonces no se abre
   * la lista. Sin esto, usar cualquiera de los dos cerraría el cuadro y la acción
   * se quedaría sin sitio donde aplicarse.
   */
  const cierrePausado = useRef(false)

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
      handlePaste: (_vista, evento) => {
        if (!admitirImagenes) return false
        const imagenes = imagenesDe(evento.clipboardData?.files)

        if (imagenes.length === 0) {
          /*
           * No hay archivos, así que Tiptap sigue con el pegado normal y copiar
           * texto con formato funciona igual. Pero si lo pegado traía imágenes
           * dentro del HTML, el nodo Imagen las descarta (son remotas o pesan
           * demasiado, ver su parseHTML) y sin este aviso desaparecerían sin más.
           */
          const html = evento.clipboardData?.getData('text/html')
          if (html && /<img\b/i.test(html)) {
            setAvisoRef.current(
              'Las imágenes de eso que pegaste no se pudieron incrustar. Copia la imagen en sí y pégala, o usa el botón Imagen.',
            )
          }
          return false
        }

        evento.preventDefault()
        void insertarImagenesRef.current(imagenes)
        return true
      },
      handleDrop: (vista, evento, _porcion, movido) => {
        // 'movido' es arrastrar algo de dentro del propio texto: eso lo gestiona
        // ProseMirror, aquí solo interesan los archivos que llegan de fuera.
        if (!admitirImagenes || movido) return false
        const arrastre = evento as DragEvent
        const imagenes = imagenesDe(arrastre.dataTransfer?.files)
        if (imagenes.length === 0) return false
        evento.preventDefault()

        // El cursor se lleva al punto donde se soltó: la inserción es asíncrona
        // (hay que reescalar antes) y sin esto la imagen aparecía donde estuviera
        // el cursor, no donde se soltó el archivo.
        const punto = vista.posAtCoords({ left: arrastre.clientX, top: arrastre.clientY })
        if (punto) {
          try {
            const seleccion = TextSelection.near(vista.state.doc.resolve(punto.pos))
            vista.dispatch(vista.state.tr.setSelection(seleccion))
          } catch {
            // Si ese punto no admite cursor, se inserta donde estuviera.
          }
        }

        void insertarImagenesRef.current(imagenes)
        return true
      },
    },
    onUpdate: ({ editor: instancia }) => {
      // Un editor vacío devuelve '<p></p>'. Se guarda cadena vacía para no
      // ensuciar el JSON que se sube con párrafos sin contenido.
      onCambiarRef.current(instancia.isEmpty ? '' : instancia.getHTML())
    },
    // El cierre por pérdida de foco no se decide aquí: ver comprobarFoco.
    ...(cerrarAlPerderFoco ? { onBlur: () => comprobarFocoRef.current() } : {}),
  })

  /**
   * Decide si la edición debe cerrarse, ya asentado el foco.
   *
   * No se puede comprobar en el momento del 'blur'. Al pulsar un control de la
   * barra, el foco sale del editor y vuelve, y 'editor.chain().focus()' no enfoca
   * en el acto: Tiptap lo programa en un requestAnimationFrame. Comprobándolo
   * antes de ese fotograma, elegir una tipografía cerraba el cuadro.
   *
   * Se esperan dos fotogramas y entonces se mira dónde está el foco de verdad. Si
   * volvió al editor, o sigue en la barra de formato, no se cierra nada.
   */
  const comprobarFoco = useCallback(() => {
    if (!cerrarAlPerderFoco) return

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cierrePausado.current) return
        if (!editor || editor.isDestroyed || editor.isFocused) return

        const activo = document.activeElement
        if (activo instanceof HTMLElement && activo.closest('.barra-texto')) return

        onTerminarRef.current()
      }),
    )
  }, [editor, cerrarAlPerderFoco])

  // El editor se crea antes de que exista comprobarFoco, así que su onBlur la
  // llama a través de una referencia.
  const comprobarFocoRef = useRef(comprobarFoco)
  useEffect(() => {
    comprobarFocoRef.current = comprobarFoco
  }, [comprobarFoco])

  /*
   * Cierre al pulsar fuera, que es lo que de verdad cierra la edición.
   *
   * El 'blur' no basta: React Flow cancela el pointerdown del fondo del lienzo
   * para gestionar el paneo, así que al pulsar en el fondo un desplegable abierto
   * de la barra no pierde el foco y el cuadro se quedaba en edición para siempre.
   * Se escucha en fase de captura para enterarse antes de esa cancelación.
   */
  useEffect(() => {
    if (!cerrarAlPerderFoco || !editor) return

    const alPulsarFuera = (evento: PointerEvent) => {
      if (cierrePausado.current) return
      const destino = evento.target
      if (!(destino instanceof Node)) return
      // Dentro del propio texto o de su barra no es "fuera".
      if (editor.view.dom.contains(destino)) return
      if (destino instanceof HTMLElement && destino.closest('.barra-texto')) return
      onTerminarRef.current()
    }

    document.addEventListener('pointerdown', alPulsarFuera, true)
    return () => document.removeEventListener('pointerdown', alPulsarFuera, true)
  }, [editor, cerrarAlPerderFoco])

  const insertarImagenes = useCallback(
    async (archivos: File[]) => {
      if (!editor) return
      setAviso(null)

      for (const archivo of archivos) {
        try {
          const datos = await prepararImagen(archivo)
          // Se comprueba en cada vuelta: el cuadro puede haberse cerrado
          // mientras se procesaba una imagen grande.
          if (editor.isDestroyed) return

          if (!cabeOtraImagen(editor.getHTML(), datos)) throw new CuadroDemasiadoPesado()

          editor.chain().focus().insertarImagen(datos, archivo.name).run()
          // Una imagen que entra bien después de una que falló no debe dejar el
          // mensaje de error en pantalla.
          setAviso(null)
        } catch (causa) {
          console.error('No se pudo insertar la imagen', causa)
          setAviso(mensajeDeError(causa))
        }
      }
    },
    [editor],
  )

  // Los manejadores de pegado se fijan al crear el editor, así que llaman a
  // través de una referencia para no quedarse con la primera versión.
  const insertarImagenesRef = useRef(insertarImagenes)
  useEffect(() => {
    insertarImagenesRef.current = insertarImagenes
  }, [insertarImagenes])

  /** Vuelve a permitir el cierre y comprueba si toca cerrar ya. */
  const reanudarCierre = useCallback(() => {
    cierrePausado.current = false
    comprobarFoco()
  }, [comprobarFoco])

  /*
   * Oyente del regreso desde el diálogo de archivos, guardado para poder quitarlo
   * al desmontar: si el cuadro se cierra mientras el diálogo está abierto, el
   * oyente sobreviviría al editor ya destruido.
   */
  const alVolverRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (alVolverRef.current) window.removeEventListener('focus', alVolverRef.current)
    }
  }, [])

  const pedirImagen = useCallback(() => {
    cierrePausado.current = true

    // Mientras el diálogo del sistema está abierto no hay foco en la página, así
    // que la pausa se suelta cuando la ventana lo recupera: cubre tanto elegir un
    // archivo como cancelar.
    const alVolver = () => {
      window.removeEventListener('focus', alVolver)
      alVolverRef.current = null
      reanudarCierre()
    }
    if (alVolverRef.current) window.removeEventListener('focus', alVolverRef.current)
    alVolverRef.current = alVolver
    window.addEventListener('focus', alVolver)

    entradaArchivo.current?.click()
  }, [reanudarCierre])

  return (
    <>
      <EditorContent editor={editor} className="envoltorio-editor" />
      {editor && (
        <BarraFormatoTexto
          editor={editor}
          onPedirImagen={admitirImagenes ? pedirImagen : undefined}
          siempreVisible={barraSiempreVisible}
        />
      )}

      {admitirImagenes && (
        <input
          ref={entradaArchivo}
          type="file"
          // El mismo conjunto que acepta el saneador. SVG queda fuera.
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(evento) => {
            const archivos = Array.from(evento.target.files ?? [])
            // Se limpia para que volver a elegir el mismo archivo dispare el evento.
            evento.target.value = ''
            if (archivos.length > 0) void insertarImagenes(archivos)
          }}
        />
      )}

      {aviso && (
        <p className="aviso-editor" role="status">
          {aviso}
        </p>
      )}
    </>
  )
}

/** Los archivos de imagen de un portapapeles o de un arrastre. */
function imagenesDe(archivos: FileList | null | undefined): File[] {
  if (!archivos || archivos.length === 0) return []
  return Array.from(archivos).filter(esArchivoDeImagen)
}

function mensajeDeError(causa: unknown): string {
  if (causa instanceof CuadroDemasiadoPesado) {
    return 'Este cuadro ya tiene demasiadas imágenes. Crea otra nota para seguir.'
  }
  if (causa instanceof ImagenDemasiadoGrande) {
    return 'Esa imagen es demasiado grande, incluso reducida.'
  }
  return 'No se pudo insertar esa imagen.'
}
