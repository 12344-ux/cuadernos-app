import type { Conflicto } from '../nube/sincronizacion'

const formateador = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

type Props = {
  conflictos: Conflicto[]
  onResolver: (idCuaderno: string, quedarseCon: 'local' | 'remoto') => void
}

/**
 * Aparece cuando una materia cambió en este dispositivo y en la nube desde la
 * última sincronización. Se pregunta en lugar de decidir solo: cualquier
 * elección automática haría desaparecer trabajo sin avisar.
 */
export function DialogoConflicto({ conflictos, onResolver }: Props) {
  if (conflictos.length === 0) return null

  return (
    <div className="capa-modal">
      <section className="modal">
        <h2>Cambios en conflicto</h2>
        <p className="subtitulo">
          Estas materias se editaron aquí y en otro dispositivo. Elige cuál conservar; la otra
          versión se descarta.
        </p>

        <ul className="lista-conflictos">
          {conflictos.map((conflicto) => (
            <li key={conflicto.idCuaderno}>
              <div>
                <strong>{conflicto.nombre}</strong>
                <div className="fechas-conflicto">
                  <span>Aquí: {formateador.format(conflicto.modificadoLocal)}</span>
                  <span>En la nube: {formateador.format(conflicto.modificadoRemoto)}</span>
                </div>
              </div>
              <div className="acciones-conflicto">
                <button
                  type="button"
                  className="boton-secundario pequeno"
                  onClick={() => onResolver(conflicto.idCuaderno, 'local')}
                >
                  Conservar la de aquí
                </button>
                <button
                  type="button"
                  className="boton-secundario pequeno"
                  onClick={() => onResolver(conflicto.idCuaderno, 'remoto')}
                >
                  Traer la de la nube
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
