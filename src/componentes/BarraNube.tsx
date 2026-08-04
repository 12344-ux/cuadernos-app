import { useState } from 'react'
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
  onConectar: () => void
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
  onConectar,
}: Props) {
  const [confirmando, setConfirmando] = useState(false)
  // Marcado por defecto: la app está pensada para equipos compartidos, donde
  // dejar los apuntes en el navegador es justamente lo que hay que evitar.
  const [borrarDatos, setBorrarDatos] = useState(true)

  if (estadoSesion === 'local') {
    return (
      <div className="barra-nube">
        <span className="pastilla pastilla-aviso">Solo en este dispositivo</span>
        <button type="button" className="boton-secundario pequeno" onClick={onConectar}>
          Conectar con la nube
        </button>
      </div>
    )
  }

  if (estadoSesion !== 'abierto') return null

  const etiqueta = (() => {
    if (estadoNube === 'sincronizando') return 'Sincronizando…'
    if (estadoNube === 'error') return mensaje ?? 'Error de sincronización'
    if (pendientes) return 'Cambios sin subir'
    if (ultimaSync) return `Al día · ${formateadorHora.format(ultimaSync)}`
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
      <span className={`pastilla ${clase}`} title={mensaje ?? undefined}>
        {etiqueta}
      </span>

      <button
        type="button"
        className="boton-secundario pequeno"
        onClick={onSincronizar}
        disabled={estadoNube === 'sincronizando'}
      >
        Guardar en la nube
      </button>

      {confirmando ? (
        <div className="confirmar-salida">
          <p>
            {pendientes
              ? 'Tienes cambios sin subir. Si borras los datos ahora se perderán.'
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
