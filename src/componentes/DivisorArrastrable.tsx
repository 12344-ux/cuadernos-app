import { useRef, type RefObject } from 'react'

/**
 * Límites para que ningún panel se quede inservible de estrecho.
 *
 * La fracción es la del panel izquierdo, que es el mapa. El techo deja que los
 * apuntes se reduzcan a una franja de consulta, y el suelo evita que el mapa quede
 * tan estrecho que no se pueda trabajar en él.
 */
const MINIMO = 0.3
const MAXIMO = 0.78

/** Cuánto se mueve con las flechas del teclado. */
const PASO = 0.02

type Props = {
  /** Fracción del ancho que ocupa el panel izquierdo (el mapa), entre 0 y 1. */
  fraccion: number
  onCambiar: (fraccion: number) => void
  /** Contra qué se mide la posición del puntero. */
  contenedor: RefObject<HTMLElement | null>
  /**
   * Se ha terminado de ajustar. Sirve para reencuadrar los dos lienzos: cambiarles
   * el ancho no mueve su vista, así que sin esto el contenido queda descolocado
   * después de arrastrar.
   */
  onAjustado?: () => void
}

/**
 * Divisor vertical de la vista partida.
 *
 * Usa setPointerCapture en lugar de escuchar en la ventana: al arrastrar, el
 * puntero pasa por encima de los lienzos de React Flow, que capturarían los
 * eventos y dejarían el divisor pegado a medio camino. Con la captura, los
 * movimientos siguen llegando aquí hasta que se suelta.
 */
export function DivisorArrastrable({ fraccion, onCambiar, contenedor, onAjustado }: Props) {
  const arrastrando = useRef(false)

  const acotar = (valor: number) => Math.min(MAXIMO, Math.max(MINIMO, valor))

  return (
    <div
      className="divisor"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar el reparto entre el mapa y los apuntes"
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
        // Solo si venía de un arrastre: un clic suelto no cambia el ancho y no
        // hay nada que reencuadrar.
        const veniaArrastrando = arrastrando.current
        arrastrando.current = false
        document.body.classList.remove('arrastrando-divisor')
        if (veniaArrastrando) onAjustado?.()
      }}
      // Ajustable también sin ratón. Aquí no se avisa en cada pulsación: se
      // reencuadra al soltar la tecla, para no reencuadrar en cada flecha.
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
      onKeyUp={(evento) => {
        if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') onAjustado?.()
      }}
    >
      <span className="divisor-agarre" aria-hidden="true" />
    </div>
  )
}
