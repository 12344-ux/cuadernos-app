import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/*
 * Configuración solo para los bancos de pruebas de pruebas/.
 *
 * Salen en formato IIFE y con las importaciones dinámicas incrustadas para poder
 * abrir el resultado con 'file://' y un <script> normal: así se prueba en un
 * navegador de verdad sin levantar ningún servidor.
 *
 * Se elige cuál compilar con --mode: 'lienzo' (por defecto) o 'barras'.
 */
export default defineConfig(({ mode }) => {
  const banco = mode === 'barras' ? 'barras' : 'lienzo'

  return {
    plugins: [react()],
    // En modo 'lib' Vite no sustituye esto, y React lo lee al arrancar: sin
    // definirlo el paquete lanza 'process is not defined' y no monta nada.
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: 'dist-pruebas',
      emptyOutDir: false,
      lib: {
        entry: `pruebas/${banco}.tsx`,
        formats: ['iife'],
        name: 'Banco',
        fileName: () => `${banco === 'barras' ? 'barras' : 'banco'}.js`,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: `${banco === 'barras' ? 'barras' : 'banco'}.[ext]`,
        },
      },
    }
  }
})
