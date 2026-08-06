import { lazy } from 'react'

/**
 * La hoja de apuntes va en el mismo fragmento diferido que el editor de los cuadros.
 *
 * Las dos cargan Tiptap y ProseMirror, que pesan más que el resto de la aplicación
 * junta. Importándolas por separado el empaquetador las pone en el mismo trozo, así
 * que abrir una clase no descarga nada que no hiciera falta y quien solo mire el
 * mapa no paga por el editor.
 */
export const HojaApuntesDiferida = lazy(async () => ({
  default: (await import('./HojaApuntes')).HojaApuntes,
}))
