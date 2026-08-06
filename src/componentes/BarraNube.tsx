import { useState } from 'react'
import { BotonModoVisual } from './BotonModoVisual'
import type { EstadoNube, EstadoSesion } from '../hooks/useNube'
import type { DondeGuardar } from '../nube/credenciales'

const formateadorHora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

type Props = {
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

  const clase =
    estadoNube === 'error'
      ? 'pastilla-error'
      : estadoNube === 'sincronizando'
        ? 'pastilla-trabajando'
        : pendientes
          ? 'pastilla-aviso'
          : 'pastilla-ok'

  return (
    <div className="barra-nube">
      {/* El interruptor de modo visual vive aquí porque esta barra sale en las tres
          pantallas principales. Las dos que no la llevan (flashcards e historial)
          montan el botón por su cuenta. */}
      <BotonModoVisual />

      <span className={`pastilla ${clase}`} title={mensaje ?? undefined}>
        {etiqueta}
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

      {/* Salida cuando el token caduca o se revoca, sin perder los apuntes locales. */}
      {estadoNube === 'error' && (
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
