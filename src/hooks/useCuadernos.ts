import { useCallback, useMemo, useState } from 'react'
import { eliminarDocumento } from '../almacenamiento/documentos'
import {
  cuadernosVisibles,
  escribirIndice,
  leerIndice,
  nuevoId,
} from '../almacenamiento/indice'
import { aplicarSemillaSiHaceFalta } from '../almacenamiento/semilla'
import { VERSION_INDICE, type Cuaderno, type IndiceCuadernos } from '../tipos'

type Opciones = {
  /** Marca la materia para subirla en la próxima sincronización. */
  alCambiar?: (idCuaderno: string) => void
  /** Lo mismo para los mazos, que viajan en su propio archivo. */
  alCambiarMazos?: (idCuaderno: string) => void
}

/** Estado y operaciones sobre la lista de materias. */
export function useCuadernos({ alCambiar, alCambiarMazos }: Opciones = {}) {
  const [indice, setIndice] = useState<IndiceCuadernos>(() => leerIndice())

  /** Solo las que la interfaz debe mostrar: las lápidas quedan fuera. */
  const cuadernos = useMemo(() => cuadernosVisibles(indice), [indice])

  const aplicar = useCallback(
    (cambio: (previo: IndiceCuadernos) => IndiceCuadernos) => {
      setIndice((previo) => {
        const siguiente = { ...cambio(previo), version: VERSION_INDICE, actualizado: Date.now() }
        escribirIndice(siguiente)
        return siguiente
      })
    },
    [],
  )

  /** Relee el índice del almacén. La usa la sincronización tras fusionar. */
  const recargar = useCallback(() => setIndice(leerIndice()), [])

  /**
   * La semilla ya no se aplica automáticamente al arrancar: en un dispositivo
   * nuevo que va a sincronizar, sembrar antes de bajar la nube crearía
   * "Biología" y "Química" duplicadas con otros identificadores. Ahora la app
   * decide cuándo llamarla.
   */
  const sembrarSiVacio = useCallback(async () => {
    const sembrados = await aplicarSemillaSiHaceFalta()
    if (sembrados) recargar()
  }, [recargar])

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
      aplicar((previo) => ({ ...previo, cuadernos: [cuaderno, ...previo.cuadernos] }))
      alCambiar?.(cuaderno.id)
      return cuaderno
    },
    [aplicar, alCambiar],
  )

  const renombrar = useCallback(
    (id: string, nombre: string) => {
      const limpio = nombre.trim()
      if (!limpio) return
      aplicar((previo) => ({
        ...previo,
        cuadernos: previo.cuadernos.map((c) =>
          c.id === id ? { ...c, nombre: limpio, modificado: Date.now() } : c,
        ),
      }))
      alCambiar?.(id)
    },
    [aplicar, alCambiar],
  )

  const alternarArchivado = useCallback(
    (id: string) => {
      aplicar((previo) => ({
        ...previo,
        cuadernos: previo.cuadernos.map((c) =>
          c.id === id ? { ...c, archivado: !c.archivado, modificado: Date.now() } : c,
        ),
      }))
      alCambiar?.(id)
    },
    [aplicar, alCambiar],
  )

  /**
   * Eliminar deja una lápida en lugar de quitar la entrada. Si se borrara sin
   * más, la próxima sincronización con un dispositivo que todavía la tuviera la
   * resucitaría. El documento local sí se borra de inmediato.
   */
  const eliminar = useCallback(
    async (id: string) => {
      aplicar((previo) => ({
        ...previo,
        ultimoCuaderno: previo.ultimoCuaderno === id ? null : previo.ultimoCuaderno,
        cuadernos: previo.cuadernos.map((c) =>
          c.id === id ? { ...c, eliminado: true, modificado: Date.now() } : c,
        ),
      }))
      alCambiar?.(id)
      try {
        await eliminarDocumento(id)
      } catch (error) {
        console.error('No se pudo eliminar el documento del cuaderno', error)
      }
    },
    [aplicar, alCambiar],
  )

  /** La llama el lienzo tras guardar en local. */
  const marcarActividad = useCallback(
    (id: string, numIdeas: number) => {
      aplicar((previo) => ({
        ...previo,
        cuadernos: previo.cuadernos.map((c) =>
          c.id === id ? { ...c, modificado: Date.now(), numIdeas } : c,
        ),
      }))
      alCambiar?.(id)
    },
    [aplicar, alCambiar],
  )

  /**
   * La llaman las flashcards tras guardar los mazos.
   *
   * Toca 'mazosModificado' y no 'modificado' a propósito: el mapa no ha cambiado,
   * y si se marcara como modificado, repasar tarjetas provocaría bajadas o
   * fusiones de un mapa que nadie tocó.
   */
  const marcarActividadMazos = useCallback(
    (id: string, numTarjetas: number) => {
      aplicar((previo) => ({
        ...previo,
        cuadernos: previo.cuadernos.map((c) =>
          c.id === id ? { ...c, mazosModificado: Date.now(), numTarjetas } : c,
        ),
      }))
      alCambiarMazos?.(id)
    },
    [aplicar, alCambiarMazos],
  )

  /** Recuerda dónde se quedó el usuario, para retomarlo en otro dispositivo. */
  const recordarUltimoCuaderno = useCallback(
    (id: string | null) => {
      setIndice((previo) => {
        if (previo.ultimoCuaderno === id) return previo
        const siguiente = { ...previo, ultimoCuaderno: id, actualizado: Date.now() }
        escribirIndice(siguiente)
        return siguiente
      })
    },
    [],
  )

  return {
    cuadernos,
    ultimoCuaderno: indice.ultimoCuaderno ?? null,
    crear,
    renombrar,
    eliminar,
    alternarArchivado,
    marcarActividad,
    marcarActividadMazos,
    recordarUltimoCuaderno,
    recargar,
    sembrarSiVacio,
  }
}
