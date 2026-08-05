import { enDias, hoy } from './fechas'
import type { Programacion, Tarjeta } from './tipos'

/**
 * SM-2, el algoritmo de repetición espaciada que hay detrás de Anki.
 *
 * Las fórmulas están tomadas del texto original de Piotr Woźniak (Optimization
 * of learning, 1990), no de una reimplementación:
 *
 *   I(1) = 1
 *   I(2) = 6
 *   I(n) = I(n-1) * EF          para n > 2, redondeando hacia arriba
 *   EF'  = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))     con EF mínimo 1.3
 *
 * Donde q es la calidad de la respuesta en una escala de 0 a 5, y EF ("E-Factor",
 * aquí 'facilidad') es lo que estira los intervalos de las tarjetas fáciles.
 *
 * Hay un punto donde el texto original se contradice: la regla que actualiza el
 * EF dice "tras cada repaso", pero la que trata los fallos dice que al fallar se
 * reinicia "sin cambiar el E-Factor". Aquí se aplica **siempre**, incluso al
 * fallar, que es lo que hace Anki: así una tarjeta que se falla una y otra vez
 * va espaciándose cada vez más despacio y aparece más a menudo que las fáciles.
 * Con la lectura estricta, fallar no dejaba ninguna huella y la tarjeta volvía a
 * estirarse igual de rápido.
 */

export const FACILIDAD_INICIAL = 2.5
export const FACILIDAD_MINIMA = 1.3

/**
 * Los cuatro botones, con su calidad en la escala 0-5 de SM-2. Cualquier valor
 * por debajo de 3 cuenta como fallo y reinicia la tarjeta.
 */
export const RESPUESTAS = {
  otra_vez: { calidad: 0, nombre: 'Otra vez' },
  dificil: { calidad: 3, nombre: 'Difícil' },
  bien: { calidad: 4, nombre: 'Bien' },
  facil: { calidad: 5, nombre: 'Fácil' },
} as const

export type Respuesta = keyof typeof RESPUESTAS

/** El orden en que se muestran los botones, de peor a mejor. */
export const ORDEN_RESPUESTAS: Respuesta[] = ['otra_vez', 'dificil', 'bien', 'facil']

export function programacionInicial(): Programacion {
  return {
    intervalo: 0,
    facilidad: FACILIDAD_INICIAL,
    repeticiones: 0,
    proximoRepaso: null,
    ultimoRepaso: null,
    lapsos: 0,
  }
}

function nuevaFacilidad(facilidad: number, calidad: number): number {
  const ajustada = facilidad + (0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02))
  // Por debajo de 1.3 las tarjetas se repiten de forma insoportable; el propio
  // Woźniak señala que ese suelo mejoró mucho el rendimiento del método.
  return Math.max(FACILIDAD_MINIMA, Math.round(ajustada * 1000) / 1000)
}

/**
 * Días hasta el próximo repaso si se contesta con esa respuesta.
 *
 * El intervalo se calcula con la facilidad vigente en este repaso; la facilidad
 * nueva se guarda para la próxima vez.
 */
export function intervaloSi(previa: Programacion, respuesta: Respuesta): number {
  if (RESPUESTAS[respuesta].calidad < 3) return 0

  const repeticiones = previa.repeticiones + 1
  if (repeticiones === 1) return 1
  if (repeticiones === 2) return 6
  return Math.max(1, Math.ceil(previa.intervalo * previa.facilidad))
}

/** Aplica un repaso y devuelve la programación resultante. */
export function repasar(previa: Programacion, respuesta: Respuesta): Programacion {
  const { calidad } = RESPUESTAS[respuesta]
  const facilidad = nuevaFacilidad(previa.facilidad, calidad)
  const ahora = Date.now()

  if (calidad < 3) {
    return {
      intervalo: 0,
      facilidad,
      repeticiones: 0,
      // Sigue venciendo hoy: vuelve a salir en esta misma sesión, y si se cierra
      // la app antes de acertarla, mañana continúa pendiente.
      proximoRepaso: hoy(),
      ultimoRepaso: ahora,
      lapsos: previa.lapsos + 1,
    }
  }

  const intervalo = intervaloSi(previa, respuesta)
  return {
    intervalo,
    facilidad,
    repeticiones: previa.repeticiones + 1,
    proximoRepaso: enDias(intervalo),
    ultimoRepaso: ahora,
    lapsos: previa.lapsos,
  }
}

export function esNueva(programacion: Programacion): boolean {
  return programacion.proximoRepaso === null
}

/** Una tarjeta toca hoy si nunca se ha visto o si su día ya llegó (o pasó). */
export function tocaHoy(programacion: Programacion, dia: string = hoy()): boolean {
  return programacion.proximoRepaso === null || programacion.proximoRepaso <= dia
}

export type Recuento = { pendientes: number; nuevas: number; total: number }

export function contar(tarjetas: Tarjeta[], dia: string = hoy()): Recuento {
  let pendientes = 0
  let nuevas = 0

  for (const tarjeta of tarjetas) {
    if (esNueva(tarjeta.programacion)) {
      nuevas += 1
    } else if (tocaHoy(tarjeta.programacion, dia)) {
      pendientes += 1
    }
  }

  return { pendientes, nuevas, total: pendientes + nuevas }
}

/**
 * Las tarjetas que toca estudiar hoy, en el orden en que se van a mostrar.
 *
 * Primero las que ya se han visto, empezando por las más atrasadas, y al final
 * las nuevas. Sin límite diario de nuevas: si un mazo trae doscientas, se
 * ofrecen las doscientas y cada uno para cuando quiere.
 */
export function colaDeHoy(tarjetas: Tarjeta[], dia: string = hoy()): Tarjeta[] {
  const vistas = tarjetas
    .filter((t) => !esNueva(t.programacion) && tocaHoy(t.programacion, dia))
    .sort((a, b) => (a.programacion.proximoRepaso ?? '').localeCompare(b.programacion.proximoRepaso ?? ''))

  const nuevas = tarjetas
    .filter((t) => esNueva(t.programacion))
    .sort((a, b) => a.creado - b.creado)

  return [...vistas, ...nuevas]
}
