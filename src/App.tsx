import { useCallback, useEffect, useRef } from 'react'
import { BarraNube } from './componentes/BarraNube'
import { PanelAgenda } from './componentes/PanelAgenda'
import { useAgenda } from './hooks/useAgenda'
import { useCuadernos } from './hooks/useCuadernos'
import { useNube } from './hooks/useNube'
import { irAlCuaderno, irAlSelector, useRuta } from './hooks/useRuta'
import { PantallaAcceso } from './pantallas/PantallaAcceso'
import { PantallaFlashcards } from './pantallas/PantallaFlashcards'
import { PantallaHistorial } from './pantallas/PantallaHistorial'
import { SeccionEstudioActivo } from './pantallas/SeccionEstudioActivo'
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
    marcarActividadMazos,
    marcarActividadAgenda,
    marcarActividadClases,
    recordarUltimoCuaderno,
    recargar,
    sembrarSiVacio,
  } = useCuadernos({
    alCambiar: nube.anotarCambio,
    alCambiarMazos: nube.anotarCambioDeMazos,
    alCambiarAgenda: nube.anotarCambioDeAgenda,
    alCambiarClases: nube.anotarCambioDeClases,
  })

  /*
   * La agenda se sostiene aquí, y no dentro del selector, porque la comparten dos
   * pantallas: el panel de inicio y el historial. Con una copia en cada una,
   * marcar una tarea en un sitio dejaría la otra desactualizada.
   */
  const agenda = useAgenda({ onActividad: marcarActividadAgenda })

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
    // También cuenta estar en las flashcards: la materia es la misma.
    // Estar en las flashcards o en Estudio Activo también cuenta: la materia es
    // la misma, y al volver desde otro dispositivo se quiere retomar ahí.
    const enMateria =
      ruta.tipo === 'cuaderno' ||
      ruta.tipo === 'flashcards' ||
      ruta.tipo === 'estudio' ||
      ruta.tipo === 'clase'
    if (enMateria && cuadernos.some((c) => c.id === ruta.id)) {
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

  if (ruta.tipo === 'agenda') {
    return (
      <PantallaHistorial
        tareas={agenda.tareas}
        onAlternar={agenda.alternarCompletada}
        onEliminar={agenda.eliminarTarea}
      />
    )
  }

  if (
    ruta.tipo === 'cuaderno' ||
    ruta.tipo === 'flashcards' ||
    ruta.tipo === 'estudio' ||
    ruta.tipo === 'clase'
  ) {
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

    if (ruta.tipo === 'flashcards') {
      return <PantallaFlashcards cuaderno={cuaderno} onActividad={marcarActividadMazos} />
    }

    if (ruta.tipo === 'estudio' || ruta.tipo === 'clase') {
      return (
        <SeccionEstudioActivo
          cuaderno={cuaderno}
          idClaseAbierta={ruta.tipo === 'clase' ? ruta.idClase : null}
          onActividadClases={marcarActividadClases}
          onActividadApuntes={nube.anotarCambioDeApuntes}
          onActividadMapa={marcarActividad}
          barraNube={barra}
          // Para que la hoja abierta adopte lo que llegue de otro dispositivo.
          selloSincronizacion={nube.ultimaSync}
        />
      )
    }

    return <VistaCuaderno cuaderno={cuaderno} onActividad={marcarActividad} barraNube={barra} />
  }

  return (
    <SelectorCuadernos
      cuadernos={cuadernos}
      barraNube={barra}
      agenda={
        <PanelAgenda
          tareas={agenda.tareas}
          onCrear={agenda.crearTarea}
          onEditar={agenda.editarTarea}
          onAlternar={agenda.alternarCompletada}
          onEliminar={agenda.eliminarTarea}
        />
      }
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
