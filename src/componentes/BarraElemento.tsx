import {
  ALINEACIONES,
  FUENTES,
  PALETA,
  TAMANOS,
  type Alineacion,
  type ColorId,
  type DatosNodo,
  type Fuente,
  type Tamano,
} from '../tipos'

const CLAVES_COLOR = Object.keys(PALETA) as ColorId[]
const CLAVES_FUENTE = Object.keys(FUENTES) as Fuente[]
const CLAVES_TAMANO = Object.keys(TAMANOS) as Tamano[]
const CLAVES_ALINEACION = Object.keys(ALINEACIONES) as Alineacion[]

/** Anchos de las cuatro rayas del icono de alineación. */
const RAYAS = [12, 7, 12, 7]

function IconoAlinear({ alineacion }: { alineacion: Alineacion }) {
  return (
    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true" focusable="false">
      {RAYAS.map((ancho, indice) => {
        const y = 1.6 + indice * 3
        const x =
          alineacion === 'izquierda' ? 1 : alineacion === 'centro' ? (14 - ancho) / 2 : 13 - ancho
        return (
          <line
            key={indice}
            x1={x}
            y1={y}
            x2={x + ancho}
            y2={y}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

type PropsBarraElemento = {
  data: DatosNodo
  esPostit: boolean
  onCambiar: (cambio: Partial<DatosNodo>) => void
  onEliminar: () => void
}

/**
 * Barra flotante del cuadro: todo lo que afecta al elemento completo.
 *
 * Ya no hay botón de "Resaltar". Ahora que se puede resaltar texto concreto con
 * un marcador, tener además un resaltado que pinta el cuadro entero serían dos
 * cosas distintas con el mismo nombre.
 */
export function BarraElemento({ data, esPostit, onCambiar, onEliminar }: PropsBarraElemento) {
  const nombreElemento = esPostit ? 'post-it' : 'cuadro'

  return (
    <div className="barra-nodo">
      {CLAVES_COLOR.map((clave) => (
        <button
          key={clave}
          type="button"
          className={`muestra-color${data.color === clave ? ' activa' : ''}`}
          style={{ background: PALETA[clave].fondo, borderColor: PALETA[clave].borde }}
          title={PALETA[clave].nombre}
          aria-label={`Color ${PALETA[clave].nombre}`}
          onClick={() => onCambiar({ color: clave })}
        />
      ))}

      <span className="separador-barra" />

      <select
        className={`selector-fuente fuente-${data.fuente}`}
        value={data.fuente}
        title={`Tipografía del ${nombreElemento}`}
        aria-label={`Tipografía del ${nombreElemento}`}
        onChange={(evento) => onCambiar({ fuente: evento.target.value as Fuente })}
      >
        {CLAVES_FUENTE.map((clave) => (
          <option key={clave} value={clave} className={`fuente-${clave}`}>
            {FUENTES[clave].nombre}
          </option>
        ))}
      </select>

      <span className="separador-barra" />

      {CLAVES_TAMANO.map((clave) => (
        <button
          key={clave}
          type="button"
          className={`boton-barra boton-tamano es-${clave}${
            data.tamano === clave ? ' activo' : ''
          }`}
          title={`Tamaño: ${TAMANOS[clave].nombre}`}
          aria-label={`Tamaño ${TAMANOS[clave].nombre}`}
          aria-pressed={data.tamano === clave}
          onClick={() => onCambiar({ tamano: clave })}
        >
          {TAMANOS[clave].abreviatura}
        </button>
      ))}

      <span className="separador-barra" />

      {CLAVES_ALINEACION.map((clave) => (
        <button
          key={clave}
          type="button"
          className={`boton-barra boton-icono${data.alineacion === clave ? ' activo' : ''}`}
          title={ALINEACIONES[clave].nombre}
          aria-label={ALINEACIONES[clave].nombre}
          aria-pressed={data.alineacion === clave}
          onClick={() => onCambiar({ alineacion: clave })}
        >
          <IconoAlinear alineacion={clave} />
        </button>
      ))}

      <span className="separador-barra" />

      <button
        type="button"
        className="boton-barra peligro"
        title={`Eliminar este ${nombreElemento}`}
        onClick={onEliminar}
      >
        Eliminar
      </button>
    </div>
  )
}
