import { useState } from 'react'
import { REPO_DATOS } from '../nube/configuracion'
import { ErrorContrasena, LONGITUD_MINIMA_CONTRASENA } from '../nube/credenciales'
import type { EstadoSesion } from '../hooks/useNube'

type Props = {
  estado: Extract<EstadoSesion, 'sin-configurar' | 'bloqueado'>
  onConectar: (token: string, contrasena: string, recordar: boolean) => Promise<void>
  onDesbloquear: (contrasena: string) => Promise<void>
  onUsarSinConectar: () => void
  onOlvidarCredencial: () => void
}

export function PantallaAcceso({
  estado,
  onConectar,
  onDesbloquear,
  onUsarSinConectar,
  onOlvidarCredencial,
}: Props) {
  const [token, setToken] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [recordar, setRecordar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bloqueado = estado === 'bloqueado'

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setError(null)

    if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
      setError(`La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`)
      return
    }

    setTrabajando(true)
    try {
      if (bloqueado) {
        await onDesbloquear(contrasena)
      } else {
        await onConectar(token, contrasena, recordar)
      }
    } catch (causa) {
      if (causa instanceof ErrorContrasena) {
        setError('La contraseña no es correcta.')
      } else {
        setError(causa instanceof Error ? causa.message : 'No se pudo conectar.')
      }
    } finally {
      setTrabajando(false)
      setContrasena('')
    }
  }

  return (
    <main className="acceso">
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <h1>Cuadernos</h1>
        <p className="subtitulo">
          {bloqueado
            ? 'Escribe tu contraseña para descifrar el acceso a tus apuntes.'
            : 'Conecta la app con tu repositorio privado para sincronizar entre dispositivos.'}
        </p>

        {!bloqueado && (
          <label className="campo">
            <span>Token de acceso de GitHub</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_…"
              value={token}
              onChange={(evento) => setToken(evento.target.value)}
            />
            <small>
              Fine-grained, con acceso solo a <code>{REPO_DATOS.nombre}</code> y permiso{' '}
              <code>Contents: read and write</code>. Nunca uses un token clásico con permisos
              sobre toda la cuenta.
            </small>
          </label>
        )}

        <label className="campo">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete={bloqueado ? 'current-password' : 'new-password'}
            autoFocus
            placeholder={`Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`}
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
          />
          {!bloqueado && (
            <small>
              Cifra el token en este navegador. No se envía a ningún sitio y no se puede
              recuperar: si la olvidas, tendrás que volver a pegar el token.
            </small>
          )}
        </label>

        {!bloqueado && (
          <label className="casilla">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(evento) => setRecordar(evento.target.checked)}
            />
            <span>
              Recordar en este dispositivo
              <small>
                Déjalo sin marcar en computadores compartidos: así el token cifrado se borra al
                cerrar el navegador.
              </small>
            </span>
          </label>
        )}

        {error && <p className="error-acceso">{error}</p>}

        <button type="submit" className="boton-primario" disabled={trabajando}>
          {trabajando
            ? bloqueado
              ? 'Descifrando…'
              : 'Comprobando el token…'
            : bloqueado
              ? 'Entrar'
              : 'Conectar y sincronizar'}
        </button>

        {bloqueado && (
          <button type="button" className="enlace" onClick={onOlvidarCredencial}>
            Usar otro token
          </button>
        )}

        <button type="button" className="enlace" onClick={onUsarSinConectar}>
          Trabajar solo en este dispositivo
        </button>

        {trabajando && !bloqueado && (
          <p className="nota-acceso">
            Derivar la clave lleva un momento a propósito: son 600.000 iteraciones para que una
            contraseña robada no se pueda probar a gran velocidad.
          </p>
        )}
      </form>
    </main>
  )
}
