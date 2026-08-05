import { useMemo, useState } from 'react'
import { diaLegible } from '../fechas'
import { contar, esNueva } from '../tarjetas/sm2'
import type { Mazo, Tarjeta } from '../tarjetas/tipos'
import { htmlATextoLlano } from '../texto/saneador'
import { EditorTarjeta } from './EditorTarjeta'

type Props = {
  mazo: Mazo
  onAnadir: (anverso: string, reverso: string) => void
  onEditar: (idTarjeta: string, anverso: string, reverso: string) => void
  onEliminar: (idTarjeta: string) => void
  onVolver: () => void
}

/** Vista previa en texto llano: en la lista no interesa el formato, solo saber cuál es. */
function Extracto({ html, vacio }: { html: string; vacio: string }) {
  const texto = useMemo(() => htmlATextoLlano(html), [html])

  if (!texto) return <span className="extracto-vacio">{vacio}</span>
  return <span>{texto}</span>
}

function EstadoTarjeta({ tarjeta }: { tarjeta: Tarjeta }) {
  if (esNueva(tarjeta.programacion)) {
    return <span className="pastilla pastilla-nueva">Nueva</span>
  }
  const { proximoRepaso, facilidad } = tarjeta.programacion
  return (
    <span className="pastilla" title={`Facilidad ${facilidad.toFixed(2)}`}>
      {proximoRepaso ? diaLegible(proximoRepaso) : '—'}
    </span>
  )
}

export function ListaTarjetas({ mazo, onAnadir, onEditar, onEliminar, onVolver }: Props) {
  const [anadiendo, setAnadiendo] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const recuento = contar(mazo.tarjetas)

  const tarjetaEditada = mazo.tarjetas.find((t) => t.id === editando)

  return (
    <div className="panel-estudio">
      <header className="cabecera-mazo">
        <button type="button" className="boton-secundario" onClick={onVolver}>
          Mazos
        </button>
        <div>
          <h2>{mazo.nombre}</h2>
          <p className="cabecera-mazo-detalle">
            {mazo.tarjetas.length} {mazo.tarjetas.length === 1 ? 'tarjeta' : 'tarjetas'} ·{' '}
            {recuento.total} para hoy
          </p>
        </div>
        <div className="espaciador" />
        {!anadiendo && !tarjetaEditada && (
          <button
            type="button"
            className="boton-primario"
            onClick={() => setAnadiendo(true)}
          >
            + Nueva tarjeta
          </button>
        )}
      </header>

      {anadiendo && (
        <EditorTarjeta
          etiquetaGuardar="Añadir tarjeta"
          onCancelar={() => setAnadiendo(false)}
          onGuardar={(anverso, reverso) => {
            onAnadir(anverso, reverso)
            setAnadiendo(false)
          }}
        />
      )}

      {tarjetaEditada && (
        <EditorTarjeta
          // La 'key' fuerza a recrear los editores al cambiar de tarjeta: sin
          // ella, Tiptap conservaría el contenido de la anterior.
          key={tarjetaEditada.id}
          anversoInicial={tarjetaEditada.anverso}
          reversoInicial={tarjetaEditada.reverso}
          etiquetaGuardar="Guardar cambios"
          onCancelar={() => setEditando(null)}
          onGuardar={(anverso, reverso) => {
            onEditar(tarjetaEditada.id, anverso, reverso)
            setEditando(null)
          }}
        />
      )}

      {mazo.tarjetas.length === 0 ? (
        <p className="vacio">
          Este mazo está vacío. Añade la primera tarjeta con el botón de arriba.
        </p>
      ) : (
        <ul className="lista-tarjetas">
          {mazo.tarjetas.map((tarjeta) => (
            <li key={tarjeta.id}>
              <div className="tarjeta-fila-textos">
                <div className="tarjeta-fila-anverso">
                  <Extracto html={tarjeta.anverso} vacio="(sin pregunta)" />
                </div>
                <div className="tarjeta-fila-reverso">
                  <Extracto html={tarjeta.reverso} vacio="(sin respuesta)" />
                </div>
              </div>
              <EstadoTarjeta tarjeta={tarjeta} />
              <div className="acciones-fila">
                <button
                  type="button"
                  className="boton-discreto"
                  onClick={() => {
                    setAnadiendo(false)
                    setEditando(tarjeta.id)
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="boton-discreto peligro"
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta tarjeta? No se puede deshacer.')) {
                      onEliminar(tarjeta.id)
                    }
                  }}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
