import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { PALETA, PALETA_COMODA, type Paleta } from '../tipos'

/**
 * Los dos modos visuales de la aplicación.
 *
 * 'profesional' es el diseño de siempre: tonos suaves, bordes finos, sombras
 * discretas. Está pensado para una pantalla que reproduzca bien esos matices.
 *
 * 'comodo' está pensado para lo contrario: paneles de portátil baratos, TN
 * lavados, proyectores, monitores viejos. Ahí los tintes suaves se ven todos
 * iguales, los bordes de un píxel salen borrosos y el texto fino cansa. Sube el
 * cuerpo de letra, engorda los bordes, satura los colores y quita las sutilezas
 * que en esas pantallas no aportan nada y solo ensucian.
 */
export type ModoVisual = 'profesional' | 'comodo'

export const MODO_POR_DEFECTO: ModoVisual = 'profesional'

const CLAVE = 'cuadernos:modo-visual'

/**
 * La preferencia vive en localStorage y **no** en el índice que se sincroniza.
 *
 * Es a propósito: depende de la pantalla que tenga delante cada dispositivo, no
 * de la persona. Quien trabaja en un portátil malo y en un monitor bueno quiere
 * un modo distinto en cada uno, y sincronizarla haría justo lo contrario.
 */
export function leerModo(): ModoVisual {
  try {
    return localStorage.getItem(CLAVE) === 'comodo' ? 'comodo' : MODO_POR_DEFECTO
  } catch {
    // Modo privado con el almacenamiento bloqueado: se sigue con el de partida.
    return MODO_POR_DEFECTO
  }
}

function guardarModo(modo: ModoVisual): void {
  try {
    localStorage.setItem(CLAVE, modo)
  } catch (error) {
    console.error('No se pudo guardar el modo visual', error)
  }
}

/**
 * Escribe el modo en el <html>, que es de donde cuelgan los tokens del CSS.
 *
 * Se exporta para poder llamarla desde main.tsx antes del primer render: si se
 * aplicara solo desde un efecto, la primera pintura saldría en modo profesional
 * y se vería el cambio de golpe al arrancar.
 */
export function aplicarModoAlDocumento(modo: ModoVisual): void {
  document.documentElement.dataset.modo = modo
}

type Contexto = {
  modo: ModoVisual
  esComodo: boolean
  alternar: () => void
}

const ContextoModo = createContext<Contexto | null>(null)

export function ProveedorModoVisual({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<ModoVisual>(() => leerModo())

  // Mantiene el atributo del <html> al día. En el primer render no cambia nada,
  // porque main.tsx ya lo dejó puesto con el mismo valor.
  useEffect(() => {
    aplicarModoAlDocumento(modo)
  }, [modo])

  const alternar = useCallback(() => {
    setModo((previo) => {
      const siguiente: ModoVisual = previo === 'comodo' ? 'profesional' : 'comodo'
      guardarModo(siguiente)
      return siguiente
    })
  }, [])

  return (
    <ContextoModo.Provider value={{ modo, esComodo: modo === 'comodo', alternar }}>
      {children}
    </ContextoModo.Provider>
  )
}

export function useModoVisual(): Contexto {
  const contexto = useContext(ContextoModo)
  if (!contexto) throw new Error('useModoVisual necesita estar dentro de ProveedorModoVisual')
  return contexto
}

/**
 * La paleta de colores del modo activo.
 *
 * La paleta vive en TypeScript y no en variables CSS porque hay dos sitios que
 * necesitan el valor como cadena y no como 'var(...)': el minimapa de React
 * Flow, que lo recibe por una prop, y las muestras del selector de color. Si el
 * cambio de modo se hiciera solo en CSS, las muestras seguirían enseñando los
 * tonos del modo profesional mientras el lienzo pintaba los del cómodo.
 */
export function usarPaleta(): Paleta {
  return useModoVisual().esComodo ? PALETA_COMODA : PALETA
}
