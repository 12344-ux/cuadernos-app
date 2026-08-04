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

## Despliegue

Cada empujón a `main` publica el sitio en GitHub Pages mediante
`.github/workflows/desplegar.yml`. Requiere haber puesto **Settings → Pages → Source:
GitHub Actions** una sola vez.

La `base` de Vite es `'./'` (rutas relativas), así que el mismo build sirve tanto en
`12344-ux.github.io/cuadernos-app/` como en un dominio propio desde la raíz, sin recompilar.

### Dominio propio (cuadernos.xyz)

El dominio se configura **solo** en Settings → Pages → Custom domain. No hace falta ningún
archivo `CNAME` en el repositorio: [la documentación de GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
indica que al publicar desde un workflow de Actions no se crea, y que cualquier `CNAME`
existente se ignora.

En el DNS, el dominio raíz necesita los cuatro registros `A` de GitHub Pages
(`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`). Para el
subdominio `www`, un registro `CNAME` que apunte a `12344-ux.github.io`.

## Estado

Fase 1 completada y desplegada. Pendiente: panel de notas rápidas (Fase 2) y
sincronización con GitHub (Fase 3).

## Licencias

El lienzo usa [React Flow](https://reactflow.dev) (`@xyflow/react`), con licencia MIT. React Flow
muestra una pequeña insignia de atribución por defecto; aquí está oculta mediante
`proOptions={{ hideAttribution: true }}`, algo que los mantenedores
[permiten en proyectos no comerciales](https://github.com/wbkd/react-flow/discussions/2015). Si este
proyecto pasara a un uso comercial, hay que volver a mostrarla o contratar React Flow Pro.
