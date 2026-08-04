import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  /*
   * Rutas relativas a propósito. Así el mismo build funciona tanto en
   * 12344-ux.github.io/cuadernos-app/ (subcarpeta) como en un dominio propio
   * servido desde la raíz, sin tener que recompilar con otra 'base'.
   * Es posible porque el enrutado es por hash y no hay rutas de servidor.
   */
  base: './',
})
