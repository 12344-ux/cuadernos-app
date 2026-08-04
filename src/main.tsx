import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
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
