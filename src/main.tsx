import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
/*
 * Fraunces autoalojada, no desde Google Fonts: la app se sirve desde GitHub
 * Pages y no conviene una petición a un tercero en cada carga.
 *
 * Se usan las hojas del eje de grosor ('wght') y no las completas porque con el
 * eje variable ya salen todos los pesos de un solo archivo. Cada @font-face
 * lleva su unicode-range, así que para texto en español el navegador solo baja
 * el subconjunto latino (36 KB), y la cursiva únicamente si se llega a usar.
 */
import '@fontsource-variable/fraunces/wght.css'
import '@fontsource-variable/fraunces/wght-italic.css'
// Los estilos de React Flow van primero para que los propios puedan sobrescribirlos.
import '@xyflow/react/dist/style.css'
import './estilos/global.css'

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('No se encontró el elemento #root')

createRoot(contenedor).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
