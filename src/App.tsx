import { useCuadernos } from './hooks/useCuadernos'
import { irAlCuaderno, irAlSelector, useRuta } from './hooks/useRuta'
import { SelectorCuadernos } from './pantallas/SelectorCuadernos'
import { VistaCuaderno } from './pantallas/VistaCuaderno'

export default function App() {
  const ruta = useRuta()
  const { cuadernos, cargando, crear, renombrar, eliminar, alternarArchivado, marcarActividad } =
    useCuadernos()

  if (cargando) {
    return <p className="vacio">Cargando…</p>
  }

  if (ruta.tipo === 'cuaderno') {
    const cuaderno = cuadernos.find((c) => c.id === ruta.id)

    // El hash puede apuntar a una materia ya eliminada (o de otro navegador).
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

    return <VistaCuaderno cuaderno={cuaderno} onActividad={marcarActividad} />
  }

  return (
    <SelectorCuadernos
      cuadernos={cuadernos}
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
