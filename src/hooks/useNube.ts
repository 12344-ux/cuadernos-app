import { useCallback, useEffect, useRef, useState } from 'react'
import { hayPendientes, leerUltimaSincronizacion } from '../almacenamiento/estadoNube'
import { borrarTodoLoLocal } from '../almacenamiento/limpieza'
import { INTERVALO_SUBIDA_MS } from '../nube/configuracion'
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
  anotarCambioLocal,
  resolverConLocal,
  resolverConRemoto,
  sincronizar,
  type Conflicto,
} from '../nube/sincronizacion'

export type EstadoSesion =
  /** Comprobando si hay credencial guardada. */
  | 'cargando'
  /** No hay token: hay que pegarlo y elegir contraseña. */
  | 'sin-configurar'
  /** Hay token cifrado: solo falta la contraseña. */
  | 'bloqueado'
  /** Token en memoria y cliente listo. */
  | 'abierto'
  /** El usuario decidió trabajar solo en este dispositivo. */
  | 'local'

export type EstadoNube = 'inactivo' | 'sincronizando' | 'sincronizado' | 'error'

type Opciones = {
  /** Se llama tras cada sincronización para que la interfaz relea el índice. */
  alActualizarIndice: () => void
}

export function useNube({ alActualizarIndice }: Opciones) {
  const [estadoSesion, setEstadoSesion] = useState<EstadoSesion>('cargando')
  const [estadoNube, setEstadoNube] = useState<EstadoNube>('inactivo')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [conflictos, setConflictos] = useState<Conflicto[]>([])
  const [pendientes, setPendientes] = useState(false)
  const [ultimaSync, setUltimaSync] = useState<number | null>(null)
  const [donde, setDonde] = useState<DondeGuardar>('solo-esta-sesion')

  // El token descifrado vive solo aquí, en memoria. No se guarda en claro en
  // ningún almacén del navegador.
  const clienteRef = useRef<ClienteGitHub | null>(null)
  const sincronizandoRef = useRef(false)
  const alActualizarRef = useRef(alActualizarIndice)

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
      setConflictos(resultado.conflictos)
      alActualizarRef.current()
      refrescarPendientes()
      setUltimaSync(Date.now())

      if (resultado.conflictos.length > 0) {
        setEstadoNube('error')
        setMensaje(
          `${resultado.conflictos.length} materia(s) cambiaron aquí y en la nube. Elige cuál conservar.`,
        )
        return false
      }

      setEstadoNube('sincronizado')
      const partes: string[] = []
      if (resultado.subidas.length) partes.push(`${resultado.subidas.length} subida(s)`)
      if (resultado.bajadas.length) partes.push(`${resultado.bajadas.length} bajada(s)`)
      setMensaje(partes.length ? partes.join(' · ') : null)
      return true
    } catch (error) {
      console.error('Falló la sincronización', error)
      setEstadoNube('error')
      setMensaje(error instanceof Error ? error.message : 'Error al sincronizar.')

      // Si el token dejó de servir, hay que volver a pedirlo: no tiene sentido
      // seguir reintentando ni dejar creer que se está guardando en la nube.
      if (error instanceof ErrorAutenticacion) {
        clienteRef.current = null
        olvidarCredencial()
        setEstadoSesion('sin-configurar')
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

  const usarSinConectar = useCallback(() => {
    setEstadoSesion('local')
    setEstadoNube('inactivo')
    setMensaje(null)
  }, [])

  /** Vuelve a la pantalla de acceso sin borrar nada de lo que hay en local. */
  const volverAlAcceso = useCallback(() => {
    clienteRef.current = null
    setEstadoSesion(leerCredencial() ? 'bloqueado' : 'sin-configurar')
    setEstadoNube('inactivo')
    setMensaje(null)
  }, [])

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
    setConflictos([])
    setEstadoNube('inactivo')
    setMensaje(null)
    setEstadoSesion('sin-configurar')
    alActualizarRef.current()
  }, [])

  const resolverConflicto = useCallback(
    async (idCuaderno: string, quedarseCon: 'local' | 'remoto'): Promise<void> => {
      const cliente = clienteRef.current
      if (!cliente) return
      setEstadoNube('sincronizando')
      try {
        if (quedarseCon === 'local') {
          await resolverConLocal(cliente, idCuaderno)
        } else {
          await resolverConRemoto(cliente, idCuaderno)
        }
        setConflictos((previos) => previos.filter((c) => c.idCuaderno !== idCuaderno))
        alActualizarRef.current()
        await ejecutarSincronizacion()
      } catch (error) {
        console.error('No se pudo resolver el conflicto', error)
        setEstadoNube('error')
        setMensaje(error instanceof Error ? error.message : 'Error al resolver el conflicto.')
      }
    },
    [ejecutarSincronizacion],
  )

  /** La llama la app cuando el lienzo guarda en local. */
  const anotarCambio = useCallback(
    (idCuaderno: string) => {
      anotarCambioLocal(idCuaderno)
      setPendientes(true)
    },
    [],
  )

  // Subida periódica: solo si la sesión está abierta y hay algo que subir.
  useEffect(() => {
    if (estadoSesion !== 'abierto') return
    const temporizador = window.setInterval(() => {
      if (hayPendientes()) void ejecutarSincronizacion()
    }, INTERVALO_SUBIDA_MS)
    return () => window.clearInterval(temporizador)
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
    conflictos,
    pendientes,
    ultimaSync,
    donde,
    conectar,
    desbloquear,
    usarSinConectar,
    volverAlAcceso,
    olvidarCredencialGuardada,
    cerrarSesion,
    resolverConflicto,
    anotarCambio,
    sincronizarAhora: ejecutarSincronizacion,
  }
}
