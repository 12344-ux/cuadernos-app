/*
 * Estado del panel de documentos.
 *
 * El registro se pide al abrir el panel y no se guarda copia local: la lista es
 * pequeña y así no hay una segunda verdad que pueda quedarse vieja. La caché de
 * los PDF es la carpeta de descargas del dispositivo.
 */
import { useCallback, useRef, useState } from 'react'
import {
  adjuntosVisibles,
  descargarAdjunto,
  eliminarAdjunto,
  leerRegistro,
  subirAdjunto,
} from '../adjuntos/registro'
import {
  AdjuntoDemasiadoGrande,
  registroVacio,
  type Adjunto,
  type RegistroAdjuntos,
} from '../adjuntos/tipos'
import type { ClienteGitHub } from '../nube/github'

type Opciones = {
  idMateria: string
  /** La clase abierta, si la hay: es la etiqueta que llevará lo que se suba. */
  idClase: string | null
  obtenerCliente: () => ClienteGitHub | null
}

function mensajeDeError(causa: unknown): string {
  if (causa instanceof AdjuntoDemasiadoGrande) return causa.message
  if (causa instanceof Error) return causa.message
  return 'No se pudo completar la operación.'
}

export function useAdjuntos({ idMateria, idClase, obtenerCliente }: Opciones) {
  const [registro, setRegistro] = useState<RegistroAdjuntos>(registroVacio())
  const [cargando, setCargando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargado, setCargado] = useState(false)

  /*
   * Evita dos operaciones a la vez.
   *
   * No es cosmético: subir y borrar leen el registro, lo modifican y lo escriben.
   * Dos de esas a la vez desde la misma pestaña se pisarían el sha y una de las
   * dos se perdería aunque el reintento por conflicto la rescatase.
   */
  const enCursoRef = useRef(false)

  const sinConexion = useCallback(() => {
    setError('No hay sesión con GitHub abierta. Vuelve a entrar con tu contraseña.')
  }, [])

  const cargar = useCallback(async () => {
    const cliente = obtenerCliente()
    if (!cliente) return sinConexion()

    setCargando(true)
    setError(null)
    try {
      const { registro: leido } = await leerRegistro(cliente, idMateria)
      setRegistro(leido)
      setCargado(true)
    } catch (causa) {
      console.error('No se pudo leer el registro de documentos', causa)
      setError(mensajeDeError(causa))
    } finally {
      setCargando(false)
    }
  }, [idMateria, obtenerCliente, sinConexion])

  const subir = useCallback(
    async (archivos: File[]) => {
      const cliente = obtenerCliente()
      if (!cliente) return sinConexion()
      if (enCursoRef.current) return

      if (archivos.length === 0) return

      enCursoRef.current = true
      setError(null)
      try {
        for (const archivo of archivos) {
          setOcupado(`Subiendo ${archivo.name}…`)
          const siguiente = await subirAdjunto(cliente, idMateria, idClase, archivo)
          setRegistro(siguiente)
          setCargado(true)
        }
      } catch (causa) {
        console.error('No se pudo subir el documento', causa)
        setError(mensajeDeError(causa))
      } finally {
        enCursoRef.current = false
        setOcupado(null)
      }
    },
    [idMateria, idClase, obtenerCliente, sinConexion],
  )

  /**
   * Entrega el PDF al navegador como una descarga normal.
   *
   * Se usa un enlace con 'download' y una URL de objeto en lugar de abrirlo en
   * una pestaña: así respeta el nombre original y va a la carpeta de descargas,
   * que es donde se pidió que quedara. La URL se revoca siempre, incluso si algo
   * falla, porque mientras viva mantiene los bytes retenidos en memoria.
   */
  const descargar = useCallback(
    async (adjunto: Adjunto) => {
      const cliente = obtenerCliente()
      if (!cliente) return sinConexion()
      if (enCursoRef.current) return

      enCursoRef.current = true
      setError(null)
      setOcupado(`Descargando ${adjunto.nombre}…`)
      let url: string | null = null
      try {
        const bytes = await descargarAdjunto(cliente, adjunto)
        /*
         * Se entrega como flujo de bytes genérico y no con el tipo real del
         * archivo.
         *
         * El tipo no se guarda en el registro a propósito, y aquí no hace falta:
         * con el atributo 'download' el navegador escribe el archivo en disco con
         * su nombre original en lugar de intentar abrirlo, y a partir de ahí es el
         * sistema quien lo asocia a su programa por la extensión. Declarar un tipo
         * concreto solo importaría si se pretendiera mostrarlo en el navegador.
         */
        url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))
        const enlace = document.createElement('a')
        enlace.href = url
        enlace.download = adjunto.nombre
        document.body.appendChild(enlace)
        enlace.click()
        enlace.remove()
      } catch (causa) {
        console.error('No se pudo descargar el documento', causa)
        setError(mensajeDeError(causa))
      } finally {
        // Se espera un instante antes de revocar: si se revoca en el mismo turno,
        // algunos navegadores cancelan la descarga que acaba de empezar.
        // Se copia a una constante porque 'url' es mutable y TypeScript no puede
        // dar por buena la comprobación dentro de la función diferida.
        const aRevocar = url
        if (aRevocar) window.setTimeout(() => URL.revokeObjectURL(aRevocar), 10_000)
        enCursoRef.current = false
        setOcupado(null)
      }
    },
    [obtenerCliente, sinConexion],
  )

  const eliminar = useCallback(
    async (adjunto: Adjunto) => {
      const cliente = obtenerCliente()
      if (!cliente) return sinConexion()
      if (enCursoRef.current) return

      enCursoRef.current = true
      setError(null)
      setOcupado(`Quitando ${adjunto.nombre}…`)
      try {
        setRegistro(await eliminarAdjunto(cliente, idMateria, adjunto))
      } catch (causa) {
        console.error('No se pudo quitar el documento', causa)
        setError(mensajeDeError(causa))
      } finally {
        enCursoRef.current = false
        setOcupado(null)
      }
    },
    [idMateria, obtenerCliente, sinConexion],
  )

  return {
    adjuntos: adjuntosVisibles(registro),
    cargando,
    cargado,
    ocupado,
    error,
    cargar,
    subir,
    descargar,
    eliminar,
    limpiarError: useCallback(() => setError(null), []),
  }
}
