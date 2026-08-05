/**
 * Fechas de repaso como día del calendario local, en formato 'AAAA-MM-DD'.
 *
 * No se usa una marca de tiempo a propósito. Los intervalos de SM-2 son días
 * enteros, y "toca hoy" tiene que significar el día del usuario: con una marca
 * de tiempo, una tarjeta repasada a las 23:50 volvería a vencer a las 23:50 del
 * día siguiente en lugar de estar lista por la mañana, y el comportamiento
 * cambiaría al viajar de zona horaria.
 *
 * Como ventaja añadida, comparar dos días es comparar dos cadenas, y la fecha se
 * lee tal cual en el diff de GitHub.
 */

/** Día del calendario local de una fecha concreta. */
function claveDe(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function hoy(): string {
  return claveDe(new Date())
}

/**
 * El día que caerá dentro de N días. Se usa setDate y no aritmética con
 * milisegundos para que los cambios de mes, los años bisiestos y los saltos de
 * horario de verano los resuelva el propio navegador.
 */
export function enDias(dias: number): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return claveDe(fecha)
}

/** Formatea un día para mostrarlo, del estilo "6 ago". */
const formateadorDia = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

export function diaLegible(clave: string): string {
  const [anio, mes, dia] = clave.split('-').map(Number)
  if (!anio || !mes || !dia) return clave
  // Se construye con partes locales para no desplazarse un día por la zona horaria.
  return formateadorDia.format(new Date(anio, mes - 1, dia))
}

/** Convierte un número de días en algo legible: "6 d", "1,2 meses", "2,1 años". */
export function intervaloLegible(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return '1 día'
  if (dias < 30) return `${dias} días`
  if (dias < 365) return `${(dias / 30).toFixed(1).replace('.', ',')} meses`
  return `${(dias / 365).toFixed(1).replace('.', ',')} años`
}
