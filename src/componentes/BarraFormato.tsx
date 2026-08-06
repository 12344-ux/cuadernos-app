import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { CLASE_BARRA_FORMATO, useFormato, type Historial } from '../formato/contexto'
import {
  ALINEACIONES_TEXTO,
  CLAVES_COLOR,
  FUENTES,
  FUENTE_POR_DEFECTO,
  MARCADORES,
  PALETA,
  TAMANOS,
  TAMANOS_TEXTO,
  type AlineacionTexto,
  type Fuente,
  type Marcador,
  type Tamano,
  type TamanoTexto,
} from '../tipos'

const CLAVES_MARCADOR = Object.keys(MARCADORES) as Marcador[]
const CLAVES_FUENTE = Object.keys(FUENTES) as Fuente[]
const CLAVES_TAMANO_TEXTO = Object.keys(TAMANOS_TEXTO) as TamanoTexto[]
const CLAVES_ALINEACION = Object.keys(ALINEACIONES_TEXTO) as AlineacionTexto[]
const CLAVES_TAMANO_NODO = Object.keys(TAMANOS) as Tamano[]

const NIVELES = [1, 2, 3] as const

/** Anchos de las cuatro rayas del icono de alineación. */
const RAYAS = [12, 7, 12, 7]

function IconoAlinear({ alineacion }: { alineacion: AlineacionTexto }) {
  return (
    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true" focusable="false">
      {RAYAS.map((ancho, indice) => {
        const y = 1.6 + indice * 3
        // Justificado dibuja todas las rayas iguales, que es lo que hace al texto.
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

function IconoDeshacer({ rehacer = false }: { rehacer?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      focusable="false"
      style={rehacer ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M3 8a5 5 0 1 1 5 5H5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M5.4 5.1 2.7 8l2.7 2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Fuerza un repintado cuando cambia el estado del editor.
 *
 * Se suscribe a mano en lugar de usar 'useEditorState' de @tiptap/react a
 * propósito: esta barra se pinta siempre, y un import de Tiptap en tiempo de
 * ejecución arrastraría el editor entero (unos 450 kB) al fragmento inicial. Aquí
 * 'Editor' entra solo como tipo y se llaman métodos de la instancia recibida.
 */
function useRepintarConElEditor(editor: Editor | null): void {
  const [, repintar] = useState(0)

  useEffect(() => {
    if (!editor) return
    const alCambiar = () => repintar((n) => n + 1)
    // 'transaction' cubre también los cambios de selección.
    editor.on('transaction', alCambiar)
    editor.on('focus', alCambiar)
    return () => {
      editor.off('transaction', alCambiar)
      editor.off('focus', alCambiar)
    }
  }, [editor])
}

/**
 * La barra de formato de la aplicación, anclada arriba.
 *
 * Antes había dos barras flotantes: una burbuja sobre el texto seleccionado y otra
 * pegada al cuadro seleccionado. Las dos aparecían justo encima de lo que estabas
 * escribiendo y tapaban los cuadros vecinos. Ahora todo vive en un sitio fijo, como
 * en un procesador de textos: se selecciona algo y se le aplica desde arriba.
 *
 * Y es una sola barra para toda la pantalla, no una por panel. En la vista dividida
 * el mapa y la hoja de apuntes comparten esta barra: cada uno se anuncia al recibir
 * el foco (ver formato/contexto.tsx) y la barra actúa sobre el que estés usando.
 *
 * Los controles que no aplican no se esconden, se deshabilitan: una barra que
 * cambia de tamaño según dónde tengas el cursor es imposible de aprender.
 *
 * 'conElementos' dice si esta pantalla tiene lienzo, y por tanto si hay que
 * reservar la fila de ajustes del cuadro. Se reserva en la vista de la materia y
 * en la pantalla partida de Estudio Activo; en las flashcards no, porque allí no
 * hay ningún cuadro que seleccionar y la fila se quedaría apagada para siempre
 * gastando una línea de alto.
 */
export function BarraFormato({ conElementos = false }: { conElementos?: boolean }) {
  const { editor: registrado, pedirImagen, elemento, historial } = useFormato()
  useRepintarConElEditor(registrado)

  /*
   * Un editor ya destruido no se toca. La ventana es estrecha (el registro se limpia
   * en 'destroy'), pero llamar a can(), getAttributes o isActive sobre una instancia
   * destruida lanza, y aquí arriba no hay ningún límite de error que lo contenga: se
   * llevaría la aplicación entera.
   */
  const editor = registrado && !registrado.isDestroyed ? registrado : null

  const hayTexto = Boolean(editor)
  const hayElemento = Boolean(elemento)

  /*
   * Todos los controles cancelan el 'mousedown' salvo los desplegables: en un
   * <select> eso impide que se abra la lista en Chrome y en Firefox. Que el foco se
   * vaya a la barra no cierra la edición, porque el editor reconoce la clase de la
   * barra al comprobar dónde quedó el foco.
   */
  const noRobarFoco = (evento: React.MouseEvent) => evento.preventDefault()

  // Con un editor activo manda su propio historial: deshacer mientras escribes debe
  // quitar palabras, no el último cuadro que moviste.
  const deshacerActivo: Historial | null = editor
    ? {
        puedeDeshacer: editor.can().undo(),
        puedeRehacer: editor.can().redo(),
        deshacer: () => editor.chain().focus().undo().run(),
        rehacer: () => editor.chain().focus().redo().run(),
      }
    : historial

  const fuenteTexto = (editor?.getAttributes('fuenteTexto').fuente as Fuente | undefined) ?? ''
  const tamanoTexto =
    (editor?.getAttributes('tamanoTexto').tamano as TamanoTexto | undefined) ?? ''
  const nivel = editor?.isActive('heading')
    ? ((editor.getAttributes('heading').level as number | undefined) ?? 0)
    : 0
  const alinear =
    (editor?.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph').alinear as
      | AlineacionTexto
      | undefined) ?? null
  const marcador =
    CLAVES_MARCADOR.find((clave) => editor?.isActive('highlight', { color: clave })) ?? null

  return (
    <div className={`${CLASE_BARRA_FORMATO}`} role="toolbar" aria-label="Formato">
      <div className="grupo-formato">
        <button
          type="button"
          className="boton-barra boton-icono"
          title="Deshacer"
          aria-label="Deshacer"
          disabled={!deshacerActivo?.puedeDeshacer}
          onMouseDown={noRobarFoco}
          onClick={() => deshacerActivo?.deshacer()}
        >
          <IconoDeshacer />
        </button>
        <button
          type="button"
          className="boton-barra boton-icono"
          title="Rehacer"
          aria-label="Rehacer"
          disabled={!deshacerActivo?.puedeRehacer}
          onMouseDown={noRobarFoco}
          onClick={() => deshacerActivo?.rehacer()}
        >
          <IconoDeshacer rehacer />
        </button>
      </div>

      <span className="separador-barra" />

      {/* ---- Formato del texto seleccionado ---- */}
      <div className="grupo-formato">
        <select
          className={`selector-fuente fuente-${fuenteTexto || 'heredada'}`}
          value={fuenteTexto}
          disabled={!hayTexto}
          title="Tipografía"
          aria-label="Tipografía"
          onChange={(evento) => {
            if (!editor) return
            const valor = evento.target.value
            const cadena = editor.chain().focus()
            if (valor === '') cadena.quitarFuente().run()
            else cadena.ponerFuente(valor as Fuente).run()
          }}
        >
          <option value="">Tipografía</option>
          {CLAVES_FUENTE.map((clave) => (
            <option key={clave} value={clave}>
              {FUENTES[clave].nombre}
            </option>
          ))}
        </select>

        <select
          className="selector-fuente"
          value={tamanoTexto}
          disabled={!hayTexto}
          title="Tamaño del texto"
          aria-label="Tamaño del texto"
          onChange={(evento) => {
            if (!editor) return
            const valor = evento.target.value
            const cadena = editor.chain().focus()
            if (valor === '') cadena.quitarTamanoTexto().run()
            else cadena.ponerTamanoTexto(valor as TamanoTexto).run()
          }}
        >
          <option value="">Tamaño</option>
          {CLAVES_TAMANO_TEXTO.map((clave) => (
            <option key={clave} value={clave}>
              {TAMANOS_TEXTO[clave].nombre}
            </option>
          ))}
        </select>

        <select
          className="selector-fuente"
          value={String(nivel)}
          disabled={!hayTexto}
          title="Estilo del párrafo"
          aria-label="Estilo del párrafo"
          onChange={(evento) => {
            if (!editor) return
            const valorNivel = Number(evento.target.value)
            const cadena = editor.chain().focus()
            if (valorNivel === 0) cadena.setParagraph().run()
            else cadena.setHeading({ level: valorNivel as 1 | 2 | 3 }).run()
          }}
        >
          <option value="0">Texto normal</option>
          {NIVELES.map((n) => (
            <option key={n} value={String(n)}>
              Título {n}
            </option>
          ))}
        </select>
      </div>

      <span className="separador-barra" />

      <div className="grupo-formato">
        <button
          type="button"
          className={`boton-barra boton-formato${editor?.isActive('bold') ? ' activo' : ''}`}
          title="Negrilla"
          aria-label="Negrilla"
          aria-pressed={editor?.isActive('bold') ?? false}
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong>N</strong>
        </button>
        <button
          type="button"
          className={`boton-barra boton-formato${editor?.isActive('italic') ? ' activo' : ''}`}
          title="Cursiva"
          aria-label="Cursiva"
          aria-pressed={editor?.isActive('italic') ?? false}
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em>K</em>
        </button>
        <button
          type="button"
          className={`boton-barra boton-formato${editor?.isActive('underline') ? ' activo' : ''}`}
          title="Subrayado"
          aria-label="Subrayado"
          aria-pressed={editor?.isActive('underline') ?? false}
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <u>S</u>
        </button>
        <button
          type="button"
          className={`boton-barra boton-formato${editor?.isActive('strike') ? ' activo' : ''}`}
          title="Tachado"
          aria-label="Tachado"
          aria-pressed={editor?.isActive('strike') ?? false}
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <s>T</s>
        </button>
      </div>

      <span className="separador-barra" />

      {/* Resaltar: seleccionas y le das color, como en Word. */}
      <div className="grupo-formato" role="group" aria-label="Resaltar">
        {CLAVES_MARCADOR.map((clave) => (
          <button
            key={clave}
            type="button"
            className={`muestra-marcador marcador-${clave}${marcador === clave ? ' activa' : ''}`}
            title={`Resaltar: ${MARCADORES[clave].nombre}`}
            aria-label={`Resaltar ${MARCADORES[clave].nombre}`}
            aria-pressed={marcador === clave}
            disabled={!hayTexto}
            onMouseDown={noRobarFoco}
            onClick={() => editor?.chain().focus().toggleHighlight({ color: clave }).run()}
          />
        ))}
      </div>

      <span className="separador-barra" />

      <div className="grupo-formato">
        <button
          type="button"
          className={`boton-barra${editor?.isActive('bulletList') ? ' activo' : ''}`}
          title="Lista con viñetas"
          aria-label="Lista con viñetas"
          aria-pressed={editor?.isActive('bulletList') ?? false}
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          •—
        </button>
        <button
          type="button"
          className={`boton-barra${editor?.isActive('orderedList') ? ' activo' : ''}`}
          title="Lista numerada"
          aria-label="Lista numerada"
          aria-pressed={editor?.isActive('orderedList') ?? false}
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1.
        </button>
      </div>

      <span className="separador-barra" />

      <div className="grupo-formato" role="group" aria-label="Alineación">
        {CLAVES_ALINEACION.map((clave) => (
          <button
            key={clave}
            type="button"
            className={`boton-barra boton-icono${alinear === clave ? ' activo' : ''}`}
            title={ALINEACIONES_TEXTO[clave].nombre}
            aria-label={ALINEACIONES_TEXTO[clave].nombre}
            aria-pressed={alinear === clave}
            disabled={!hayTexto}
            onMouseDown={noRobarFoco}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                // Volver a pulsar la activa la quita.
                .alinearParrafo(alinear === clave ? null : clave)
                .run()
            }
          >
            <IconoAlinear alineacion={clave} />
          </button>
        ))}
      </div>

      <span className="separador-barra" />

      <div className="grupo-formato">
        <button
          type="button"
          className="boton-barra"
          title="Insertar una imagen · también puedes pegarla o arrastrarla"
          aria-label="Insertar una imagen"
          disabled={!pedirImagen}
          onMouseDown={noRobarFoco}
          onClick={() => pedirImagen?.()}
        >
          Imagen
        </button>
        <button
          type="button"
          className="boton-barra"
          title="Dejar lo seleccionado como texto normal"
          aria-label="Quitar el formato"
          disabled={!hayTexto}
          onMouseDown={noRobarFoco}
          onClick={() =>
            editor?.chain().focus().unsetAllMarks().clearNodes().alinearParrafo(null).run()
          }
        >
          Limpiar
        </button>
      </div>

      {/* ---- Ajustes del cuadro seleccionado del mapa ---- */}
      {/*
        Esta fila se reserva siempre en las pantallas que tienen lienzo, y sus
        controles se apagan cuando no hay nada seleccionado.
    
        Antes aparecía y desaparecía según hubiera cuadro seleccionado, y como la
        barra se pliega en varias líneas, cada vez que se creaba o se elegía un
        cuadro la barra crecía una línea y empujaba el lienzo hacia abajo: lo que
        estabas mirando se movía justo en el momento de ir a tocarlo. Es la misma
        razón por la que el resto de la barra apaga sus controles en lugar de
        esconderlos (ver '.barra-formato button:disabled' en el CSS); esta fila era
        la única que se salía de esa norma.
      */}
      {conElementos && (
        <>
          <span className="separador-barra separador-fuerte" />

          {/* 'inactivo' y no 'vacio': '.vacio' es el estado de "no hay materias" y
              trae su propio relleno y tamaño de letra. */}
          <div className={`grupo-formato grupo-elemento${hayElemento ? '' : ' inactivo'}`}>
            <span className="etiqueta-grupo">{elemento?.esPostit ? 'Post-it' : 'Cuadro'}</span>

            {CLAVES_COLOR.map((clave) => (
              <button
                key={clave}
                type="button"
                className={`muestra-color${elemento?.color === clave ? ' activa' : ''}`}
                style={{ background: PALETA[clave].fondo, borderColor: PALETA[clave].borde }}
                title={PALETA[clave].nombre}
                aria-label={`Color ${PALETA[clave].nombre}`}
                disabled={!elemento}
                onMouseDown={noRobarFoco}
                onClick={() => elemento?.onCambiar({ color: clave })}
              />
            ))}

            <select
              className={`selector-fuente fuente-${elemento?.fuente ?? FUENTE_POR_DEFECTO}`}
              value={elemento?.fuente ?? FUENTE_POR_DEFECTO}
              title="Tipografía de todo el cuadro"
              aria-label="Tipografía de todo el cuadro"
              disabled={!elemento}
              onChange={(evento) => elemento?.onCambiar({ fuente: evento.target.value as Fuente })}
            >
              {CLAVES_FUENTE.map((clave) => (
                <option key={clave} value={clave}>
                  {FUENTES[clave].nombre}
                </option>
              ))}
            </select>

            {CLAVES_TAMANO_NODO.map((clave) => (
              <button
                key={clave}
                type="button"
                className={`boton-barra boton-tamano es-${clave}${
                  elemento?.tamano === clave ? ' activo' : ''
                }`}
                title={`Tamaño del cuadro: ${TAMANOS[clave].nombre}`}
                aria-label={`Tamaño del cuadro ${TAMANOS[clave].nombre}`}
                aria-pressed={elemento?.tamano === clave}
                disabled={!elemento}
                onMouseDown={noRobarFoco}
                onClick={() => elemento?.onCambiar({ tamano: clave })}
              >
                {TAMANOS[clave].abreviatura}
              </button>
            ))}

            <button
              type="button"
              className="boton-barra peligro"
              title={`Eliminar este ${elemento?.esPostit ? 'post-it' : 'cuadro'}`}
              disabled={!elemento}
              onMouseDown={noRobarFoco}
              onClick={() => elemento?.onEliminar()}
            >
              Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
