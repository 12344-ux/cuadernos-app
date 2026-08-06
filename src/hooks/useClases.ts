import { useCallback, useEffect, useRef, useState } from 'react'
import { cargarClases, guardarClases } from '../almacenamiento/clases'
import { nuevoId } from '../almacenamiento/indice'
import { indiceClasesVacio, type Clase, type IndiceClases } from '../clases/tipos'
import { hoy } from '../fechas'

type Opciones = {
  idCuaderno: string
  /** Avisa de que hay que subir la lista de clases de esta materia. */
  onActividad: () => void
}

/**
 * La lista de clases de una materia.
 *
 * Solo gestiona los metadatos. Los apuntes de cada clase los carga y guarda la
 * pantalla de la clase, contra su propio archivo.
 */
export function useClases({ idCuaderno, onActividad }: Opciones) {
  const [indice, setIndice] = useState<IndiceClases | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onActividadRef = useRef(onActividad)
  useEffect(() => {
    onActividadRef.current = onActividad
  }, [onActividad])

  /*
   * Espejo del índice, para poder calcular el cambio fuera del actualizador de
   * setIndice. Se escribe siempre a la vez que el estado, y no desde un efecto,
   * para que dos acciones seguidas en el mismo ciclo partan de la última.
   */
  const indiceRef = useRef<IndiceClases | null>(null)

  const fijarIndice = useCallback((siguiente: IndiceClases | null) => {
    indiceRef.current = siguiente
    setIndice(siguiente)
  }, [])

  useEffect(() => {
    let activo = true
    fijarIndice(null)
    setError(null)

    cargarClases(idCuaderno)
      .then((cargado) => {
        if (activo) fijarIndice(cargado)
      })
      .catch((causa) => {
        console.error('No se pudieron cargar las clases', causa)
        if (activo) setError('No se pudieron cargar las clases de esta materia.')
      })

    return () => {
      activo = false
    }
  }, [idCuaderno, fijarIndice])

  /**
   * Aplica un cambio a la lista, lo guarda y avisa a la nube.
   *
   * Guardar y avisar se hacen aquí y no dentro del actualizador de setIndice, que
   * es donde estaban: un actualizador tiene que ser una función pura, y React lo
   * llama dos veces a propósito en modo estricto para delatar justo esto. El
   * efecto era una escritura doble en IndexedDB y un aviso doble a la nube en cada
   * pulsación, es decir, el doble de commits en GitHub.
   */
  const aplicar = useCallback(
    (cambio: (previo: IndiceClases) => IndiceClases) => {
      const siguiente = cambio(indiceRef.current ?? indiceClasesVacio())
      fijarIndice(siguiente)

      void guardarClases(idCuaderno, siguiente).catch((causa) => {
        console.error('No se pudieron guardar las clases', causa)
        setError('No se pudo guardar. Revisa el espacio del navegador.')
      })
      onActividadRef.current()
    },
    [idCuaderno, fijarIndice],
  )

  const enClase = useCallback(
    (idClase: string, cambio: (clase: Clase) => Clase) => {
      aplicar((previo) => ({
        ...previo,
        clases: previo.clases.map((clase) =>
          clase.id === idClase ? { ...cambio(clase), modificado: Date.now() } : clase,
        ),
      }))
    },
    [aplicar],
  )

  const crearClase = useCallback(
    (nombre: string, fecha?: string): Clase => {
      const ahora = Date.now()
      const clase: Clase = {
        id: nuevoId(),
        nombre: nombre.trim() || 'Clase sin nombre',
        // Sin fecha, es de hoy.
        fecha: fecha || hoy(),
        creado: ahora,
        modificado: ahora,
        // Todavía no tiene apuntes, así que no hay nada que sincronizar de ellos.
        notasModificado: 0,
        numNotas: 0,
      }
      aplicar((previo) => ({ ...previo, clases: [...previo.clases, clase] }))
      return clase
    },
    [aplicar],
  )

  const renombrarClase = useCallback(
    (idClase: string, nombre: string) => {
      const limpio = nombre.trim()
      if (!limpio) return
      enClase(idClase, (clase) => ({ ...clase, nombre: limpio }))
    },
    [enClase],
  )

  const cambiarFecha = useCallback(
    (idClase: string, fecha: string) => {
      if (!fecha) return
      enClase(idClase, (clase) => ({ ...clase, fecha }))
    },
    [enClase],
  )

  /** Deja una lápida para que el borrado se propague a los demás dispositivos. */
  const eliminarClase = useCallback(
    (idClase: string) => {
      enClase(idClase, (clase) => ({ ...clase, eliminada: true as const }))
    },
    [enClase],
  )

  /**
   * La llama la pantalla de la clase tras guardar sus apuntes. Toca
   * 'notasModificado' y no 'modificado', porque lo que cambió es el otro archivo.
   */
  const marcarApuntes = useCallback(
    (idClase: string, numNotas: number) => {
      aplicar((previo) => ({
        ...previo,
        clases: previo.clases.map((clase) =>
          clase.id === idClase ? { ...clase, notasModificado: Date.now(), numNotas } : clase,
        ),
      }))
    },
    [aplicar],
  )

  return {
    indice,
    error,
    crearClase,
    renombrarClase,
    cambiarFecha,
    eliminarClase,
    marcarApuntes,
  }
}
