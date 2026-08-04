import { borrarEstadoNube } from './estadoNube'
import { eliminarBaseDeDatos } from './idb'
import { olvidarCredencial } from '../nube/credenciales'

/**
 * Deja el navegador como si la app nunca se hubiera abierto aquí.
 *
 * Es la razón de ser del botón de cerrar sesión en los equipos del SENA: sin
 * este borrado, los apuntes seguirían en IndexedDB y el índice de materias en
 * localStorage, visibles para la siguiente persona que use ese computador.
 */
export async function borrarTodoLoLocal(): Promise<void> {
  olvidarCredencial()
  borrarEstadoNube()

  localStorage.removeItem('cuadernos:indice')
  localStorage.removeItem('cuadernos:semilla-aplicada')

  await eliminarBaseDeDatos()
}
