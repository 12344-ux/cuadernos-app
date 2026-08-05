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
- **Arrastrar desde cualquier borde** crea una flecha hacia otro cuadro.
- `Supr` o `Retroceso` borra lo seleccionado. Se puede redimensionar por las esquinas.

### Las dos barras de formato

Están separadas a propósito, y la regla se explica en una frase: **arriba lo que afecta al
elemento, junto al texto lo que afecta a lo que has seleccionado.**

| Barra | Cuándo aparece | Qué trae |
| --- | --- | --- |
| Del elemento | Al seleccionar un cuadro o un post-it | 7 colores, tipografía, 3 tamaños, alineación, eliminar |
| Del texto | Al seleccionar palabras mientras editas | Negrilla, cursiva, subrayado, 3 marcadores, limpiar formato |

Los tres marcadores están pensados para clasificar, no para decorar: amarillo *importante*,
verde *definición*, rosa *duda*. Un único color de resaltado perdería esa utilidad.

Ya no existe el botón «Resaltar» que pintaba el cuadro entero: ahora que se puede resaltar texto
concreto, tener las dos cosas con el mismo nombre solo confundía.

Las tipografías son tres pilas del sistema (Sistema, Serif, Mono) y **Fraunces**, la única
autoalojada. Se elige por elemento, no por palabra.

### Post-its

Un post-it es una nota suelta pegada encima del lienzo, para apuntar algo puntual sin tocar la
estructura del mapa. Se crea con **+ Post-it**, se mueve y se le da formato igual que a un cuadro,
pero:

- **No admite flechas.** No dibuja puntos de conexión, y tanto el lienzo como el almacenamiento
  descartan cualquier conexión que intente tocarlo.
- **No cuenta como idea.** El número de la tarjeta de cada materia sigue contando solo los cuadros,
  para que siga diciendo cuántas ideas hay realmente en el mapa.
- Se distingue de un vistazo por el giro, la sombra, la esquina doblada y el amarillo de partida.

## Flashcards

Cada materia tiene su propia sección de repaso, a la que se entra con el botón **Flashcards** del
lienzo (`#/c/<id>/flashcards`). Dentro se crean mazos, y en cada mazo tarjetas con anverso y reverso,
usando el mismo editor enriquecido que los cuadros del mapa: negrilla, cursiva, subrayado y marcador
seleccionando el texto.

La sección va en **modo oscuro** mientras el resto de la app sigue en claro. Es deliberado: es un
modo de concentración. Entrar a estudiar apaga la interfaz del mapa y deja la tarjeta como único
foco; al salir, todo vuelve a su aspecto habitual.

En la sesión de repaso, `espacio` voltea la tarjeta y las teclas `1`-`4` responden.

### El algoritmo

Es **SM-2**, el de Anki, tomado del texto original de Piotr Woźniak (*Optimization of learning*,
1990) y no de una reimplementación:

```
I(1) = 1
I(2) = 6
I(n) = I(n-1) * EF                                     redondeando hacia arriba
EF'  = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))      con EF mínimo 1.3
```

Los cuatro botones son las calidades `q` de la escala 0-5: **Otra vez** `q=0`, **Difícil** `q=3`,
**Bien** `q=4`, **Fácil** `q=5`. Con `q=4` el factor de facilidad no cambia, que es la comprobación
que da el propio texto original. Pulsando siempre *Bien*, los intervalos van `1 → 6 → 15 → 38 → 95
→ 238` días.

**Al fallar, la facilidad también baja.** El texto original se contradice en este punto: la regla que
actualiza el factor dice "tras cada repaso", pero la que trata los fallos dice que se reinicia "sin
cambiar el E-Factor". Aquí se aplica siempre, como hace Anki, porque es lo útil: una tarjeta que se
falla va espaciándose cada vez más despacio y aparece más a menudo que las fáciles. Se nota enseguida
— sin fallos, el tercer acierto salta a 15 días; con un fallo previo, a 11.

*Otra vez* devuelve la tarjeta al final de la cola de la sesión, así que vuelve a salir el mismo día.
No hay límite diario de tarjetas nuevas: si un mazo trae doscientas, se ofrecen las doscientas.

**Las fechas se guardan como día del calendario local** (`2026-08-06`) y no como marca de tiempo. Los
intervalos de SM-2 son días enteros y "toca hoy" tiene que significar el día del usuario: con una
marca de tiempo, una tarjeta repasada a las 23:50 volvería a vencer a las 23:50 del día siguiente en
lugar de estar lista por la mañana, y cambiaría de comportamiento al viajar de zona horaria.

## Sincronización entre dispositivos

Los apuntes se guardan en el repositorio privado **`12344-ux/cuadernos-data`**:

```
indice.json            lista de materias, fechas y última materia abierta
materias/<id>.json     el lienzo de cada materia
mazos/<id>.json        las flashcards de cada materia
```

El mapa y las flashcards van en archivos separados a propósito, y cada uno lleva su propia fecha de
modificación en el índice (`modificado` y `mazosModificado`). Si compartieran archivo, repasar una
tarjeta reescribiría el mapa entero, lo marcaría como cambiado y generaría commits sobre él.

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

### No hay acceso sin contraseña

Existió un enlace de "trabajar solo en este dispositivo" que entraba sin credenciales, y **era un
agujero de seguridad comprobado**: en un equipo con datos guardados, cualquiera podía entrar sin
contraseña, leer los apuntes y borrar materias. Peor aún, esos borrados quedaban marcados como
pendientes y **los subía el propio dueño** la siguiente vez que entraba con su token.

Se eliminó. No hace falta como respaldo sin conexión: `desbloquear()` abre la sesión *antes* de
sincronizar, así que con la contraseña se trabaja igual sin internet y los cambios quedan
pendientes de subir.

Por el mismo motivo, un token rechazado (caducado o revocado) ya no cierra la sesión ni borra la
credencial: eso dejaría al dueño sin acceso a sus propios apuntes locales. Se avisa en la barra y
se ofrece **Usar otro token**.

### Equipos compartidos

- **"Recordar en este dispositivo" viene sin marcar.** Sin marcarlo, el token cifrado va a
  `sessionStorage` y desaparece al cerrar el navegador; sobrevive a un F5 para no tener que
  pegar el token en cada recarga.
- **Cerrar sesión ofrece borrar los apuntes del computador**, marcado por defecto: elimina la
  base de datos de IndexedDB y las claves de `localStorage`. Si queda algo sin subir, avisa antes.

### Cuándo se sube

**No hay que acordarse de guardar nada.** Cuatro segundos después de dejar de escribir, lo que
cambió está en la nube. El retardo existe porque cada escritura es un commit: agrupar una ráfaga de
ediciones en una sola subida evita llenar el historial de commits de una letra cada uno.

Además se sube al ocultar la pestaña, al recuperar la conexión, y cada 2 minutos como red de
seguridad por si alguna subida falló. El botón **Comprobar ahora** no hace falta para guardar; sirve
para traer los cambios de otro dispositivo en ese instante.

### Mover la vista no es editar

Desplazar el lienzo o hacer zoom se recuerda en el dispositivo, pero **no cuenta como cambio de la
materia**: no toca su fecha de modificación, no la marca pendiente y no genera ningún commit.

Antes sí lo hacía, y tenía dos consecuencias molestas: el historial se llenaba de commits por
haber mirado un mapa, y bastaba con abrir la misma materia en dos dispositivos para que los dos
apareciesen "modificados" y saltara un aviso de conflicto sin haber tocado nada.

### Conflictos: se combinan solos

Si una materia cambió aquí y en la nube, **la app las combina sin preguntar**. Antes salía un
diálogo pidiendo elegir cuál conservar, y la otra se descartaba: confundía y podía costar una tarde
de trabajo.

Como cuadros, flechas y notas tienen identificador propio, se pueden juntar de verdad: el resultado
es la unión de los tres conjuntos, y para los elementos que existen en las dos versiones manda el
lado que se editó más tarde. Lo que se hizo en cada dispositivo sigue estando.

Las flashcards se combinan igual, con una regla propia para las tarjetas que existen en los dos
lados: **el texto lo aporta el lado que se editó más tarde y la programación el que la estudió más
tarde**. Son cosas independientes, y así repasar en el móvil y luego retocar el mazo en el portátil
no borra el progreso del repaso.

Queda un caso que conviene conocer: si en un dispositivo se borró un cuadro y el otro estaba sin
conexión, ese cuadro reaparece al combinar. Es un segundo volver a borrarlo, y es preferible a la
alternativa anterior, que era perder todo lo escrito en uno de los dos lados. Y en cualquier caso
nada se pierde de forma irreversible: cada sincronización es un commit, así que toda versión
anterior sigue en el historial del repositorio.

La detección se apoya en el `sha` que devuelve GitHub: una escritura con un `sha` desactualizado se
rechaza, y eso es lo que permite darse cuenta de que hay que combinar en lugar de pisar.

Al eliminar una materia se deja una *lápida* en el índice en vez de quitar la entrada. Sin eso,
la próxima sincronización con un dispositivo que todavía la tuviera la resucitaría.

## Cómo se guardan los datos

- El **índice de materias** (nombres, fechas, archivado) vive en `localStorage`: son unos pocos KB
  y conviene leerlo de forma sincrónica al arrancar.
- El **lienzo de cada materia** vive en `IndexedDB`, no en `localStorage`, porque este último tiene
  una cuota de ~5 MB por origen y es sincrónico: con miles de ideas se llena y bloquea la edición.
- El autoguardado se dispara 700 ms después del último cambio, y también al cerrar la pestaña.
  El estado (`Guardando` / `Guardado` / `Error`) se muestra arriba a la derecha.
- El tipo `DocumentoCuaderno` (`src/tipos.ts`) es exactamente el JSON que se sube a GitHub, por eso
  se mantiene plano y sin campos efímeros.

### Formato del documento, versión 2

El texto con formato se guarda como **HTML** y no como el JSON de ProseMirror: una frase corta cabe
en una línea legible dentro del diff de GitHub, mientras que el JSON la convertiría en un árbol de
treinta líneas.

```html
<p>La <strong>mitosis</strong> es una <mark data-color="verde">división celular</mark></p>
```

Solo se admiten `p`, `br`, `strong`, `em`, `u` y `mark`, y del `mark` únicamente su `data-color`.
Igual que con la paleta de los cuadros, **el color del marcador no se guarda**: solo su clave, para
poder retocar los tonos sin migrar ningún cuaderno.

Lo que distingue un cuadro de un post-it es el campo `type` del nodo (`texto` o `postit`), que
React Flow ya persiste. Se usa ese en lugar de añadir otro campo dentro de `data` para no tener el
mismo dato en dos sitios que puedan desincronizarse.

Los documentos de la versión 1 se convierten al abrirlos (`normalizar()` en
`almacenamiento/documentos.ts`): el `texto` plano pasa a HTML escapando los símbolos, y el antiguo
booleano `resaltado` se traduce al marcador amarillo.

Como el HTML se inyecta para dibujar los cuadros sin montar un editor en cada uno, **se sanea con
una lista blanca** (`texto/saneador.ts`) tanto al cargar el documento como antes de mostrarlo. Los
documentos llegan de un repositorio remoto, y aunque sea privado, un archivo manipulado no debe
poder ejecutar código en la sesión, que es donde vive el token cifrado.

### Por qué el editor se carga aparte

Tiptap y ProseMirror pesan más que el resto de la aplicación junta, y solo hacen falta al escribir:
en reposo los cuadros son HTML estático. Van en su propio archivo (`componentes/editorDiferido.ts`),
así que el arranque cuesta lo mismo que antes de que existiera el editor y **solo hay una instancia
de Tiptap viva a la vez**, la del cuadro que se está editando. El lienzo lo precarga en cuanto el
navegador está desocupado para que la primera edición no espere a la red.

## Despliegue

Cada empujón a `main` publica el sitio en GitHub Pages mediante
`.github/workflows/desplegar.yml`. Requiere haber puesto **Settings → Pages → Source:
GitHub Actions** una sola vez.

La `base` de Vite es `'./'` (rutas relativas), así que el mismo build sirve tanto en
`12344-ux.github.io/cuadernos-app/` como en un dominio propio desde la raíz. Para usar
`cuadernos.xyz` hace falta añadir un archivo `public/CNAME` con el dominio y apuntar el DNS.

## Estado

Fases 1, 3 y 4 completadas, más el formato de texto enriquecido, los post-its y las flashcards con
SM-2. Pendiente: panel de notas rápidas (Fase 2), crear una flashcard directamente desde un cuadro
del mapa, y el resto de mejoras de interfaz.

## Licencias

El editor de texto es [Tiptap](https://tiptap.dev) (`@tiptap/*`), con licencia MIT.

La tipografía **Fraunces** viene de [Fontsource](https://fontsource.org) con licencia
[OFL-1.1](https://openfontlicense.org). Se sirve desde el propio sitio y no desde Google Fonts, para
no hacer una petición a un tercero en cada carga.

El lienzo usa [React Flow](https://reactflow.dev) (`@xyflow/react`), con licencia MIT. React Flow
muestra una pequeña insignia de atribución por defecto; aquí está oculta mediante
`proOptions={{ hideAttribution: true }}`, algo que los mantenedores
[permiten en proyectos no comerciales](https://github.com/wbkd/react-flow/discussions/2015). Si este
proyecto pasara a un uso comercial, hay que volver a mostrarla o contratar React Flow Pro.
