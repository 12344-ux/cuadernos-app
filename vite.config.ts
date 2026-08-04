import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // base '/' es correcto para un dominio propio (cuadernos.xyz) en GitHub Pages.
  // Si algún día se sirve desde usuario.github.io/cuadernos-app, hay que cambiarlo a '/cuadernos-app/'.
  base: '/',
})
