import { useCallback, useEffect, useState } from 'react'
import { eliminarDocumento } from '../almacenamiento/documentos'
import { escribirIndice, leerIndice, nuevoId } from '../almacenamiento/indice'
import { aplicarSemillaSiHaceFalta } from '../almacenamiento/semilla'
import type { Cuaderno } from '../tipos'

/** Estado y operaciones sobre la lista de materias. */
export function useCuadernos() {
  const [cuadernos, setCuadernos] = useState<Cuaderno[]>(() => leerIndice().cuadernos)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    aplicarSemillaSiHaceFalta()
      .then((sembrados) => {
        if (!activo) return
        if (sembrados) setCuadernos(sembrados)
        setCargando(false)
      })
      .catch((error) => {
        console.error('Falló la semilla inicial', error)
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  const aplicar = useCallback((cambio: (previos: Cuaderno[]) => Cuaderno[]) => {
    setCuadernos((previos) => {
      const siguientes = cambio(previos)
      escribirIndice({ version: 1, cuadernos: siguientes })
      return siguientes
    })
  }, [])

  const crear = useCallback(
    (nombre: string): Cuaderno => {
      const ahora = Date.now()
      const cuaderno: Cuaderno = {
        id: nuevoId(),
        nombre: nombre.trim() || 'Materia sin nombre',
        creado: ahora,
        modificado: ahora,
        archivado: false,
        numIdeas: 0,
      }
      aplicar((previos) => [cuaderno, ...previos])
      return cuaderno
    },
    [aplicar],
  )

  const renombrar = useCallback(
    (id: string, nombre: string) => {
      const limpio = nombre.trim()
      if (!limpio) return
      aplicar((previos) =>
        previos.map((c) => (c.id === id ? { ...c, nombre: limpio, modificado: Date.now() } : c)),
      )
    },
    [aplicar],
  )

  const alternarArchivado = useCallback(
    (id: string) => {
      aplicar((previos) =>
        previos.map((c) => (c.id === id ? { ...c, archivado: !c.archivado } : c)),
      )
    },
    [aplicar],
  )

  /** Borra los metadatos y también el documento en IndexedDB, para no dejar huérfanos. */
  const eliminar = useCallback(
    async (id: string) => {
      aplicar((previos) => previos.filter((c) => c.id !== id))
      try {
        await eliminarDocumento(id)
      } catch (error) {
        console.error('No se pudo eliminar el documento del cuaderno', error)
      }
    },
    [aplicar],
  )

  /** La llama el lienzo tras guardar, para mantener la fecha y el contador al día. */
  const marcarActividad = useCallback(
    (id: string, numIdeas: number) => {
      aplicar((previos) =>
        previos.map((c) => (c.id === id ? { ...c, modificado: Date.now(), numIdeas } : c)),
      )
    },
    [aplicar],
  )

  return { cuadernos, cargando, crear, renombrar, eliminar, alternarArchivado, marcarActividad }
}
