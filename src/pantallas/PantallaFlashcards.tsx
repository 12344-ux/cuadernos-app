import { useCallback, useState } from 'react'
import { BarraFormato } from '../componentes/BarraFormato'
import { BotonModoVisual } from '../componentes/BotonModoVisual'
import { ListaTarjetas } from '../componentes/ListaTarjetas'
import { SesionEstudio } from '../componentes/SesionEstudio'
import { useMazos } from '../hooks/useMazos'
import { irAlCuaderno } from '../hooks/useRuta'
import { contar } from '../tarjetas/sm2'
import type { Mazo } from '../tarjetas/tipos'
import type { Cuaderno } from '../tipos'

type Props = {
  cuaderno: Cuaderno
  onActividad: (id: string, numTarjetas: number) => void
}

function TarjetaMazo({
  mazo,
  onEstudiar,
  onAbrir,
  onRenombrar,
  onEliminar,
}: {
  mazo: Mazo
  onEstudiar: () => void
  onAbrir: () => void
  onRenombrar: (nombre: string) => void
  onEliminar: () => void
}) {
  const [renombrando, setRenombrando] = useState(false)
  const [nombre, setNombre] = useState(mazo.nombre)
  const recuento = contar(mazo.tarjetas)
  const hayQueEstudiar = recuento.total > 0

  return (
    <li className="tarjeta-mazo">
      {renombrando ? (
        <input
          className="entrada-nombre"
          value={nombre}
          autoFocus
          onChange={(evento) => setNombre(evento.target.value)}
          onFocus={(evento) => evento.target.select()}
          onBlur={() => {
            onRenombrar(nombre)
            setRenombrando(false)
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              onRenombrar(nombre)
              setRenombrando(false)
            }
            if (evento.key === 'Escape') {
              setNombre(mazo.nombre)
              setRenombrando(false)
            }
          }}
        />
      ) : (
        <button type="button" className="nombre-mazo" onClick={() => setRenombrando(true)}>
          {mazo.nombre}
        </button>
      )}

      <p className="mazo-detalle">
        {mazo.tarjetas.length} {mazo.tarjetas.length === 1 ? 'tarjeta' : 'tarjetas'}
        {recuento.nuevas > 0 && <> · {recuento.nuevas} sin ver</>}
      </p>

      <div className="mazo-hoy">
        {hayQueEstudiar ? (
          <span className="pastilla pastilla-aviso">{recuento.total} para hoy</span>
        ) : (
          <span className="pastilla pastilla-ok">Al día</span>
        )}
      </div>

      <div className="acciones-mazo">
        <button
          type="button"
          className="boton-primario"
          onClick={onEstudiar}
          disabled={!hayQueEstudiar}
          title={hayQueEstudiar ? undefined : 'No hay tarjetas pendientes hoy en este mazo'}
        >
          Estudiar
        </button>
        <button type="button" className="boton-secundario" onClick={onAbrir}>
          Tarjetas
        </button>
        <button
          type="button"
          className="boton-discreto peligro"
          onClick={() => {
            const aviso =
              mazo.tarjetas.length > 0
                ? `¿Eliminar «${mazo.nombre}» con sus ${mazo.tarjetas.length} tarjetas? No se puede deshacer.`
                : `¿Eliminar «${mazo.nombre}»?`
            if (window.confirm(aviso)) onEliminar()
          }}
        >
          Eliminar
        </button>
      </div>
    </li>
  )
}

/**
 * Sección de flashcards de una materia.
 *
 * Usa la misma paleta que el resto de la app: superficie blanca, acento índigo y
 * las mismas clases de botón y pastilla que el selector de materias. Lo único
 * propio de esta pantalla es la tarjeta que se voltea y los cuatro botones de
 * respuesta, donde el color sí distingue la dificultad.
 */
export function PantallaFlashcards({ cuaderno, onActividad }: Props) {
  const alGuardar = useCallback(
    (numTarjetas: number) => onActividad(cuaderno.id, numTarjetas),
    [cuaderno.id, onActividad],
  )

  const {
    documento,
    error,
    crearMazo,
    renombrarMazo,
    eliminarMazo,
    anadirTarjeta,
    editarTarjeta,
    eliminarTarjeta,
    registrarRepaso,
  } = useMazos({ idCuaderno: cuaderno.id, onActividad: alGuardar })

  const [abierto, setAbierto] = useState<string | null>(null)
  const [estudiando, setEstudiando] = useState<string | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [creando, setCreando] = useState(false)

  const mazoAbierto = documento?.mazos.find((m) => m.id === abierto) ?? null
  const mazoEstudiando = documento?.mazos.find((m) => m.id === estudiando) ?? null

  const confirmarCreacion = () => {
    const limpio = nombreNuevo.trim()
    if (!limpio) {
      setCreando(false)
      return
    }
    const id = crearMazo(limpio)
    setNombreNuevo('')
    setCreando(false)
    setAbierto(id)
  }

  return (
    <div className="seccion-estudio">
      <header className="barra-estudio">
        <button
          type="button"
          className="boton-secundario"
          onClick={() => irAlCuaderno(cuaderno.id)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Mapa
        </button>
        <div className="titulo-estudio">
          <span className="titulo-estudio-marca">Flashcards</span>
          <h1>{cuaderno.nombre}</h1>
        </div>
        <div className="espaciador" />
        {/* Esta pantalla no lleva BarraNube, así que monta el interruptor aparte. */}
        <BotonModoVisual />
      </header>

      {/* Las caras de una tarjeta usan el mismo editor que el resto, así que su
          formato también sale de la barra de arriba. */}
      <BarraFormato />

      <main className="cuerpo-estudio">
        {error && <p className="vacio">{error}</p>}

        {!documento && !error && <p className="vacio">Abriendo las flashcards…</p>}

        {documento && mazoEstudiando && (
          <SesionEstudio
            mazo={mazoEstudiando}
            onResponder={(idTarjeta, respuesta) =>
              registrarRepaso(mazoEstudiando.id, idTarjeta, respuesta)
            }
            onSalir={() => setEstudiando(null)}
          />
        )}

        {documento && !mazoEstudiando && mazoAbierto && (
          <ListaTarjetas
            mazo={mazoAbierto}
            onAnadir={(anverso, reverso) => anadirTarjeta(mazoAbierto.id, anverso, reverso)}
            onEditar={(id, anverso, reverso) => editarTarjeta(mazoAbierto.id, id, anverso, reverso)}
            onEliminar={(id) => eliminarTarjeta(mazoAbierto.id, id)}
            onVolver={() => setAbierto(null)}
          />
        )}

        {documento && !mazoEstudiando && !mazoAbierto && (
          <div className="panel-estudio">
            <header className="cabecera-mazos">
              <div>
                <h2>Mazos</h2>
                <p className="cabecera-mazo-detalle">
                  Repetición espaciada con SM-2, el algoritmo de Anki.
                </p>
              </div>
              <div className="espaciador" />
              {!creando && (
                <button
                  type="button"
                  className="boton-primario"
                  onClick={() => setCreando(true)}
                >
                  + Nuevo mazo
                </button>
              )}
            </header>

            {creando && (
              <div className="crear-mazo">
                <input
                  className="entrada-nombre"
                  placeholder="Nombre del mazo, por ejemplo «Vocabulario»"
                  value={nombreNuevo}
                  autoFocus
                  onChange={(evento) => setNombreNuevo(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') confirmarCreacion()
                    if (evento.key === 'Escape') {
                      setNombreNuevo('')
                      setCreando(false)
                    }
                  }}
                />
                <button
                  type="button"
                  className="boton-primario"
                  onClick={confirmarCreacion}
                >
                  Crear
                </button>
              </div>
            )}

            {documento.mazos.length === 0 ? (
              <p className="vacio">
                Todavía no hay mazos en esta materia. Crea uno y empieza a añadir tarjetas.
              </p>
            ) : (
              <ul className="lista-mazos">
                {documento.mazos.map((mazo) => (
                  <TarjetaMazo
                    key={mazo.id}
                    mazo={mazo}
                    onEstudiar={() => setEstudiando(mazo.id)}
                    onAbrir={() => setAbierto(mazo.id)}
                    onRenombrar={(nombre) => renombrarMazo(mazo.id, nombre)}
                    onEliminar={() => eliminarMazo(mazo.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
