import { useModoVisual } from '../modo/visual'

/**
 * El interruptor entre el modo profesional y el cómodo.
 *
 * Lleva el nombre del modo escrito al lado del icono, no solo el icono: el modo
 * cómodo existe justamente para quien no distingue bien lo que hay en pantalla, y
 * un botón que solo se entiende por su dibujo sería el primero en fallar.
 *
 * El texto dice el modo que está puesto, y el título dice a cuál se cambia. Un
 * botón que anuncia el estado y otro que anuncia la acción son dos convenciones
 * distintas y ninguna es obvia a solas; juntas no hay duda.
 */
export function BotonModoVisual() {
  const { esComodo, alternar } = useModoVisual()

  return (
    <button
      type="button"
      className={`boton-modo${esComodo ? ' es-comodo' : ''}`}
      onClick={alternar}
      aria-pressed={esComodo}
      title={
        esComodo
          ? 'Cambiar al modo profesional (para pantallas de buena calidad)'
          : 'Cambiar al modo cómodo (para pantallas que cansan la vista)'
      }
    >
      {/* Un monitor. Sin detalle fino: a este tamaño y en un panel malo, un icono
          con muchas líneas se convierte en una mancha. */}
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect
          x="2.5"
          y="4"
          width="19"
          height="13"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M9 20.5h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {esComodo ? 'Modo cómodo' : 'Modo profesional'}
    </button>
  )
}
