import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/*
 * Configuración solo para el banco de pruebas de pruebas/lienzo.tsx.
 *
 * Sale en formato IIFE y con las importaciones dinámicas incrustadas para poder
 * abrir el resultado con 'file://' y un <script> normal: así se prueba en un
 * navegador de verdad sin levantar ningún servidor.
 */
export default defineConfig({
  plugins: [react()],
  // En modo 'lib' Vite no sustituye esto, y React lo lee al arrancar: sin definirlo
  // el paquete lanza 'process is not defined' y no monta nada.
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-pruebas',
    lib: {
      entry: 'pruebas/lienzo.tsx',
      formats: ['iife'],
      name: 'BancoLienzo',
      fileName: () => 'banco.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true, assetFileNames: 'banco.[ext]' } },
  },
})
