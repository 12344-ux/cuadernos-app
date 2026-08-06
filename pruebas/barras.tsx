/*
 * Banco de pruebas de la barra superior. No entra en la aplicación.
 *
 * Sirve para medir lo único que importa aquí: que el alto de la barra no cambie
 * cuando el estado de la nube añade botones. Usa la BarraNube real.
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BarraNube, IconoNube } from '../src/componentes/BarraNube'
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
        {/* Como en una materia: sin la recuperación de credenciales. */}
        <BarraNube
          enInicio={false}
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

      {/* La barra del selector: con texto y con la recuperación de credenciales. */}
      <main className="selector" style={{ padding: '1rem', maxWidth: 'none' }}>
        <BarraNube
          enInicio
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
      </main>

      {/* Los cuatro estados juntos y ampliados, para comprobar que el dibujo se
          distingue a tamaño real y no solo por el color. */}
      <div style={{ padding: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        {(['ok', 'pendiente', 'trabajando', 'error'] as const).map((e) => (
          <div key={e} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
            <span className={`pastilla pastilla-${e === 'pendiente' ? 'aviso' : e}`}>
              <IconoNube estado={e} />
            </span>
            <span className={`pastilla pastilla-${e === 'pendiente' ? 'aviso' : e}`} style={{ zoom: 3 }}>
              <IconoNube estado={e} />
            </span>
            <small>{e}</small>
          </div>
        ))}
      </div>

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
