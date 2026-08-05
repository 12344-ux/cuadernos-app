import { useCallback, useEffect, useRef, useState } from 'react'
import { hayPendientes, leerUltimaSincronizacion } from '../almacenamiento/estadoNube'
import { borrarTodoLoLocal } from '../almacenamiento/limpieza'
import { INTERVALO_SUBIDA_MS, RETARDO_SUBIDA_MS } from '../nube/configuracion'
import {
  cifrarToken,
  descifrarToken,
  guardarCredencial,
  leerCredencial,
  olvidarCredencial,
  pareceTokenValido,
  type DondeGuardar,
} from '../nube/credenciales'
import { ClienteGitHub, ErrorAutenticacion } from '../nube/github'
import {
  anotarCambioAgenda,
  anotarCambioApuntes,
  anotarCambioClases,
  anotarCambioLocal,
  anotarCambioMazos,
  sincronizar,
} from '../nube/sincronizacion'

/**
 * No existe un modo "solo local" sin contraseña a propósito.
 *
 * Lo hubo, y era un agujero: cualquiera que abriera la app en un equipo con
 * datos guardados entraba sin contraseña y podía borrar materias. Esos borrados
 * quedaban marcados como pendientes y los subía el propio dueño la siguiente
 * vez que entraba, con su token. Se comprobó que ocurría de verdad.
 *
 * No hace falta como respaldo sin conexión: 'desbloquear' abre la sesión antes
 * de sincronizar, así que con la contraseña se trabaja igual sin internet y los
 * cambios quedan pendientes de subir.
 */
export type EstadoSesion =
  /** Comprobando si hay credencial guardada. */
  | 'cargando'
  /** No hay token: hay que pegarlo y elegir contraseña. */
  | 'sin-configurar'
  /** Hay token cifrado: solo falta la contraseña. */
  | 'bloqueado'
  /** Token en memoria y cliente listo. */
  | 'abierto'

export type EstadoNube = 'inactivo' | 'sincronizando' | 'sincronizado' | 'error'

type Opciones = {
  /** Se llama tras cada sincronización para que la interfaz relea el índice. */
  alActualizarIndice: () => void
}

export function useNube({ alActualizarIndice }: Opciones) {
  const [estadoSesion, setEstadoSesion] = useState<EstadoSesion>('cargando')
  const [estadoNube, setEstadoNube] = useState<EstadoNube>('inactivo')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState(false)
  const [ultimaSync, setUltimaSync] = useState<number | null>(null)
  const [donde, setDonde] = useState<DondeGuardar>('solo-esta-sesion')

  // El token descifrado vive solo aquí, en memoria. No se guarda en claro en
  // ningún almacén del navegador.
  const clienteRef = useRef<ClienteGitHub | null>(null)
  const sincronizandoRef = useRef(false)
  const alActualizarRef = useRef(alActualizarIndice)
  /** Temporizador de la subida automática tras un cambio. */
  const temporizadorSubidaRef = useRef<number | null>(null)

  useEffect(() => {
    alActualizarRef.current = alActualizarIndice
  }, [alActualizarIndice])

  useEffect(() => {
    const guardada = leerCredencial()
    setUltimaSync(leerUltimaSincronizacion())
    setPendientes(hayPendientes())
    if (guardada) {
      setDonde(guardada.donde)
      setEstadoSesion('bloqueado')
    } else {
      setEstadoSesion('sin-configurar')
    }
  }, [])

  const refrescarPendientes = useCallback(() => setPendientes(hayPendientes()), [])

  /** Sincronización real. Devuelve true si terminó sin errores. */
  const ejecutarSincronizacion = useCallback(async (): Promise<boolean> => {
    const cliente = clienteRef.current
    if (!cliente || sincronizandoRef.current) return false

    sincronizandoRef.current = true
    setEstadoNube('sincronizando')
    setMensaje(null)

    try {
      const resultado = await sincronizar(cliente)
      alActualizarRef.current()
      refrescarPendientes()
      setUltimaSync(Date.now())
      setEstadoNube('sincronizado')

      // Las fusiones sí se cuentan, porque conviene saber que llegó trabajo de
      // otro dispositivo; pero no se pregunta nada ni se interrumpe.
      setMensaje(
        resultado.fusionadas.length
          ? `Se combinaron los cambios de otro dispositivo en ${resultado.fusionadas.join(', ')}.`
          : null,
      )
      return true
    } catch (error) {
      console.error('Falló la sincronización', error)
      setEstadoNube('error')
      setMensaje(error instanceof Error ? error.message : 'Error al sincronizar.')

      /*
       * Si el token dejó de servir se deja de intentar, pero NO se cierra la
       * sesión ni se borra la credencial: eso dejaría al dueño sin acceso a sus
       * propios apuntes guardados en este equipo justo cuando más los necesita.
       * Se sigue trabajando en local y la barra ofrece cambiar el token.
       */
      if (error instanceof ErrorAutenticacion) {
        clienteRef.current = null
        setMensaje(
          'GitHub rechazó el token (puede haber caducado o estar revocado). Tus cambios se siguen guardando aquí. Pulsa "Usar otro token" para reconectar.',
        )
      }
      return false
    } finally {
      sincronizandoRef.current = false
    }
  }, [refrescarPendientes])

  /** Primera vez: token + contraseña. */
  const conectar = useCallback(
    async (token: string, contrasena: string, recordarAqui: boolean): Promise<void> => {
      const limpio = token.trim()
      if (!pareceTokenValido(limpio)) {
        throw new Error(
          'Ese token no tiene el formato esperado. Debe empezar por "github_pat_" (fine-grained).',
        )
      }

      const cliente = new ClienteGitHub(limpio)
      // Se valida contra GitHub antes de guardar nada, para no almacenar una
      // credencial que no sirve.
      const info = await cliente.comprobarAcceso()
      if (!info.puedeEscribir) {
        throw new Error('El token no puede escribir en el repositorio de datos.')
      }

      const destino: DondeGuardar = recordarAqui ? 'dispositivo' : 'solo-esta-sesion'
      guardarCredencial(await cifrarToken(limpio, contrasena), destino)
      setDonde(destino)
      clienteRef.current = cliente
      setEstadoSesion('abierto')
      await ejecutarSincronizacion()
    },
    [ejecutarSincronizacion],
  )

  /** Siguientes veces: solo la contraseña. */
  const desbloquear = useCallback(
    async (contrasena: string): Promise<void> => {
      const guardada = leerCredencial()
      if (!guardada) {
        setEstadoSesion('sin-configurar')
        throw new Error('No hay ninguna credencial guardada en este dispositivo.')
      }

      // Puede lanzar ErrorContrasena; la pantalla de acceso lo muestra.
      const token = await descifrarToken(guardada.credencial, contrasena)
      clienteRef.current = new ClienteGitHub(token)
      setEstadoSesion('abierto')
      await ejecutarSincronizacion()
    },
    [ejecutarSincronizacion],
  )

  /** "Usar otro token": olvida la credencial pero conserva los apuntes locales. */
  const olvidarCredencialGuardada = useCallback(() => {
    clienteRef.current = null
    olvidarCredencial()
    setEstadoSesion('sin-configurar')
    setEstadoNube('inactivo')
    setMensaje(null)
  }, [])

  /**
   * Cierra la sesión. En un equipo compartido conviene borrar además los datos
   * locales; si queda algo sin subir se avisa antes en la interfaz.
   */
  const cerrarSesion = useCallback(async (borrarDatos: boolean): Promise<void> => {
    clienteRef.current = null
    olvidarCredencial()
    if (borrarDatos) {
      await borrarTodoLoLocal()
    }
    setEstadoNube('inactivo')
    setMensaje(null)
    setEstadoSesion('sin-configurar')
    alActualizarRef.current()
  }, [])

  /**
   * Sube poco después del último cambio.
   *
   * Es lo que hace que no haya que acordarse de guardar nada: cada edición
   * reprograma el temporizador, así que una ráfaga de cambios se agrupa en una
   * sola subida y por tanto en un solo commit, pero nunca pasan más de unos
   * segundos entre dejar de escribir y tenerlo en la nube.
   */
  const programarSubida = useCallback(() => {
    if (temporizadorSubidaRef.current !== null) {
      window.clearTimeout(temporizadorSubidaRef.current)
    }
    temporizadorSubidaRef.current = window.setTimeout(() => {
      temporizadorSubidaRef.current = null
      if (hayPendientes()) void ejecutarSincronizacion()
    }, RETARDO_SUBIDA_MS)
  }, [ejecutarSincronizacion])

  useEffect(() => {
    return () => {
      if (temporizadorSubidaRef.current !== null) {
        window.clearTimeout(temporizadorSubidaRef.current)
      }
    }
  }, [])

  /** La llama la app cuando el lienzo guarda en local. */
  const anotarCambio = useCallback(
    (idCuaderno: string) => {
      anotarCambioLocal(idCuaderno)
      setPendientes(true)
      programarSubida()
    },
    [programarSubida],
  )

  /** Lo mismo cuando lo que se ha guardado son los mazos de flashcards. */
  const anotarCambioDeMazos = useCallback(
    (idCuaderno: string) => {
      anotarCambioMazos(idCuaderno)
      setPendientes(true)
      programarSubida()
    },
    [programarSubida],
  )

  /** Y cuando lo que se ha guardado es la agenda de tareas. */
  const anotarCambioDeAgenda = useCallback(() => {
    anotarCambioAgenda()
    setPendientes(true)
    programarSubida()
  }, [programarSubida])

  /** La lista de clases de una materia. */
  const anotarCambioDeClases = useCallback(
    (idCuaderno: string) => {
      anotarCambioClases(idCuaderno)
      setPendientes(true)
      programarSubida()
    },
    [programarSubida],
  )

  /** Los apuntes de una clase, que van en su propio archivo. */
  const anotarCambioDeApuntes = useCallback(
    (idClase: string) => {
      anotarCambioApuntes(idClase)
      setPendientes(true)
      programarSubida()
    },
    [programarSubida],
  )

  // Red de seguridad periódica, por si una subida falló y quedó algo pendiente.
  useEffect(() => {
    if (estadoSesion !== 'abierto') return
    const temporizador = window.setInterval(() => {
      if (hayPendientes()) void ejecutarSincronizacion()
    }, INTERVALO_SUBIDA_MS)
    return () => window.clearInterval(temporizador)
  }, [estadoSesion, ejecutarSincronizacion])

  // Al recuperar la conexión se reintenta enseguida: si se estuvo trabajando sin
  // red, lo pendiente se queda esperando al intervalo sin este aviso.
  useEffect(() => {
    if (estadoSesion !== 'abierto') return
    const alVolverLaRed = () => {
      if (hayPendientes()) void ejecutarSincronizacion()
    }
    window.addEventListener('online', alVolverLaRed)
    return () => window.removeEventListener('online', alVolverLaRed)
  }, [estadoSesion, ejecutarSincronizacion])

  // Al ocultar la pestaña se intenta subir lo pendiente. 'visibilitychange' es
  // más fiable que 'pagehide' para trabajo asíncrono, así que se usan los dos.
  useEffect(() => {
    if (estadoSesion !== 'abierto') return
    const alOcultar = () => {
      if (document.visibilityState === 'hidden' && hayPendientes()) {
        void ejecutarSincronizacion()
      }
    }
    document.addEventListener('visibilitychange', alOcultar)
    window.addEventListener('pagehide', alOcultar)
    return () => {
      document.removeEventListener('visibilitychange', alOcultar)
      window.removeEventListener('pagehide', alOcultar)
    }
  }, [estadoSesion, ejecutarSincronizacion])

  return {
    estadoSesion,
    estadoNube,
    mensaje,
    pendientes,
    ultimaSync,
    donde,
    conectar,
    desbloquear,
    olvidarCredencialGuardada,
    cerrarSesion,
    anotarCambio,
    anotarCambioDeMazos,
    anotarCambioDeAgenda,
    anotarCambioDeClases,
    anotarCambioDeApuntes,
    sincronizarAhora: ejecutarSincronizacion,
  }
}
