import { useCallback, useEffect, useRef, useState } from 'react'
import { documentoAgendaVacio, type DocumentoAgenda, type Tarea } from '../agenda/tipos'
import { cargarAgenda, guardarAgenda } from '../almacenamiento/agenda'
import { nuevoId } from '../almacenamiento/indice'
import { hoy } from '../fechas'

type Opciones = {
  /** Avisa a la app de que hay que subir la agenda. */
  onActividad: () => void
}

/**
 * Estado de la agenda de tareas.
 *
 * Como en los mazos, cada cambio se escribe en IndexedDB al momento y avisa hacia
 * arriba; la subida a la nube la agrupa useNube con su retardo de unos segundos.
 */
export function useAgenda({ onActividad }: Opciones) {
  const [documento, setDocumento] = useState<DocumentoAgenda | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onActividadRef = useRef(onActividad)
  useEffect(() => {
    onActividadRef.current = onActividad
  }, [onActividad])

  useEffect(() => {
    let activo = true

    cargarAgenda()
      .then((cargada) => {
        if (activo) setDocumento(cargada)
      })
      .catch((causa) => {
        console.error('No se pudo cargar la agenda', causa)
        if (activo) setError('No se pudo cargar la agenda.')
      })

    return () => {
      activo = false
    }
  }, [])

  const aplicar = useCallback((cambio: (previo: DocumentoAgenda) => DocumentoAgenda) => {
    setDocumento((previo) => {
      const siguiente = cambio(previo ?? documentoAgendaVacio())
      void guardarAgenda(siguiente).catch((causa) => {
        console.error('No se pudo guardar la agenda', causa)
        setError('No se pudo guardar. Revisa el espacio del navegador.')
      })
      onActividadRef.current()
      return siguiente
    })
  }, [])

  /** Aplica un cambio a una tarea y le pone fecha de modificación. */
  const enTarea = useCallback(
    (id: string, cambio: (tarea: Tarea) => Tarea) => {
      aplicar((previo) => ({
        ...previo,
        tareas: previo.tareas.map((tarea) =>
          tarea.id === id ? { ...cambio(tarea), modificado: Date.now() } : tarea,
        ),
      }))
    },
    [aplicar],
  )

  const crearTarea = useCallback(
    (texto: string, fecha?: string) => {
      const limpio = texto.trim()
      if (!limpio) return

      const ahora = Date.now()
      const tarea: Tarea = {
        id: nuevoId(),
        texto: limpio,
        // Sin fecha, es para hoy.
        fecha: fecha || hoy(),
        completada: false,
        fechaCreacion: ahora,
        fechaCompletada: null,
        modificado: ahora,
      }
      aplicar((previo) => ({ ...previo, tareas: [...previo.tareas, tarea] }))
    },
    [aplicar],
  )

  const editarTarea = useCallback(
    (id: string, texto: string, fecha: string) => {
      const limpio = texto.trim()
      if (!limpio) return
      enTarea(id, (tarea) => ({ ...tarea, texto: limpio, fecha: fecha || tarea.fecha }))
    },
    [enTarea],
  )

  /** Marca o desmarca. Al desmarcar se olvida la fecha de completado. */
  const alternarCompletada = useCallback(
    (id: string) => {
      enTarea(id, (tarea) =>
        tarea.completada
          ? { ...tarea, completada: false, fechaCompletada: null }
          : { ...tarea, completada: true, fechaCompletada: Date.now() },
      )
    },
    [enTarea],
  )

  /** Deja una lápida en lugar de quitar la tarea, para que el borrado se propague. */
  const eliminarTarea = useCallback(
    (id: string) => {
      enTarea(id, (tarea) => ({ ...tarea, eliminada: true }))
    },
    [enTarea],
  )

  return {
    tareas: documento?.tareas ?? [],
    cargada: documento !== null,
    error,
    crearTarea,
    editarTarea,
    alternarCompletada,
    eliminarTarea,
  }
}
