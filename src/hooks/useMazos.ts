import { useCallback, useEffect, useRef, useState } from 'react'
import { nuevoId } from '../almacenamiento/indice'
import { cargarMazos, guardarMazos } from '../almacenamiento/mazos'
import { programacionInicial, repasar, type Respuesta } from '../tarjetas/sm2'
import {
  documentoMazosVacio,
  type DocumentoMazos,
  type Mazo,
  type Tarjeta,
} from '../tarjetas/tipos'

type Opciones = {
  idCuaderno: string
  /** Avisa a la app de que hay que subir los mazos y actualizar el índice. */
  onActividad: (numTarjetas: number) => void
}

/**
 * Estado de los mazos de una materia.
 *
 * Cada cambio se escribe en IndexedDB al momento (es barato y así nada depende
 * de acordarse de guardar) y avisa hacia arriba. La subida a la nube la agrupa
 * useNube con su retardo, de modo que una sesión de repaso entera acaba en uno o
 * dos commits en lugar de uno por tarjeta.
 */
export function useMazos({ idCuaderno, onActividad }: Opciones) {
  const [documento, setDocumento] = useState<DocumentoMazos | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onActividadRef = useRef(onActividad)
  useEffect(() => {
    onActividadRef.current = onActividad
  }, [onActividad])

  useEffect(() => {
    let activo = true
    setDocumento(null)
    setError(null)

    cargarMazos(idCuaderno)
      .then((cargado) => {
        if (activo) setDocumento(cargado)
      })
      .catch((causa) => {
        console.error('No se pudieron cargar los mazos', causa)
        if (activo) setError('No se pudieron cargar las flashcards de esta materia.')
      })

    return () => {
      activo = false
    }
  }, [idCuaderno])

  const aplicar = useCallback(
    (cambio: (previo: DocumentoMazos) => DocumentoMazos) => {
      setDocumento((previo) => {
        const base = previo ?? documentoMazosVacio()
        const siguiente = cambio(base)
        void guardarMazos(idCuaderno, siguiente).catch((causa) => {
          console.error('No se pudieron guardar los mazos', causa)
          setError('No se pudo guardar. Revisa el espacio del navegador.')
        })
        const total = siguiente.mazos.reduce((suma, mazo) => suma + mazo.tarjetas.length, 0)
        onActividadRef.current(total)
        return siguiente
      })
    },
    [idCuaderno],
  )

  /** Aplica un cambio a un mazo concreto y le pone fecha de modificación. */
  const enMazo = useCallback(
    (idMazo: string, cambio: (mazo: Mazo) => Mazo) => {
      aplicar((previo) => ({
        ...previo,
        mazos: previo.mazos.map((mazo) =>
          mazo.id === idMazo ? { ...cambio(mazo), modificado: Date.now() } : mazo,
        ),
      }))
    },
    [aplicar],
  )

  const crearMazo = useCallback(
    (nombre: string): string => {
      const ahora = Date.now()
      const mazo: Mazo = {
        id: nuevoId(),
        nombre: nombre.trim() || 'Mazo sin nombre',
        creado: ahora,
        modificado: ahora,
        tarjetas: [],
      }
      aplicar((previo) => ({ ...previo, mazos: [...previo.mazos, mazo] }))
      return mazo.id
    },
    [aplicar],
  )

  const renombrarMazo = useCallback(
    (idMazo: string, nombre: string) => {
      const limpio = nombre.trim()
      if (!limpio) return
      enMazo(idMazo, (mazo) => ({ ...mazo, nombre: limpio }))
    },
    [enMazo],
  )

  const eliminarMazo = useCallback(
    (idMazo: string) => {
      aplicar((previo) => ({ ...previo, mazos: previo.mazos.filter((m) => m.id !== idMazo) }))
    },
    [aplicar],
  )

  const anadirTarjeta = useCallback(
    (idMazo: string, anverso: string, reverso: string): void => {
      const tarjeta: Tarjeta = {
        id: nuevoId(),
        anverso,
        reverso,
        creado: Date.now(),
        programacion: programacionInicial(),
      }
      enMazo(idMazo, (mazo) => ({ ...mazo, tarjetas: [...mazo.tarjetas, tarjeta] }))
    },
    [enMazo],
  )

  const editarTarjeta = useCallback(
    (idMazo: string, idTarjeta: string, anverso: string, reverso: string) => {
      enMazo(idMazo, (mazo) => ({
        ...mazo,
        tarjetas: mazo.tarjetas.map((t) => (t.id === idTarjeta ? { ...t, anverso, reverso } : t)),
      }))
    },
    [enMazo],
  )

  const eliminarTarjeta = useCallback(
    (idMazo: string, idTarjeta: string) => {
      enMazo(idMazo, (mazo) => ({
        ...mazo,
        tarjetas: mazo.tarjetas.filter((t) => t.id !== idTarjeta),
      }))
    },
    [enMazo],
  )

  /** Guarda el resultado de un repaso aplicando SM-2. */
  const registrarRepaso = useCallback(
    (idMazo: string, idTarjeta: string, respuesta: Respuesta) => {
      enMazo(idMazo, (mazo) => ({
        ...mazo,
        tarjetas: mazo.tarjetas.map((t) =>
          t.id === idTarjeta ? { ...t, programacion: repasar(t.programacion, respuesta) } : t,
        ),
      }))
    },
    [enMazo],
  )

  return {
    documento,
    error,
    crearMazo,
    renombrarMazo,
    eliminarMazo,
    anadirTarjeta,
    editarTarjeta,
    eliminarTarjeta,
    registrarRepaso,
  }
}
