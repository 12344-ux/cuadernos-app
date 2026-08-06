/*
 * Banco de pruebas de la barra superior. No entra en la aplicación.
 *
 * Sirve para medir lo único que importa aquí: que el alto de la barra no cambie
 * cuando el estado de la nube añade botones. Usa la BarraNube real.
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BarraNube } from '../src/componentes/BarraNube'
import { ProveedorModoVisual, aplicarModoAlDocumento, leerModo } from '../src/modo/visual'
import type { EstadoNube } from '../src/hooks/useNube'
import '@xyflow/react/dist/style.css'
import '../src/estilos/global.css'

const LARGO = 'El archivo cambió en la nube desde la última sincronización de este dispositivo'

function Banco() {
  const [estado, setEstado] = useState<EstadoNube>('sincronizado')
  const [aviso, setAviso] = useState(false)

  return (
    <div className="vista-cuaderno">
      <header className="barra-superior">
        <button type="button" className="boton-volver">
          Mapa
        </button>
        <h1 className="titulo-cuaderno">Contabilidad</h1>
        <div className="espaciador" />
        <BarraNube
          estadoSesion="abierto"
          estadoNube={estado}
          mensaje={estado === 'error' ? LARGO : null}
          pendientes={estado === 'error'}
          ultimaSync={Date.now()}
          donde="sesion"
          onSincronizar={() => {}}
          onCerrarSesion={() => {}}
          onUsarOtroToken={() => {}}
        />
      </header>

      {/* Hace de hoja: es lo que no debe moverse. */}
      <section className="panel-hoja">
        {aviso && (
          <p className="aviso-guardado" role="alert">
            No se pudieron guardar los apuntes en este dispositivo.
          </p>
        )}
        <div className="hoja-apuntes" id="hoja">
          <div className="hoja-papel">
            <div className="hoja-editor">
              <p id="primera-linea">Primera línea de los apuntes.</p>
            </div>
          </div>
        </div>
      </section>

      <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" id="a-error" className="boton-secundario" onClick={() => setEstado('error')}>
          Provocar error
        </button>
        <button type="button" id="a-ok" className="boton-secundario" onClick={() => setEstado('sincronizado')}>
          Volver a normal
        </button>
        <button type="button" id="a-aviso" className="boton-secundario" onClick={() => setAviso((v) => !v)}>
          Aviso de guardado
        </button>
      </div>
    </div>
  )
}

aplicarModoAlDocumento(leerModo())

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <ProveedorModoVisual>
      <Banco />
    </ProveedorModoVisual>
  </StrictMode>,
)
