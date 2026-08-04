# Cuadernos

Mapas mentales minimalistas para estudiar. Un lienzo infinito por materia.

## Cómo ejecutarlo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # comprobación de tipos + build de producción en dist/
```

## Cómo se usa el lienzo

- **Doble clic en el fondo** crea un cuadro y lo deja listo para escribir.
- **Doble clic en un cuadro** vuelve a editar su texto; `Esc` cierra la edición.
- **Un clic** lo selecciona y muestra la barra flotante: 7 colores, resaltado y eliminar.
- **Arrastrar desde cualquier borde** crea una flecha hacia otro cuadro.
- `Supr` o `Retroceso` borra lo seleccionado. Se puede redimensionar por las esquinas.

## Cómo se guardan los datos

- El **índice de materias** (nombres, fechas, archivado) vive en `localStorage`: son unos pocos KB
  y conviene leerlo de forma sincrónica al arrancar.
- El **lienzo de cada materia** vive en `IndexedDB`, no en `localStorage`, porque este último tiene
  una cuota de ~5 MB por origen y es sincrónico: con miles de ideas se llena y bloquea la edición.
- El autoguardado se dispara 700 ms después del último cambio, y también al cerrar la pestaña.
  El estado (`Guardando` / `Guardado` / `Error`) se muestra arriba a la derecha.
- El tipo `DocumentoCuaderno` (`src/tipos.ts`) es exactamente el JSON que se subirá a GitHub en la
  Fase 3, por eso se mantiene plano y sin campos efímeros.

## Estado

Fase 1 completada. Pendiente: panel de notas rápidas (Fase 2), sincronización con GitHub
(Fase 3) y despliegue en GitHub Pages con dominio propio (Fase 4).

## Licencias

El lienzo usa [React Flow](https://reactflow.dev) (`@xyflow/react`), con licencia MIT. React Flow
muestra una pequeña insignia de atribución por defecto; aquí está oculta mediante
`proOptions={{ hideAttribution: true }}`, algo que los mantenedores
[permiten en proyectos no comerciales](https://github.com/wbkd/react-flow/discussions/2015). Si este
proyecto pasara a un uso comercial, hay que volver a mostrarla o contratar React Flow Pro.
