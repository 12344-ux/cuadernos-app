import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  ALINEACIONES_TEXTO,
  FUENTES,
  MARCADORES,
  TAMANOS_TEXTO,
  type AlineacionTexto,
  type Fuente,
  type Marcador,
  type TamanoTexto,
} from '../tipos'

const CLAVES_MARCADOR = Object.keys(MARCADORES) as Marcador[]
const CLAVES_FUENTE = Object.keys(FUENTES) as Fuente[]
const CLAVES_TAMANO = Object.keys(TAMANOS_TEXTO) as TamanoTexto[]
const CLAVES_ALINEACION = Object.keys(ALINEACIONES_TEXTO) as AlineacionTexto[]

/** Niveles de encabezado disponibles, en el orden del desplegable. */
const NIVELES = [1, 2, 3] as const

/** Anchos de las cuatro rayas del icono de alineación. */
const RAYAS = [12, 7, 12, 7]

function IconoAlinear({ alineacion }: { alineacion: AlineacionTexto }) {
  return (
    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true" focusable="false">
      {RAYAS.map((ancho, indice) => {
        const y = 1.6 + indice * 3
        // Justificado dibuja todas las rayas a la misma anchura, que es
        // exactamente lo que hace al texto.
        const largo = alineacion === 'justificado' ? 12 : ancho
        const x =
          alineacion === 'izquierda' || alineacion === 'justificado'
            ? 1
            : alineacion === 'centro'
              ? (14 - largo) / 2
              : 13 - largo
        return (
          <line
            key={indice}
            x1={x}
            y1={y}
            x2={x + largo}
            y2={y}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

type Props = {
  editor: Editor
  /**
   * Abre el selector de archivos. Lo resuelve EditorNodo, que es quien tiene el
   * campo y quien sabe cómo evitar que abrirlo cierre la edición.
   */
  onPedirImagen?: () => void
  /**
   * Mantener la barra a la vista mientras se edita, en lugar de solo al
   * seleccionar texto.
   *
   * Se activa en el lienzo, donde hay como máximo un cuadro en edición: allí es
   * necesario, porque elegir la tipografía antes de escribir o insertar una imagen
   * no se aplican a una selección. Se deja apagado en las flashcards, cuyas dos
   * caras montan sendos editores a la vez y mostrarían dos barras superpuestas.
   */
  siempreVisible?: boolean
}

/**
 * Barra de formato del texto que se está editando.
 *
 * Aparece mientras el cuadro está en edición, con o sin nada seleccionado. Antes
 * solo salía al seleccionar palabras, y eso dejaba fuera todo lo que no se aplica
 * a una selección: elegir la tipografía antes de empezar a escribir, o insertar
 * una imagen, no tenían ningún sitio desde donde hacerse.
 *
 * Lo que sigue viviendo en la otra barra, la de BarraElemento, es lo que describe
 * al elemento como objeto del lienzo: su color de fondo y su tipografía y tamaño
 * de partida. Aquí está lo que se hace *dentro* del texto.
 */
export function BarraFormatoTexto({ editor, onPedirImagen, siempreVisible = false }: Props) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: instancia }) => ({
      negrilla: instancia.isActive('bold'),
      cursiva: instancia.isActive('italic'),
      subrayado: instancia.isActive('underline'),
      tachado: instancia.isActive('strike'),
      vinetas: instancia.isActive('bulletList'),
      numerada: instancia.isActive('orderedList'),
      marcador:
        CLAVES_MARCADOR.find((clave) => instancia.isActive('highlight', { color: clave })) ?? null,
      // Los atributos se leen de la selección: getAttributes devuelve lo que
      // está activo en el cursor, que es lo que debe mostrar el desplegable.
      fuente: (instancia.getAttributes('fuenteTexto').fuente as Fuente | undefined) ?? '',
      tamano: (instancia.getAttributes('tamanoTexto').tamano as TamanoTexto | undefined) ?? '',
      alinear:
        (instancia.getAttributes(instancia.isActive('heading') ? 'heading' : 'paragraph')
          .alinear as AlineacionTexto | undefined) ?? null,
      nivel: instancia.isActive('heading')
        ? ((instancia.getAttributes('heading').level as number | undefined) ?? 0)
        : 0,
    }),
  })

  /*
   * Los botones llevan este onMouseDown. Sin él, pulsar uno quita el foco del
   * editor: se cierra la edición (el cuadro sale al perder el foco) y la selección
   * desaparece antes de que el comando llegue a ejecutarse.
   */
  const noRobarFoco = (evento: React.MouseEvent | React.PointerEvent) => evento.preventDefault()

  /*
   * Con los desplegables no se puede hacer lo mismo: cancelar el 'mousedown' de un
   * <select> impide que se abra la lista en Chrome y en Firefox. Se deja, pues, que
   * el foco se vaya al desplegable; de que eso no cierre la edición se encarga
   * EditorNodo, que al comprobar el foco reconoce cualquier control de esta barra.
   * Por eso la clase '.barra-texto' es parte del contrato y no solo estilo.
   */

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
      shouldShow={({ editor: instancia, from, to }) =>
        instancia.isEditable && (siempreVisible || from !== to)
      }
    >
      <select
        className={`selector-fuente fuente-${estado.fuente || 'heredada'}`}
        value={estado.fuente}
        title="Tipografía del texto seleccionado"
        aria-label="Tipografía del texto seleccionado"
        onChange={(evento) => {
          const valor = evento.target.value
          const cadena = editor.chain().focus()
          if (valor === '') cadena.quitarFuente().run()
          else cadena.ponerFuente(valor as Fuente).run()
        }}
      >
        <option value="">Del cuadro</option>
        {CLAVES_FUENTE.map((clave) => (
          <option key={clave} value={clave} className={`fuente-${clave}`}>
            {FUENTES[clave].nombre}
          </option>
        ))}
      </select>

      <select
        className="selector-fuente"
        value={estado.tamano}
        title="Tamaño del texto seleccionado"
        aria-label="Tamaño del texto seleccionado"
        onChange={(evento) => {
          const valor = evento.target.value
          const cadena = editor.chain().focus()
          if (valor === '') cadena.quitarTamanoTexto().run()
          else cadena.ponerTamanoTexto(valor as TamanoTexto).run()
        }}
      >
        <option value="">Del cuadro</option>
        {CLAVES_TAMANO.map((clave) => (
          <option key={clave} value={clave}>
            {TAMANOS_TEXTO[clave].nombre}
          </option>
        ))}
      </select>

      <select
        className="selector-fuente"
        value={String(estado.nivel)}
        title="Estilo del párrafo"
        aria-label="Estilo del párrafo"
        onChange={(evento) => {
          const nivel = Number(evento.target.value)
          const cadena = editor.chain().focus()
          if (nivel === 0) cadena.setParagraph().run()
          else cadena.setHeading({ level: nivel as 1 | 2 | 3 }).run()
        }}
      >
        <option value="0">Texto normal</option>
        {NIVELES.map((nivel) => (
          <option key={nivel} value={String(nivel)}>
            Título {nivel}
          </option>
        ))}
      </select>

      <span className="separador-barra" />

      <button
        type="button"
        className={`boton-barra boton-formato${estado.negrilla ? ' activo' : ''}`}
        title="Negrilla"
        aria-label="Negrilla"
        aria-pressed={estado.negrilla}
        onMouseDown={noRobarFoco}
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
        onMouseDown={noRobarFoco}
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
        onMouseDown={noRobarFoco}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <u>S</u>
      </button>

      <button
        type="button"
        className={`boton-barra boton-formato${estado.tachado ? ' activo' : ''}`}
        title="Tachado"
        aria-label="Tachado"
        aria-pressed={estado.tachado}
        onMouseDown={noRobarFoco}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <s>T</s>
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
          onMouseDown={noRobarFoco}
          onClick={() => editor.chain().focus().toggleHighlight({ color: clave }).run()}
        />
      ))}

      <span className="separador-barra" />

      <button
        type="button"
        className={`boton-barra${estado.vinetas ? ' activo' : ''}`}
        title="Lista con viñetas"
        aria-label="Lista con viñetas"
        aria-pressed={estado.vinetas}
        onMouseDown={noRobarFoco}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •—
      </button>

      <button
        type="button"
        className={`boton-barra${estado.numerada ? ' activo' : ''}`}
        title="Lista numerada"
        aria-label="Lista numerada"
        aria-pressed={estado.numerada}
        onMouseDown={noRobarFoco}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </button>

      <span className="separador-barra" />

      {CLAVES_ALINEACION.map((clave) => (
        <button
          key={clave}
          type="button"
          className={`boton-barra boton-icono${estado.alinear === clave ? ' activo' : ''}`}
          title={ALINEACIONES_TEXTO[clave].nombre}
          aria-label={ALINEACIONES_TEXTO[clave].nombre}
          aria-pressed={estado.alinear === clave}
          onMouseDown={noRobarFoco}
          onClick={() =>
            editor
              .chain()
              .focus()
              // Volver a pulsar la alineación activa la quita, y el párrafo
              // recupera la del cuadro.
              .alinearParrafo(estado.alinear === clave ? null : clave)
              .run()
          }
        >
          <IconoAlinear alineacion={clave} />
        </button>
      ))}

      {onPedirImagen && (
        <>
          <span className="separador-barra" />

          <button
            type="button"
            className="boton-barra"
            title="Insertar una imagen · también puedes pegarla o arrastrarla"
            aria-label="Insertar una imagen"
            onMouseDown={noRobarFoco}
            onClick={onPedirImagen}
          >
            Imagen
          </button>
        </>
      )}

      <span className="separador-barra" />

      <button
        type="button"
        className="boton-barra"
        title="Dejar lo seleccionado como texto normal"
        aria-label="Quitar el formato"
        onMouseDown={noRobarFoco}
        onClick={() =>
          editor
            .chain()
            .focus()
            .unsetAllMarks()
            // Además de las marcas, se deshace el bloque: ahora que hay
            // encabezados y listas, "Limpiar" que solo quitara la negrilla y
            // dejara el título como título no cumpliría lo que promete.
            .clearNodes()
            .alinearParrafo(null)
            .run()
        }
      >
        Limpiar
      </button>
    </BubbleMenu>
  )
}
