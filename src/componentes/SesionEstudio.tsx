import { useCallback, useEffect, useMemo, useState } from 'react'
import { enDias, intervaloLegible } from '../tarjetas/fechas'
import {
  ORDEN_RESPUESTAS,
  RESPUESTAS,
  colaDeHoy,
  intervaloSi,
  type Respuesta,
} from '../tarjetas/sm2'
import type { Mazo } from '../tarjetas/tipos'
import { htmlEstaVacio, sanearHtml } from '../texto/saneador'

type Props = {
  mazo: Mazo
  onResponder: (idTarjeta: string, respuesta: Respuesta) => void
  onSalir: () => void
}

/** Atajos de teclado: 1-4 responden, espacio o Enter voltean. */
const TECLAS: Record<string, Respuesta> = {
  '1': 'otra_vez',
  '2': 'dificil',
  '3': 'bien',
  '4': 'facil',
}

function Cara({ html, vacio }: { html: string; vacio: string }) {
  const seguro = useMemo(() => sanearHtml(html), [html])
  if (htmlEstaVacio(seguro)) return <p className="cara-vacia">{vacio}</p>
  return <div className="texto-con-formato" dangerouslySetInnerHTML={{ __html: seguro }} />
}

export function SesionEstudio({ mazo, onResponder, onSalir }: Props) {
  /*
   * La cola se calcula una sola vez al empezar. Si se recalculara en cada
   * render, contestar una tarjeta la sacaría de la lista al instante y los
   * índices bailarían: la sesión del día es una foto fija del momento de entrar.
   */
  const [cola, setCola] = useState<string[]>(() => colaDeHoy(mazo.tarjetas).map((t) => t.id))
  const [posicion, setPosicion] = useState(0)
  const [volteada, setVolteada] = useState(false)
  const [repasadas, setRepasadas] = useState(0)

  const terminada = posicion >= cola.length
  const tarjeta = terminada ? null : mazo.tarjetas.find((t) => t.id === cola[posicion])

  const responder = useCallback(
    (respuesta: Respuesta) => {
      if (!tarjeta) return
      onResponder(tarjeta.id, respuesta)

      // "Otra vez" la devuelve al final de la cola: vuelve a salir en esta misma
      // sesión, que es lo que se espera de una tarjeta fallada.
      if (respuesta === 'otra_vez') setCola((previa) => [...previa, tarjeta.id])

      setRepasadas((n) => n + 1)
      setVolteada(false)
      setPosicion((p) => p + 1)
    },
    [tarjeta, onResponder],
  )

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (terminada) return
      if (!volteada) {
        if (evento.key === ' ' || evento.key === 'Enter') {
          evento.preventDefault()
          setVolteada(true)
        }
        return
      }
      const respuesta = TECLAS[evento.key]
      if (respuesta) {
        evento.preventDefault()
        responder(respuesta)
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [terminada, volteada, responder])

  if (terminada) {
    const manana = enDias(1)
    const paraManana = mazo.tarjetas.filter((t) => t.programacion.proximoRepaso === manana).length

    return (
      <div className="estudio-fin">
        <p className="estudio-fin-marca">Sesión terminada</p>
        <h2>
          {repasadas === 0
            ? 'No había nada que repasar'
            : `${repasadas} ${repasadas === 1 ? 'repaso' : 'repasos'} en «${mazo.nombre}»`}
        </h2>
        <p className="estudio-fin-detalle">
          {paraManana > 0
            ? `Mañana te tocan ${paraManana} ${paraManana === 1 ? 'tarjeta' : 'tarjetas'}.`
            : 'Mañana no te toca ninguna de este mazo.'}
        </p>
        <button type="button" className="boton-estudio-principal" onClick={onSalir}>
          Volver a los mazos
        </button>
      </div>
    )
  }

  if (!tarjeta) {
    // La tarjeta se borró desde otro dispositivo en mitad de la sesión.
    return (
      <div className="estudio-fin">
        <h2>Esa tarjeta ya no existe</h2>
        <button
          type="button"
          className="boton-estudio-principal"
          onClick={() => setPosicion((p) => p + 1)}
        >
          Continuar
        </button>
      </div>
    )
  }

  return (
    <div className="estudio">
      <div className="estudio-progreso">
        <span>
          {posicion + 1} de {cola.length}
        </span>
        <div className="barra-progreso" aria-hidden="true">
          <span style={{ width: `${(posicion / cola.length) * 100}%` }} />
        </div>
      </div>

      <div className="tarjeta-escena">
        <div className={`tarjeta-3d${volteada ? ' volteada' : ''}`}>
          <div className="cara cara-frente">
            <Cara html={tarjeta.anverso} vacio="(anverso vacío)" />
          </div>
          <div className="cara cara-dorso">
            <Cara html={tarjeta.reverso} vacio="(reverso vacío)" />
          </div>
        </div>
      </div>

      {volteada ? (
        <div className="botones-respuesta">
          {ORDEN_RESPUESTAS.map((respuesta, indice) => {
            const dias = intervaloSi(tarjeta.programacion, respuesta)
            return (
              <button
                key={respuesta}
                type="button"
                className={`boton-respuesta es-${respuesta}`}
                onClick={() => responder(respuesta)}
              >
                <span className="respuesta-nombre">{RESPUESTAS[respuesta].nombre}</span>
                <span className="respuesta-plazo">
                  {respuesta === 'otra_vez' ? 'ahora' : intervaloLegible(dias)}
                </span>
                <span className="respuesta-tecla" aria-hidden="true">
                  {indice + 1}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <button
          type="button"
          className="boton-estudio-principal"
          onClick={() => setVolteada(true)}
        >
          Ver respuesta
          <span className="pista-tecla">espacio</span>
        </button>
      )}
    </div>
  )
}
