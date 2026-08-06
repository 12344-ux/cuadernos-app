import type { Editor } from '@tiptap/core'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ColorId, DatosNodo, Fuente, Tamano } from '../tipos'

/**
 * Registro de quién manda ahora mismo en la barra de formato.
 *
 * Existe para que haya *una sola* barra, anclada arriba, en lugar de una barra
 * flotante por cuadro. La barra no sabe qué hay debajo: lo que se está editando
 * se anuncia aquí, y ella lee de este registro.
 *
 * Eso es lo que hace posible la pantalla dividida sin fricción. El mapa y la hoja
 * de apuntes conviven en la misma pantalla, y cada uno se anuncia al recibir el
 * foco, así que la barra de arriba actúa siempre sobre el panel en el que estás
 * trabajando sin tener que duplicarla.
 *
 * Cuidado al tocar este archivo: la barra se pinta siempre, así que ni ella ni
 * este módulo pueden importar Tiptap en tiempo de ejecución. 'Editor' entra solo
 * como tipo, y la barra se limita a llamar métodos de la instancia que recibe. Si
 * alguien añade aquí un 'import { algo } from "@tiptap/..."' sin 'type', Tiptap
 * se cuela en el fragmento inicial y se pierde la carga diferida del editor.
 */

/**
 * El cuadro del lienzo que está seleccionado, si lo hay.
 *
 * Se anuncian los tres ajustes que la barra muestra, y no el objeto 'data' entero, a
 * propósito: 'data' incluye el contenido, que cambia de identidad en cada tecla, y
 * eso volvería a registrar en cada pulsación provocando un render de todo el árbol
 * que hay bajo el proveedor, React Flow incluido.
 */
export type ElementoActivo = {
  color: ColorId
  fuente: Fuente
  tamano: Tamano
  esPostit: boolean
  onCambiar: (cambio: Partial<DatosNodo>) => void
  onEliminar: () => void
}

/** Deshacer y rehacer de quien esté activo. */
export type Historial = {
  puedeDeshacer: boolean
  puedeRehacer: boolean
  deshacer: () => void
  rehacer: () => void
}

type Registro = {
  /** Editor de texto con el foco, si se está escribiendo. */
  editor: Editor | null
  /**
   * Abre el selector de archivos del editor activo. Lo aporta quien registra el
   * editor, porque es él quien tiene el campo de archivo y sabe protegerse de que
   * abrirlo le quite el foco.
   */
  pedirImagen: (() => void) | null
  elemento: ElementoActivo | null
  /**
   * Historial del lienzo. El de un editor de texto no se registra aquí: la barra
   * usa el del propio editor cuando hay uno activo, porque escribir y deshacer
   * palabras es cosa suya.
   */
  historial: Historial | null
}

type Contexto = Registro & {
  registrar: (parcial: Partial<Registro>) => void
  /** Retira un valor solo si sigue siendo el que está puesto. */
  retirar: (clave: keyof Registro, valor: unknown) => void
}

const REGISTRO_VACIO: Registro = {
  editor: null,
  pedirImagen: null,
  elemento: null,
  historial: null,
}

/**
 * Clase de la barra de formato.
 *
 * Es parte del contrato y no solo estilo: el editor comprueba con ella si el foco
 * se fue a la barra, para no cerrar la edición al pulsar uno de sus controles.
 */
export const CLASE_BARRA_FORMATO = 'barra-formato'

/** ¿Este elemento del DOM pertenece a la barra de formato? */
export function estaEnLaBarra(nodo: unknown): boolean {
  return nodo instanceof HTMLElement && Boolean(nodo.closest(`.${CLASE_BARRA_FORMATO}`))
}

const ContextoFormato = createContext<Contexto | null>(null)

export function ProveedorFormato({ children }: { children: ReactNode }) {
  const [registro, setRegistro] = useState<Registro>(REGISTRO_VACIO)

  const registrar = useCallback((parcial: Partial<Registro>) => {
    setRegistro((previo) => {
      // Sin cambios reales no se re-renderiza: esto se llama desde efectos y
      // desde eventos de foco, que se disparan a menudo.
      const iguales = (Object.keys(parcial) as (keyof Registro)[]).every(
        (clave) => previo[clave] === parcial[clave],
      )
      return iguales ? previo : { ...previo, ...parcial }
    })
  }, [])

  /*
   * Se comprueba la identidad antes de borrar. Al pasar de un cuadro a otro, el
   * nuevo se registra antes de que el viejo se limpie (React monta antes de
   * desmontar en varios casos), y sin esta guarda el saliente borraría al
   * entrante y la barra se quedaría vacía teniendo algo seleccionado.
   */
  const retirar = useCallback((clave: keyof Registro, valor: unknown) => {
    setRegistro((previo) => (previo[clave] === valor ? { ...previo, [clave]: null } : previo))
  }, [])

  const valor = useMemo<Contexto>(
    () => ({ ...registro, registrar, retirar }),
    [registro, registrar, retirar],
  )

  return <ContextoFormato.Provider value={valor}>{children}</ContextoFormato.Provider>
}

function useContextoFormato(): Contexto {
  const contexto = useContext(ContextoFormato)
  if (!contexto) {
    throw new Error('Falta ProveedorFormato por encima de este componente')
  }
  return contexto
}

/** Lo que necesita la barra de formato. */
export function useFormato(): Registro {
  const { editor, pedirImagen, elemento, historial } = useContextoFormato()
  return { editor, pedirImagen, elemento, historial }
}

/**
 * ¿Hay un editor de texto al mando?
 *
 * La usa el lienzo para apartarse del atajo de deshacer. Sin esto, el botón de la
 * barra y Ctrl+Z hacían cosas distintas en la misma situación: el botón deshacía
 * palabras del editor activo y el atajo movimientos del lienzo por detrás.
 */
export function useHayEditorActivo(): boolean {
  return useContextoFormato().editor !== null
}

/**
 * Anuncia el editor de texto que tiene el foco.
 *
 * Se registra al enfocar y no al montar porque puede haber varios editores vivos
 * a la vez: las dos caras de una flashcard, o la hoja de apuntes junto al mapa en
 * pantalla dividida. El que manda es el que estás usando.
 */
export function useRegistrarEditor(editor: Editor | null, pedirImagen?: () => void): void {
  const { registrar, retirar } = useContextoFormato()

  // La función llega en línea desde quien monta el editor, así que se lee de una
  // referencia para no re-registrar en cada render.
  const pedirImagenRef = useRef(pedirImagen)
  useEffect(() => {
    pedirImagenRef.current = pedirImagen
  }, [pedirImagen])

  useEffect(() => {
    if (!editor) return

    const anunciar = () =>
      registrar({ editor, pedirImagen: pedirImagenRef.current ?? null })
    const olvidar = () => {
      retirar('editor', editor)
      retirar('pedirImagen', pedirImagenRef.current ?? null)
    }

    /*
     * Al perder el foco se comprueba dónde ha ido, en el fotograma siguiente.
     *
     * No se puede retirar en el acto: pulsar un control de la barra saca el foco del
     * editor, y la barra se vaciaría justo en el momento de usarla. Pero tampoco se
     * puede ignorar el 'blur', que era lo que hacía antes: la hoja de apuntes no se
     * cierra nunca, así que en pantalla partida seguía registrada mientras se
     * trabajaba en el mapa y la negrilla o el «Limpiar» de la barra se aplicaban al
     * texto del otro panel.
     */
    const alPerderFoco = () => {
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return
        // Volvió al editor, o se fue a la barra: sigue mandando este.
        if (editor.isFocused) return
        if (estaEnLaBarra(document.activeElement)) return
        olvidar()
      })
    }

    // Si nace con el foco puesto, el evento ya ha pasado cuando llegamos aquí.
    if (editor.isFocused) anunciar()

    editor.on('focus', anunciar)
    editor.on('blur', alPerderFoco)
    editor.on('destroy', olvidar)

    return () => {
      editor.off('focus', anunciar)
      editor.off('blur', alPerderFoco)
      editor.off('destroy', olvidar)
      olvidar()
    }
  }, [editor, registrar, retirar])
}

/** Anuncia el cuadro seleccionado del lienzo. */
export function useRegistrarElemento(elemento: ElementoActivo | null): void {
  const { registrar, retirar } = useContextoFormato()

  // La identidad del objeto cambia en cada render de quien lo construye, así que
  // se guarda cuál se registró para poder retirar exactamente ese.
  const registradoRef = useRef<ElementoActivo | null>(null)

  useEffect(() => {
    if (elemento) {
      registradoRef.current = elemento
      registrar({ elemento })
      return
    }

    const previo = registradoRef.current
    registradoRef.current = null
    if (previo) retirar('elemento', previo)
  }, [elemento, registrar, retirar])

  useEffect(() => {
    return () => {
      if (registradoRef.current) retirar('elemento', registradoRef.current)
    }
  }, [retirar])
}

/** Anuncia el historial del lienzo que está a la vista. */
export function useRegistrarHistorial(historial: Historial | null): void {
  const { registrar, retirar } = useContextoFormato()
  const registradoRef = useRef<Historial | null>(null)

  useEffect(() => {
    if (historial) {
      registradoRef.current = historial
      registrar({ historial })
      return
    }

    const previo = registradoRef.current
    registradoRef.current = null
    if (previo) retirar('historial', previo)
  }, [historial, registrar, retirar])

  useEffect(() => {
    return () => {
      if (registradoRef.current) retirar('historial', registradoRef.current)
    }
  }, [retirar])
}
