import { useCallback, useEffect, useRef } from 'react'
import { BarraNube } from './componentes/BarraNube'
import { useCuadernos } from './hooks/useCuadernos'
import { useNube } from './hooks/useNube'
import { irAlCuaderno, irAlSelector, useRuta } from './hooks/useRuta'
import { PantallaAcceso } from './pantallas/PantallaAcceso'
import { SelectorCuadernos } from './pantallas/SelectorCuadernos'
import { VistaCuaderno } from './pantallas/VistaCuaderno'

export default function App() {
  const ruta = useRuta()

  // Referencia indirecta porque los dos hooks se necesitan mutuamente: la nube
  // debe poder releer el índice, y el índice debe avisar a la nube de cambios.
  const recargarRef = useRef<() => void>(() => {})
  const alActualizarIndice = useCallback(() => recargarRef.current(), [])

  const nube = useNube({ alActualizarIndice })

  const {
    cuadernos,
    ultimoCuaderno,
    crear,
    renombrar,
    eliminar,
    alternarArchivado,
    marcarActividad,
    recordarUltimoCuaderno,
    recargar,
    sembrarSiVacio,
  } = useCuadernos({ alCambiar: nube.anotarCambio })

  useEffect(() => {
    recargarRef.current = recargar
  }, [recargar])

  const enUso = nube.estadoSesion === 'abierto'

  /*
   * La semilla se aplica una sola vez y solo tras la primera sincronización: en
   * un dispositivo nuevo, sembrar antes de bajar el índice remoto crearía
   * "Biología" y "Química" duplicadas con identificadores distintos.
   */
  const semillaIntentada = useRef(false)
  useEffect(() => {
    if (semillaIntentada.current) return
    if (nube.estadoSesion !== 'abierto' || nube.estadoNube !== 'sincronizado') return
    semillaIntentada.current = true
    if (cuadernos.length !== 0) return

    void sembrarSiVacio().then(() => {
      // Sin esta segunda subida, la nube se quedaría con el índice vacío que se
      // escribió antes de sembrar, y quien cerrara la app aquí no encontraría
      // nada al abrirla en otro dispositivo.
      void nube.sincronizarAhora()
    })
  }, [nube.estadoSesion, nube.estadoNube, cuadernos.length, sembrarSiVacio, nube.sincronizarAhora])

  /* Retomar el trabajo donde se dejó, en cualquier dispositivo. */
  const retomado = useRef(false)
  useEffect(() => {
    if (retomado.current || !enUso) return
    if (nube.estadoNube === 'sincronizando') return
    retomado.current = true

    // Solo si se entró por la raíz: si el usuario abrió un enlace concreto,
    // manda su enlace.
    if (ruta.tipo !== 'selector' || window.location.hash.replace(/^#\/?/, '') !== '') return
    if (ultimoCuaderno && cuadernos.some((c) => c.id === ultimoCuaderno)) {
      irAlCuaderno(ultimoCuaderno)
    }
  }, [enUso, nube.estadoNube, ruta.tipo, ultimoCuaderno, cuadernos])

  /* Recordar la materia abierta para poder retomarla desde otro dispositivo. */
  useEffect(() => {
    if (!enUso) return
    if (ruta.tipo === 'cuaderno' && cuadernos.some((c) => c.id === ruta.id)) {
      recordarUltimoCuaderno(ruta.id)
    }
  }, [enUso, ruta, cuadernos, recordarUltimoCuaderno])

  if (nube.estadoSesion === 'cargando') {
    return <p className="vacio">Cargando…</p>
  }

  if (nube.estadoSesion === 'sin-configurar' || nube.estadoSesion === 'bloqueado') {
    return (
      <PantallaAcceso
        estado={nube.estadoSesion}
        onConectar={nube.conectar}
        onDesbloquear={nube.desbloquear}
        onOlvidarCredencial={nube.olvidarCredencialGuardada}
      />
    )
  }

  const barra = (
    <BarraNube
      estadoSesion={nube.estadoSesion}
      estadoNube={nube.estadoNube}
      mensaje={nube.mensaje}
      pendientes={nube.pendientes}
      ultimaSync={nube.ultimaSync}
      donde={nube.donde}
      onSincronizar={() => void nube.sincronizarAhora()}
      onCerrarSesion={(borrar) => void nube.cerrarSesion(borrar)}
      onUsarOtroToken={nube.olvidarCredencialGuardada}
    />
  )

  if (ruta.tipo === 'cuaderno') {
    const cuaderno = cuadernos.find((c) => c.id === ruta.id)

    // El hash puede apuntar a una materia ya eliminada o de otra cuenta.
    if (!cuaderno) {
      return (
        <main className="selector">
          <p className="vacio">Esa materia ya no existe.</p>
          <button type="button" className="boton-primario" onClick={irAlSelector}>
            Volver a Cuadernos
          </button>
        </main>
      )
    }

    return <VistaCuaderno cuaderno={cuaderno} onActividad={marcarActividad} barraNube={barra} />
  }

  return (
    <SelectorCuadernos
      cuadernos={cuadernos}
      barraNube={barra}
      onAbrir={irAlCuaderno}
      onCrear={(nombre) => {
        const cuaderno = crear(nombre)
        irAlCuaderno(cuaderno.id)
      }}
      onRenombrar={renombrar}
      onEliminar={(id) => void eliminar(id)}
      onAlternarArchivado={alternarArchivado}
    />
  )
}
