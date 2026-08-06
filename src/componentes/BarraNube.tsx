import { useState } from 'react'
import { BotonModoVisual } from './BotonModoVisual'
import type { EstadoNube, EstadoSesion } from '../hooks/useNube'
import type { DondeGuardar } from '../nube/credenciales'

const formateadorHora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

/** Los cuatro estados que puede mostrar el icono de la nube. */
export type EstadoIcono = 'ok' | 'pendiente' | 'trabajando' | 'error'

/*
 * La marca que va dentro de la nube en cada estado.
 *
 * En SVG y no con un emoji: no existe ningún emoji de "nube con check", habría
 * que juntar dos caracteres (☁ + ✓), y el segundo ya se comprobó que no está en
 * la pila de fuentes de la app: U+2713 se pinta como un cuadro vacío. Es el mismo
 * motivo por el que la flecha de "volver" y las marcas de las pastillas del modo
 * cómodo tampoco son caracteres. Dibujado, se ve igual en cualquier equipo.
 */
const MARCAS: Record<EstadoIcono, { trazo: string; grosor: number }> = {
  // Un visto.
  ok: { trazo: 'M11.7 13.1l2.4 2.4 4.4-4.8', grosor: 2.6 },
  // Una flecha hacia arriba: hay algo esperando para subir.
  pendiente: { trazo: 'M15 16.6v-6M12.3 13.1l2.7-2.7 2.7 2.7', grosor: 2.6 },
  // Tres puntos: está en marcha. Son trazos de longitud cero con punta redonda.
  trabajando: { trazo: 'M11.5 13.4h0M15 13.4h0M18.5 13.4h0', grosor: 3.2 },
  // Una equis.
  error: { trazo: 'M12.3 10.9l5.4 5.4M17.7 10.9l-5.4 5.4', grosor: 2.6 },
}

/**
 * La nube con su marca de estado.
 *
 * Sustituye al texto que llevaba la pastilla en la barra superior. El texto
 * cambiaba de largo con el estado —y con la hora de la última subida— así que la
 * pastilla se estiraba y se encogía sola delante de quien estaba escribiendo. El
 * icono mide siempre lo mismo.
 *
 * No lleva título ni etiqueta propios: quien lo envuelve ya anuncia el estado con
 * palabras, y repetirlo aquí lo haría sonar dos veces en un lector de pantalla.
 */
export function IconoNube({ estado }: { estado: EstadoIcono }) {
  const { trazo, grosor } = MARCAS[estado]

  return (
    <svg
      className="icono-nube"
      width="21"
      height="15"
      viewBox="0 0 30 21"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        La nube va rellena y la marca calada encima, en el color de fondo de la
        pastilla.

        Con la nube en contorno y la marca dentro no se leía: a 21 px de ancho el
        trazo del contorno se come el sitio y la marca queda en dos o tres
        píxeles, así que los cuatro estados acababan distinguiéndose solo por el
        color, que es justo lo que se quería evitar. Rellena, la marca es un hueco
        del tamaño de la nube entera y se lee de un vistazo.

        El color del hueco sale de '--pastilla-fondo', que define cada clase de
        pastilla, así que acompaña al estado y también al modo visual sin que haya
        que repetir ningún valor aquí.
      */}
      <path
        d="M8.4 18.2h13.1a4.2 4.2 0 0 0 .5-8.4 6.3 6.3 0 0 0-12.1-1.4 4.9 4.9 0 0 0-1.5 9.8Z"
        fill="currentColor"
      />
      <path
        d={trazo}
        fill="none"
        stroke="var(--pastilla-fondo, var(--superficie))"
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  /**
   * Si esta barra es la del selector de materias.
   *
   * Allí hay una fila entera para ella, así que muestra el texto del estado y la
   * recuperación de credenciales. En la barra superior de una materia va compacta
   * y con un juego de botones fijo, para que nada aparezca ni cambie de sitio
   * mientras se escribe.
   */
  enInicio?: boolean
  estadoSesion: EstadoSesion
  estadoNube: EstadoNube
  mensaje: string | null
  pendientes: boolean
  ultimaSync: number | null
  donde: DondeGuardar
  onSincronizar: () => void
  onCerrarSesion: (borrarDatos: boolean) => void
  onUsarOtroToken: () => void
}

export function BarraNube({
  enInicio = false,
  estadoSesion,
  estadoNube,
  mensaje,
  pendientes,
  ultimaSync,
  donde,
  onSincronizar,
  onCerrarSesion,
  onUsarOtroToken,
}: Props) {
  const [confirmando, setConfirmando] = useState(false)
  // Marcado por defecto: la app está pensada para equipos compartidos, donde
  // dejar los apuntes en el navegador es justamente lo que hay que evitar.
  const [borrarDatos, setBorrarDatos] = useState(true)

  if (estadoSesion !== 'abierto') return null

  /*
   * Los textos evitan a propósito dar la sensación de que hay algo que el
   * usuario deba hacer. Todo se sube solo unos segundos después de dejar de
   * escribir, así que "cambios sin subir" solo generaba intranquilidad: mientras
   * hay algo pendiente lo correcto es decir que se está guardando.
   */
  const etiqueta = (() => {
    if (estadoNube === 'sincronizando') return 'Guardando en la nube…'
    if (estadoNube === 'error') return mensaje ?? 'Error de sincronización'
    if (pendientes) return 'Guardando…'
    if (ultimaSync) return `Todo guardado · ${formateadorHora.format(ultimaSync)}`
    return 'Conectado'
  })()

  const estadoIcono: EstadoIcono =
    estadoNube === 'error'
      ? 'error'
      : estadoNube === 'sincronizando'
        ? 'trabajando'
        : pendientes
          ? 'pendiente'
          : 'ok'

  const clase = `pastilla-${estadoIcono === 'pendiente' ? 'aviso' : estadoIcono}`

  return (
    <div className="barra-nube">
      {/* El interruptor de modo visual vive aquí porque esta barra sale en las tres
          pantallas principales. Las dos que no la llevan (flashcards e historial)
          montan el botón por su cuenta. */}
      <BotonModoVisual />

      {/*
        El icono va siempre; el texto solo donde hay sitio de sobra.
    
        En la barra superior el CSS esconde el texto y deja la pastilla del tamaño
        del icono. Así deja de estirarse y encogerse sola: antes cambiaba de ancho
        con cada estado y también con la hora de la última subida, que entra en la
        etiqueta. En el selector de materias, que tiene una fila para ella, el texto
        se sigue viendo.

        'role="status"' con 'aria-label' hace que el estado se anuncie al cambiar
        aunque el texto esté escondido, y el 'title' lo deja a un ratón de
        distancia. La información no se pierde en ningún caso.
      */}
      <span className={`pastilla ${clase}`} role="status" aria-label={etiqueta} title={etiqueta}>
        <IconoNube estado={estadoIcono} />
        <span className="pastilla-texto">{etiqueta}</span>
      </span>

      {/* Ya no hace falta pulsarlo para guardar; queda para forzar una
          comprobación cuando se quiere traer lo de otro dispositivo ya mismo. */}
      <button
        type="button"
        className="boton-secundario pequeno"
        onClick={onSincronizar}
        disabled={estadoNube === 'sincronizando'}
        title="Todo se guarda solo. Esto únicamente comprueba la nube ahora mismo."
      >
        Comprobar ahora
      </button>

      {/*
        Salida cuando el token caduca o se revoca, sin perder los apuntes locales.
    
        Solo en el selector de materias. Es el único botón de esta barra que
        aparece y desaparece según el estado, y en la barra superior de una materia
        eso es un cambio en el borde de donde tienes la vista mientras escribes.
        Dejándolo aquí, la barra de las pantallas de trabajo tiene siempre los
        mismos botones y nada se mueve.

        No se pierde el acceso: el icono de la nube sigue avisando del fallo en
        todas las pantallas, y volver a Cuadernos es un clic.
      */}
      {enInicio && estadoNube === 'error' && (
        <button type="button" className="boton-secundario pequeno" onClick={onUsarOtroToken}>
          Usar otro token
        </button>
      )}

      {confirmando ? (
        <div className="confirmar-salida">
          <p>
            {pendientes
              ? 'Queda algo por subir. Espera unos segundos antes de borrar los datos, o pulsa "Comprobar ahora".'
              : 'Todo está guardado en la nube.'}
          </p>
          <label className="casilla compacta">
            <input
              type="checkbox"
              checked={borrarDatos}
              onChange={(evento) => setBorrarDatos(evento.target.checked)}
            />
            <span>Borrar los apuntes de este computador</span>
          </label>
          <div className="acciones-confirmar">
            <button
              type="button"
              className="boton-secundario pequeno"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="boton-peligro pequeno"
              onClick={() => {
                setConfirmando(false)
                onCerrarSesion(borrarDatos)
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="boton-secundario pequeno"
          onClick={() => setConfirmando(true)}
          title={
            donde === 'dispositivo'
              ? 'El token cifrado está guardado en este dispositivo'
              : 'El token cifrado se borrará al cerrar el navegador'
          }
        >
          Cerrar sesión
        </button>
      )}
    </div>
  )
}
