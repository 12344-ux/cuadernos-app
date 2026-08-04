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

## Sincronización entre dispositivos

Los apuntes se guardan en el repositorio privado **`12344-ux/cuadernos-data`**:

```
indice.json            lista de materias, fechas y última materia abierta
materias/<id>.json     el lienzo de cada materia
```

### Cómo crear el token

En GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.

- **Repository access:** solo `cuadernos-data`.
- **Permisos:** `Contents: Read and write`. Nada más.
- No sirve un token clásico (`ghp_`) con permisos sobre toda la cuenta: la app lo rechaza
  a propósito.

La primera vez se pega el token y se elige una contraseña de 8 caracteres o más. En adelante
solo se pide la contraseña.

### Qué protege la contraseña y qué no

La contraseña cifra el token con AES-GCM, usando una clave derivada con PBKDF2-HMAC-SHA256 y
**600.000 iteraciones**, que es la recomendación de OWASP. El número de iteraciones se guarda
dentro del blob cifrado para poder subirlo más adelante sin invalidar credenciales antiguas.

Protege el token guardado frente a alguien que lea el almacenamiento del navegador. **No** lo
protege mientras la app está abierta, porque para llamar a la API tiene que estar descifrado en
memoria. Por eso importa que el token esté limitado a un solo repositorio: en el peor caso se
comprometen los apuntes, no la cuenta de GitHub.

### Equipos compartidos

- **"Recordar en este dispositivo" viene sin marcar.** Sin marcarlo, el token cifrado va a
  `sessionStorage` y desaparece al cerrar el navegador; sobrevive a un F5 para no tener que
  pegar el token en cada recarga.
- **Cerrar sesión ofrece borrar los apuntes del computador**, marcado por defecto: elimina la
  base de datos de IndexedDB y las claves de `localStorage`. Si queda algo sin subir, avisa antes.

### Cuándo se sube

Cada 2 minutos si hay cambios, al ocultar la pestaña, y con el botón **Guardar en la nube**. No
se sube en cada pulsación como el guardado local, porque cada escritura es un commit.

### Conflictos y borrados

Si una materia cambió aquí y en la nube desde la última sincronización, la app **pregunta** cuál
conservar en lugar de decidir sola. La detección se apoya en el `sha` que devuelve GitHub: una
escritura con un `sha` desactualizado se rechaza en lugar de pisar el trabajo ajeno.

Al eliminar una materia se deja una *lápida* en el índice en vez de quitar la entrada. Sin eso,
la próxima sincronización con un dispositivo que todavía la tuviera la resucitaría.

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
`12344-ux.github.io/cuadernos-app/` como en un dominio propio desde la raíz. Para usar
`cuadernos.xyz` hace falta añadir un archivo `public/CNAME` con el dominio y apuntar el DNS.

## Estado

Fases 1, 3 y 4 completadas. Pendiente: panel de notas rápidas (Fase 2) y mejoras de interfaz.

## Licencias

El lienzo usa [React Flow](https://reactflow.dev) (`@xyflow/react`), con licencia MIT. React Flow
muestra una pequeña insignia de atribución por defecto; aquí está oculta mediante
`proOptions={{ hideAttribution: true }}`, algo que los mantenedores
[permiten en proyectos no comerciales](https://github.com/wbkd/react-flow/discussions/2015). Si este
proyecto pasara a un uso comercial, hay que volver a mostrarla o contratar React Flow Pro.
