import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorProps } from '@tiptap/pm/view'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DocumentoDemasiadoPesado,
  ImagenDemasiadoGrande,
  cabeOtraImagen,
  esArchivoDeImagen,
  prepararImagen,
} from './imagenes'

/**
 * Pegar, arrastrar e insertar imágenes en un editor de texto.
 *
 * Vive aparte porque lo necesitan los dos editores de la aplicación: los cuadros
 * del mapa y la hoja de apuntes de una clase. Las reglas que aplica (reescalado,
 * topes de peso, qué formatos se aceptan) son las que evitan que un documento
 * crezca hasta reventar la sincronización con GitHub, así que interesa que haya una
 * sola copia de ellas y no dos que puedan separarse con el tiempo.
 */

type Opciones = {
  /** Si no, el hook no hace nada y los manejadores dejan pasar el pegado normal. */
  admitir: boolean
  /**
   * Se llama al volver del diálogo de archivos.
   *
   * Lo usan los cuadros del lienzo, que se cierran al perder el foco y necesitan
   * decidir en ese momento si toca cerrarse. La hoja de apuntes no lo necesita:
   * está siempre en modo escritura.
   */
  alVolverDelDialogo?: () => void
}

export type Imagenes = {
  /** Para las 'editorProps' de useEditor. */
  manejadores: Pick<EditorProps, 'handlePaste' | 'handleDrop'>
  /** Hay que darle el editor en cuanto exista. */
  vincular: (editor: Editor | null) => void
  /** Abre el selector de archivos. */
  pedirImagen: () => void
  /**
   * Mientras valga true, perder el foco no debe cerrar la edición: hay un diálogo
   * del sistema abierto y la página no tiene el foco.
   */
  pausado: React.RefObject<boolean>
  /** El campo de archivo y el aviso de error, para pintarlos dentro del editor. */
  elementos: ReactNode
}

export function useImagenes({ admitir, alVolverDelDialogo }: Opciones): Imagenes {
  const editorRef = useRef<Editor | null>(null)
  const entradaArchivo = useRef<HTMLInputElement | null>(null)
  const pausado = useRef(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const alVolverRef = useRef(alVolverDelDialogo)
  useEffect(() => {
    alVolverRef.current = alVolverDelDialogo
  }, [alVolverDelDialogo])

  const vincular = useCallback((editor: Editor | null) => {
    editorRef.current = editor
  }, [])

  const insertar = useCallback(async (archivos: File[]) => {
    const editor = editorRef.current
    if (!editor) return
    setAviso(null)

    for (const archivo of archivos) {
      try {
        const datos = await prepararImagen(archivo)
        // Se comprueba en cada vuelta: el editor puede haberse cerrado mientras se
        // procesaba una imagen grande.
        if (editor.isDestroyed) return

        if (!cabeOtraImagen(editor.getHTML(), datos)) throw new DocumentoDemasiadoPesado()

        editor.chain().focus().insertarImagen(datos, archivo.name).run()
        // Una imagen que entra bien después de una que falló no debe dejar el
        // mensaje de error en pantalla.
        setAviso(null)
      } catch (causa) {
        console.error('No se pudo insertar la imagen', causa)
        setAviso(mensajeDeError(causa))
      }
    }
  }, [])

  /*
   * Los manejadores se fijan al crear el editor, así que tienen que ser estables y
   * leer lo variable de referencias. Si cambiaran de identidad, useEditor no los
   * volvería a tomar y quedaría con la primera versión.
   */
  const manejadores = useMemo<Imagenes['manejadores']>(
    () => ({
      handlePaste: (_vista, evento) => {
        if (!admitirRef.current) return false
        const imagenes = imagenesDe(evento.clipboardData?.files)

        if (imagenes.length === 0) {
          /*
           * No hay archivos, así que el editor sigue con el pegado normal y copiar
           * texto con formato funciona igual. Pero si lo pegado traía imágenes
           * dentro del HTML, el nodo Imagen las descarta (son remotas o pesan
           * demasiado, ver su parseHTML) y sin este aviso desaparecerían sin más.
           */
          const html = evento.clipboardData?.getData('text/html')
          if (html && /<img\b/i.test(html)) {
            setAviso(
              'Las imágenes de eso que pegaste no se pudieron incrustar. Copia la imagen en sí y pégala, o usa el botón Imagen.',
            )
          }
          return false
        }

        evento.preventDefault()
        void insertar(imagenes)
        return true
      },

      handleDrop: (vista, evento, _porcion, movido) => {
        // 'movido' es arrastrar algo de dentro del propio texto: eso lo gestiona
        // ProseMirror, aquí solo interesan los archivos que llegan de fuera.
        if (!admitirRef.current || movido) return false
        const arrastre = evento as DragEvent
        const imagenes = imagenesDe(arrastre.dataTransfer?.files)
        if (imagenes.length === 0) return false
        evento.preventDefault()

        // El cursor se lleva al punto donde se soltó: la inserción es asíncrona (hay
        // que reescalar antes) y sin esto la imagen aparecería donde estuviera el
        // cursor, no donde se soltó el archivo.
        const punto = vista.posAtCoords({ left: arrastre.clientX, top: arrastre.clientY })
        if (punto) {
          try {
            const seleccion = TextSelection.near(vista.state.doc.resolve(punto.pos))
            vista.dispatch(vista.state.tr.setSelection(seleccion))
          } catch {
            // Si ese punto no admite cursor, se inserta donde estuviera.
          }
        }

        void insertar(imagenes)
        return true
      },
    }),
    [insertar],
  )

  const admitirRef = useRef(admitir)
  useEffect(() => {
    admitirRef.current = admitir
  }, [admitir])

  /*
   * Oyente del regreso desde el diálogo de archivos, guardado para poder quitarlo al
   * desmontar: si el editor se cierra mientras el diálogo está abierto, el oyente
   * sobreviviría al editor ya destruido.
   */
  const oyenteRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (oyenteRef.current) window.removeEventListener('focus', oyenteRef.current)
    }
  }, [])

  const pedirImagen = useCallback(() => {
    pausado.current = true

    // Mientras el diálogo del sistema está abierto la página no tiene el foco, así
    // que la pausa se suelta cuando lo recupera: cubre tanto elegir un archivo como
    // cancelar.
    const alVolver = () => {
      window.removeEventListener('focus', alVolver)
      oyenteRef.current = null
      pausado.current = false
      alVolverRef.current?.()
    }
    if (oyenteRef.current) window.removeEventListener('focus', oyenteRef.current)
    oyenteRef.current = alVolver
    window.addEventListener('focus', alVolver)

    entradaArchivo.current?.click()
  }, [])

  const elementos = (
    <>
      {admitir && (
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
            if (archivos.length > 0) void insertar(archivos)
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

  return { manejadores, vincular, pedirImagen, pausado, elementos }
}

/** Los archivos de imagen de un portapapeles o de un arrastre. */
function imagenesDe(archivos: FileList | null | undefined): File[] {
  if (!archivos || archivos.length === 0) return []
  return Array.from(archivos).filter(esArchivoDeImagen)
}

function mensajeDeError(causa: unknown): string {
  if (causa instanceof DocumentoDemasiadoPesado) {
    return 'Ya hay demasiadas imágenes aquí. Sigue en otra clase para no hacer el archivo enorme.'
  }
  if (causa instanceof ImagenDemasiadoGrande) {
    return 'Esa imagen es demasiado grande, incluso reducida.'
  }
  return 'No se pudo insertar esa imagen.'
}
