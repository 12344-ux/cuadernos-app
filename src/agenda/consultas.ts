import { diaDe, hoy } from '../fechas'
import type { Tarea } from './tipos'

/** Las tareas que existen de verdad: las lápidas no cuentan para nada. */
export function tareasVivas(tareas: Tarea[]): Tarea[] {
  return tareas.filter((tarea) => !tarea.eliminada)
}

/** Se completó en el día indicado. */
function completadaEnElDia(tarea: Tarea, dia: string): boolean {
  return tarea.fechaCompletada !== null && diaDe(tarea.fechaCompletada) === dia
}

/**
 * Una tarea aparece en la agenda de hoy si su día ya llegó y sigue pendiente, o
 * si se completó hoy.
 *
 * La primera mitad es lo que hace que nada se pierda: una tarea del día 2 sin
 * hacer sigue saliendo el día 5, el 6 y el 20 hasta que se complete. La segunda
 * mitad es la que deja la tarea tachada a la vista el resto del día, por si se
 * marcó por error.
 */
export function visibleHoy(tarea: Tarea, dia: string = hoy()): boolean {
  if (tarea.eliminada) return false
  if (!tarea.completada) return tarea.fecha <= dia
  return completadaEnElDia(tarea, dia)
}

/** Su día pasó y sigue sin hacerse. */
export function estaAtrasada(tarea: Tarea, dia: string = hoy()): boolean {
  return !tarea.completada && tarea.fecha < dia
}

/**
 * Las tareas de hoy, en el orden en que se muestran: primero lo pendiente
 * (empezando por lo más atrasado) y al final lo que ya se ha tachado.
 */
export function tareasDeHoy(tareas: Tarea[], dia: string = hoy()): Tarea[] {
  return tareas
    .filter((tarea) => visibleHoy(tarea, dia))
    .sort((a, b) => {
      if (a.completada !== b.completada) return a.completada ? 1 : -1
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha)
      return a.fechaCreacion - b.fechaCreacion
    })
}

export function pendientesDeHoy(tareas: Tarea[], dia: string = hoy()): number {
  return tareas.filter((tarea) => visibleHoy(tarea, dia) && !tarea.completada).length
}

/** Tareas programadas para más adelante, que hoy no se ven. */
export function proximas(tareas: Tarea[], dia: string = hoy()): Tarea[] {
  return tareasVivas(tareas)
    .filter((tarea) => !tarea.completada && tarea.fecha > dia)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export type GrupoDeDia = { fecha: string; tareas: Tarea[] }

/**
 * El historial: lo ya completado, agrupado por el día en que tocaba y de lo más
 * reciente a lo más antiguo.
 */
export function historialPorDia(tareas: Tarea[]): GrupoDeDia[] {
  const completadas = tareasVivas(tareas).filter((tarea) => tarea.completada)

  const porFecha = new Map<string, Tarea[]>()
  for (const tarea of completadas) {
    const grupo = porFecha.get(tarea.fecha)
    if (grupo) grupo.push(tarea)
    else porFecha.set(tarea.fecha, [tarea])
  }

  return [...porFecha.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fecha, delDia]) => ({
      fecha,
      tareas: delDia.sort((a, b) => (b.fechaCompletada ?? 0) - (a.fechaCompletada ?? 0)),
    }))
}
