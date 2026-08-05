/**
 * Estado local de la sincronización: qué sha vimos por última vez de cada
 * archivo remoto y qué materias tienen cambios sin subir.
 *
 * El sha es la pieza clave del control de conflictos: GitHub solo acepta una
 * escritura si el sha que enviamos sigue siendo el actual, así que guardarlo es
 * lo que permite distinguir "nadie tocó esto" de "otro dispositivo escribió".
 */

const CLAVE_SHAS = 'cuadernos:shas'
const CLAVE_PENDIENTES = 'cuadernos:pendientes'
/**
 * Los mazos llevan su propia lista de pendientes en lugar de compartir la de los
 * mapas. Podrían haberse mezclado poniéndoles un prefijo, pero eso cambiaría el
 * significado de lo que ya hay guardado en los dispositivos y habría que migrarlo.
 */
const CLAVE_PENDIENTES_MAZOS = 'cuadernos:pendientes-mazos'
const CLAVE_PENDIENTE_AGENDA = 'cuadernos:pendiente-agenda'
const CLAVE_ULTIMA_SYNC = 'cuadernos:ultima-sincronizacion'

function leerJson<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? (JSON.parse(crudo) as T) : porDefecto
  } catch {
    return porDefecto
  }
}

function escribirJson(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch (error) {
    console.error(`No se pudo guardar ${clave}`, error)
  }
}

export function leerShas(): Record<string, string> {
  return leerJson<Record<string, string>>(CLAVE_SHAS, {})
}

export function recordarSha(ruta: string, sha: string): void {
  const shas = leerShas()
  shas[ruta] = sha
  escribirJson(CLAVE_SHAS, shas)
}

export function olvidarSha(ruta: string): void {
  const shas = leerShas()
  delete shas[ruta]
  escribirJson(CLAVE_SHAS, shas)
}

/** Materias con cambios locales que aún no están en la nube. */
export function leerPendientes(): string[] {
  return leerJson<string[]>(CLAVE_PENDIENTES, [])
}

export function marcarPendiente(idCuaderno: string): void {
  const pendientes = new Set(leerPendientes())
  pendientes.add(idCuaderno)
  escribirJson(CLAVE_PENDIENTES, [...pendientes])
}

export function limpiarPendiente(idCuaderno: string): void {
  escribirJson(
    CLAVE_PENDIENTES,
    leerPendientes().filter((id) => id !== idCuaderno),
  )
}

/**
 * La agenda es un solo archivo, así que basta un sí o un no en lugar de una
 * lista de identificadores.
 */
export function hayAgendaPendiente(): boolean {
  return localStorage.getItem(CLAVE_PENDIENTE_AGENDA) === '1'
}

export function marcarAgendaPendiente(): void {
  localStorage.setItem(CLAVE_PENDIENTE_AGENDA, '1')
}

export function limpiarAgendaPendiente(): void {
  localStorage.removeItem(CLAVE_PENDIENTE_AGENDA)
}

/** Materias cuyos mazos tienen cambios que aún no están en la nube. */
export function leerMazosPendientes(): string[] {
  return leerJson<string[]>(CLAVE_PENDIENTES_MAZOS, [])
}

export function marcarMazosPendiente(idCuaderno: string): void {
  const pendientes = new Set(leerMazosPendientes())
  pendientes.add(idCuaderno)
  escribirJson(CLAVE_PENDIENTES_MAZOS, [...pendientes])
}

export function limpiarMazosPendiente(idCuaderno: string): void {
  escribirJson(
    CLAVE_PENDIENTES_MAZOS,
    leerMazosPendientes().filter((id) => id !== idCuaderno),
  )
}

export function hayPendientes(): boolean {
  return leerPendientes().length > 0 || leerMazosPendientes().length > 0 || hayAgendaPendiente()
}

export function leerUltimaSincronizacion(): number | null {
  const valor = localStorage.getItem(CLAVE_ULTIMA_SYNC)
  return valor ? Number(valor) : null
}

export function registrarSincronizacion(cuando: number = Date.now()): void {
  localStorage.setItem(CLAVE_ULTIMA_SYNC, String(cuando))
}

/** Se usa al cerrar sesión en un equipo compartido. */
export function borrarEstadoNube(): void {
  localStorage.removeItem(CLAVE_SHAS)
  localStorage.removeItem(CLAVE_PENDIENTES)
  localStorage.removeItem(CLAVE_PENDIENTES_MAZOS)
  localStorage.removeItem(CLAVE_PENDIENTE_AGENDA)
  localStorage.removeItem(CLAVE_ULTIMA_SYNC)
}
