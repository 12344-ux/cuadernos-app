import { useRef, type RefObject } from 'react'

/** Límites para que ningún panel se quede inservible de estrecho. */
const MINIMO = 0.18
const MAXIMO = 0.7

/** Cuánto se mueve con las flechas del teclado. */
const PASO = 0.02

type Props = {
  /** Fracción del ancho que ocupa el panel izquierdo, entre 0 y 1. */
  fraccion: number
  onCambiar: (fraccion: number) => void
  /** Contra qué se mide la posición del puntero. */
  contenedor: RefObject<HTMLElement | null>
}

/**
 * Divisor vertical de la vista partida.
 *
 * Usa setPointerCapture en lugar de escuchar en la ventana: al arrastrar, el
 * puntero pasa por encima de los lienzos de React Flow, que capturarían los
 * eventos y dejarían el divisor pegado a medio camino. Con la captura, los
 * movimientos siguen llegando aquí hasta que se suelta.
 */
export function DivisorArrastrable({ fraccion, onCambiar, contenedor }: Props) {
  const arrastrando = useRef(false)

  const acotar = (valor: number) => Math.min(MAXIMO, Math.max(MINIMO, valor))

  return (
    <div
      className="divisor"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar el ancho de los apuntes"
      aria-valuenow={Math.round(fraccion * 100)}
      aria-valuemin={Math.round(MINIMO * 100)}
      aria-valuemax={Math.round(MAXIMO * 100)}
      tabIndex={0}
      onPointerDown={(evento) => {
        try {
          evento.currentTarget.setPointerCapture(evento.pointerId)
        } catch {
          // Si el navegador ya no considera activo ese puntero, se sigue sin
          // captura: el arrastre funciona igual mientras no salga de los lienzos.
        }
        arrastrando.current = true
        // Evita que al arrastrar se seleccione el texto de los apuntes.
        document.body.classList.add('arrastrando-divisor')
      }}
      onPointerMove={(evento) => {
        if (!arrastrando.current) return
        const caja = contenedor.current?.getBoundingClientRect()
        if (!caja || caja.width === 0) return
        onCambiar(acotar((evento.clientX - caja.left) / caja.width))
      }}
      onPointerUp={(evento) => {
        if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
          evento.currentTarget.releasePointerCapture(evento.pointerId)
        }
        arrastrando.current = false
        document.body.classList.remove('arrastrando-divisor')
      }}
      // Ajustable también sin ratón.
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowLeft') {
          evento.preventDefault()
          onCambiar(acotar(fraccion - PASO))
        }
        if (evento.key === 'ArrowRight') {
          evento.preventDefault()
          onCambiar(acotar(fraccion + PASO))
        }
      }}
    >
      <span className="divisor-agarre" aria-hidden="true" />
    </div>
  )
}
